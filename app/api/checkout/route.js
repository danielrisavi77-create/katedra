// ============================================================
// KATEDRA — Stripe Checkout (Pass paketi, jednokratno plaćanje)
// POST { package: 'seminarski' | 'zavrsni' | 'diplomski' }
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

// tokens = obračunski tokeni (input + 5×output), NEPROMIJENJENI od prije
// repricinga — VIZIJA.md: "cijena mora signalizirati vrijednost, ne
// jeftinoću", ne cost-plus. Cijene su charter-ove ("Monetizacija" §, A/B
// test nakon prvih 20 kupaca dopušten, ali nikad ispod 19/49/99 €).
const PACKAGES = {
  seminarski: { eur: 29.9, tokens: 1_500_000, name: 'Katedra Seminarski Pass' },
  zavrsni: { eur: 79.9, tokens: 4_500_000, name: 'Katedra Završni Pass' },
  diplomski: { eur: 129.9, tokens: 12_000_000, name: 'Katedra Diplomski Pass' },
}

export async function POST(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  let pkgKey
  try {
    ;({ package: pkgKey } = await req.json())
  } catch {
    return Response.json({ error: 'Neispravan zahtjev.' }, { status: 400 })
  }
  const pkg = PACKAGES[pkgKey]
  if (!pkg) return Response.json({ error: 'Nepoznat paket.' }, { status: 400 })

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
        package: pkgKey,
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
