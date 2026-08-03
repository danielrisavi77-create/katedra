// ============================================================
// KATEDRA — Stripe Checkout (Project Pass, jednokratno plaćanje)
// POST { projectId, package: 'seminarski' | 'zavrsni' | 'diplomski' }
//
// Audit 4: checkout prodaje ENTITLEMENT za konkretan academic_project_id,
// ne apstraktne AI kredite. Wallet top-up (tokens) i dalje putuje u Stripe
// metadata jer webhook i dalje puni katedra_wallets kao INTERNI spend-guard
// (vidi app/api/webhook/route.js) — ali projectId/product_key su primarni
// commercial signal, ne tokens/amount_eur.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

// tokens = obračunski tokeni (input + 5×output) za interni wallet hard cap,
// NEPROMIJENJENI od prije repricinga — VIZIJA.md: "cijena mora signalizirati
// vrijednost, ne jeftinoću", ne cost-plus. Cijene su charter-ove
// ("Monetizacija" §, donja granica nikad ispod 19/49/99 €).
const PACKAGES = {
  seminarski: { eur: 29.9, tokens: 1_500_000, name: 'Katedra Seminarski Pass', workType: 'seminar' },
  zavrsni: { eur: 79.9, tokens: 4_500_000, name: 'Katedra Završni Pass', workType: 'final' },
  diplomski: { eur: 129.9, tokens: 12_000_000, name: 'Katedra Diplomski Pass', workType: 'graduate' },
}

export async function POST(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  let pkgKey, projectId
  try {
    ;({ package: pkgKey, projectId } = await req.json())
  } catch {
    return Response.json({ error: 'Neispravan zahtjev.' }, { status: 400 })
  }
  const pkg = PACKAGES[pkgKey]
  if (!pkg) return Response.json({ error: 'Nepoznat paket.' }, { status: 400 })
  projectId = typeof projectId === 'string' ? projectId.trim() : ''
  if (!projectId) return Response.json({ error: 'Nedostaje projekt. Spremi radni prostor prije kupnje.' }, { status: 400 })

  // Server-side ownership + work-type check — isti izvor istine kao
  // app/api/state/route.js GET (katedra_projects po user_id), ali ovdje
  // tražimo TOČNO onaj project_id koji klijent šalje, ne samo najnoviji.
  const { data: project, error: projectError } = await supabase
    .from('katedra_projects')
    .select('project_id, work_type_canonical')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .maybeSingle()
  if (projectError) return Response.json({ error: 'Provjera projekta nije uspjela.' }, { status: 500 })
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  if (project.work_type_canonical !== pkg.workType) {
    return Response.json({ error: 'Vrsta rada u projektu ne odgovara odabranom paketu.' }, { status: 400 })
  }

  // NOTE: column list kept minimal/confirmed (user_id, project_id, scope) per
  // scripts/foundation-db-smoke.sql — `status` presence/default is assumed from
  // lib/academic-suite/contracts.ts's EntitlementStatus and must be verified
  // against the live Lekta schema before this ships (see plan Faza 1 note).
  const { data: existing, error: existingError } = await supabase
    .from('entitlements')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .eq('scope', 'academic-pass')
    .eq('status', 'active')
    .maybeSingle()
  if (existingError) return Response.json({ error: 'Provjera postojećeg Passa nije uspjela.' }, { status: 500 })
  if (existing) return Response.json({ error: 'Ovaj projekt već ima aktivan Pass.' }, { status: 409 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email ?? undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(pkg.eur * 100),
          product_data: { name: pkg.name },
        },
      }],
      metadata: {
        user_id: user.id,
        academic_project_id: projectId,
        product_key: pkgKey,
        tokens: String(pkg.tokens),
        amount_eur: String(pkg.eur),
      },
      success_url: `${appUrl}/?placeno=1`,
      cancel_url: `${appUrl}/?placeno=0`,
    })
    return Response.json({ url: session.url })
  } catch (error) {
    console.error('[checkout] Stripe greška:', error?.message)
    return Response.json({ error: 'Plaćanje trenutno nije dostupno.' }, { status: 500 })
  }
}
