// ============================================================
// KATEDRA — Stripe Checkout (Project Pass, jednokratno plaćanje)
// POST { projectId, package: 'seminarski' | 'zavrsni' | 'diplomski' }
//
// Audit 4: checkout prodaje ENTITLEMENT za konkretan academic_project_id,
// ne apstraktne AI kredite. Wallet top-up (tokens) i dalje putuje u Stripe
// metadata jer webhook i dalje puni katedra_wallets kao INTERNI spend-guard
// (vidi app/api/webhook/route.js) — ali projectId/product_key su primarni
// commercial signal, ne tokens/amount_eur.
//
// Faza 1 stavka 3 (verificirano izravno protiv Lekta repozitorija, ne
// pretpostavljeno): stvarna `entitlements` shema (Lekta migracije 0001, 0002,
// 0035 — supabase/migrations/) NEMA `scope`/`capabilities` kolone, a `status`
// default je 'active' bez pretpostavke. Query dolje sad koristi STVARNE
// kolone (`academic_project_id`, ne `project_id`; nema `scope` filtera).
// Isto vrijedi za webhook insert — v. app/api/webhook/route.js.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { KATEDRA_PACKAGES } from '@/lib/stripe/catalog'
import { validateCheckoutConfirmation, validateCheckoutProject } from '@/lib/stripe/checkout-validation'
import { isAdminOverrideUser } from '@/lib/auth/admin-access'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { katedraPassProductFilter } from '../../../lib/katedra-pass-catalog.js'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'
import { getRequestId, withRequestId } from '../../../lib/observability/request-id.js'
import { logOperationalEvent } from '../../../lib/observability/operational-events'

// tokens = obračunski tokeni (input + 5×output) za interni wallet hard cap,
// NEPROMIJENJENI od prije repricinga — VIZIJA.md: "cijena mora signalizirati
// vrijednost, ne jeftinoću", ne cost-plus. Cijene su charter-ove
// ("Monetizacija" §, donja granica nikad ispod 19/49/99 €).
//
// entitlementWorkType koristi ISTI rječnik kao Lekta entitlements.work_type
// CHECK constraint ('seminarski'|'zavrsni'|'diplomski'|'doktorski') — pkgKey
// se poklapa 1:1, bez mapiranja. workType (englesko: seminar/final/graduate)
// je zaseban rječnik za academic_projects.work_type/work_type_canonical.
export async function POST(req) {
  return withRequestId(await handlePOST(req), getRequestId(req))
}

async function handlePOST(req) {
  const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return Response.json({ error: origin.error }, { status: origin.status })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  if (isAdminOverrideUser(user)) {
    return Response.json({ error: 'Ovaj račun ima aktivan admin pristup; plaćanje nije potrebno.', adminOverride: true }, { status: 409 })
  }
  if (process.env.NODE_ENV === 'production' && process.env.KATEDRA_PROJECT_LOCKS_ENABLED !== 'true') {
    console.error(JSON.stringify({ eventName: 'checkout_project_lock_contract_unavailable' }))
    return Response.json({ error: 'Plaćanje trenutno nije dostupno dok server-side zaključavanje projekta nije aktivno.' }, { status: 503 })
  }
  if (process.env.NODE_ENV === 'production' && process.env.KATEDRA_BILLING_RPC_CONTRACT !== 'v2') {
    console.error(JSON.stringify({ eventName: 'checkout_billing_contract_unavailable' }))
    return Response.json({ error: 'Plaćanje trenutno nije dostupno dok server-side billing ugovor nije aktivan.' }, { status: 503 })
  }

  const parsed = await readJsonBody(req, JSON_BODY_LIMITS.checkout)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  let pkgKey, projectId, topic, lockConfirmation
  ;({ package: pkgKey, projectId, topic, lockConfirmation } = parsed.value || {})
  const pkg = KATEDRA_PACKAGES[pkgKey]
  if (!pkg) return Response.json({ error: 'Nepoznat paket.' }, { status: 400 })
  projectId = typeof projectId === 'string' ? projectId.trim() : ''
  if (!projectId) return Response.json({ error: 'Nedostaje projekt. Spremi radni prostor prije kupnje.' }, { status: 400 })

  // Server-side ownership + work-type check — resolveOwnedProject accepts the
  // legacy guest alias during migration, but every commercial operation below
  // continues with the canonical UUID only.
  const ownedProjectResult = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if ('error' in ownedProjectResult) {
    logOperationalEvent({ eventName: 'checkout_project_lookup_failed', userId: user.id, projectId, error: ownedProjectResult.error }, 'error')
    return Response.json({ error: 'Projekt trenutačno nije moguće provjeriti.' }, { status: 503 })
  }
  const ownedProject = ownedProjectResult.value
  if (!ownedProject) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const canonicalProjectId = ownedProject.projectId
  const { data: project, error: projectError } = await supabase
    .from('katedra_projects')
    .select('project_id, work_type_canonical, topic')
    .eq('user_id', user.id)
    .eq('project_id', canonicalProjectId)
    .maybeSingle()
  if (projectError) return Response.json({ error: 'Provjera projekta nije uspjela.' }, { status: 500 })
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const validation = validateCheckoutProject({
    projectId: canonicalProjectId,
    workTypeCanonical: project.work_type_canonical,
  }, pkgKey)
  if (!validation.ok) return Response.json({ error: validation.error }, { status: validation.status })
  const confirmation = validateCheckoutConfirmation({ topic, projectTopic: project.topic, lockConfirmation })
  if (!confirmation.ok) return Response.json({ error: confirmation.error }, { status: confirmation.status })

  const { data: existing, error: existingError } = await supabase
    .from('entitlements')
    .select('id')
    .eq('user_id', user.id)
    .eq('academic_project_id', project.project_id)
    .eq('provider', 'stripe')
    .or(katedraPassProductFilter())
    .eq('status', 'active')
    .gt('purchase_expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()
  if (existingError) return Response.json({ error: 'Provjera postojećeg Passa nije uspjela.' }, { status: 500 })
  if (existing) return Response.json({ error: 'Ovaj projekt već ima aktivan Pass.' }, { status: 409 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl || !/^https?:\/\//i.test(appUrl)) {
    console.error(JSON.stringify({ eventName: 'checkout_app_url_unavailable', userId: user.id, projectId: project.project_id }))
    return Response.json({ error: 'Plaćanje trenutno nije konfigurirano.' }, { status: 503 })
  }

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
        academic_project_id: project.project_id,
        product_key: pkgKey,
        product_id: pkg.productId,
        topic: topic.trim(),
        lock_confirmation: 'true',
        tokens: String(pkg.tokens),
        amount_eur: String(pkg.eur),
      },
      success_url: `${appUrl}/pisi?placeno=1`,
      cancel_url: `${appUrl}/pisi?placeno=0`,
    })
    return Response.json({ url: session.url })
  } catch (error) {
    logOperationalEvent({ eventName: 'checkout_stripe_session_failed', userId: user.id, projectId: project.project_id, error }, 'error')
    return Response.json({ error: 'Plaćanje trenutno nije dostupno.' }, { status: 500 })
  }
}
