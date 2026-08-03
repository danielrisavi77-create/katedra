// ============================================================
// KATEDRA — Stripe webhook: uplata → Project Pass entitlement + interni wallet
// Stripe dashboard → Webhooks → endpoint: /api/webhook
// event: checkout.session.completed
//
// Audit 4: uplata prvenstveno granta ENTITLEMENT (pravi Pass, vezan uz
// academic_project_id, otključava Katedru i Lektu za taj projekt) i tek
// SEKUNDARNO puni katedra_wallets kao interni AI-compute spend-guard/hard cap
// — wallet balance više nije primarni proizvod, entitlement jest.
//
// Idempotencija: katedra_topups.stripe_session_id je UNIQUE, a katedra_grant
// RPC radi "on conflict do nothing" na toj koloni — ista Stripe sesija (pa i
// ponovljena dostava istog eventa) prolazi samo jednom za wallet dio. Za
// entitlements (bez potvrđenog unique constrainta na (user_id,project_id,scope)
// u ovom repou) idempotencija se postiže explicit SELECT-prije-INSERT.
// ============================================================
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { PASS_CAPABILITIES } from '@/lib/academic-suite/contracts'

export async function POST(req) {
  const stripe = getStripe()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('no signature', { status: 400 })

  let event
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch {
    return new Response('bad signature', { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object
    if (s.mode === 'payment') {
      const userId = s.metadata?.user_id
      const projectId = s.metadata?.academic_project_id
      const productKey = s.metadata?.product_key
      const tokens = Number(s.metadata?.tokens ?? 0)
      const amount = Number(s.metadata?.amount_eur ?? 0)

      if (userId && projectId && productKey && tokens > 0 && s.payment_status === 'paid') {
        const db = createAdminClient()

        // 1) PRAVI PASS — entitlement vezan uz ovaj projekt.
        const { data: already, error: lookupError } = await db
          .from('entitlements')
          .select('user_id')
          .eq('user_id', userId)
          .eq('project_id', projectId)
          .eq('scope', 'academic-pass')
          .maybeSingle()
        if (lookupError) {
          console.error('entitlements lookup failed', lookupError)
          return new Response('entitlement lookup failed', { status: 500 }) // Stripe će retry-ati
        }
        if (!already) {
          const { error: insertError } = await db.from('entitlements').insert({
            user_id: userId,
            project_id: projectId,
            scope: 'academic-pass',
            capabilities: PASS_CAPABILITIES.academicPass,
            source_product_id: productKey,
          })
          if (insertError) {
            console.error('entitlement grant failed', insertError)
            return new Response('entitlement grant failed', { status: 500 }) // Stripe će retry-ati
          }
        }

        // 2) Interni AI-compute spend-guard (wallet) — nepromijenjeni mehanizam,
        // samo više nije primarni proizvod korisniku.
        const { error: walletError } = await db.rpc('katedra_grant', {
          p_user: userId,
          p_tokens: tokens,
          p_session: s.id,          // idempotencija — ista sesija prolazi samo jednom
          p_amount: amount,
        })
        if (walletError) {
          console.error('katedra_grant failed', walletError)
          return new Response('grant failed', { status: 500 }) // Stripe će retry-ati
        }

        // SharedAnalyticsEvent shape (lib/academic-suite/contracts.ts) bez backend
        // sinka — nova events tablica ide kroz Lekta migraciju prvo (CLAUDE.md
        // "Database authority rule"). Do tada strukturirani function log ostaje
        // jedini trag; trivijalno zamjenjivo INSERT-om kad tablica postoji.
        console.log(JSON.stringify({
          eventName: 'purchase_completed', occurredAt: new Date().toISOString(),
          userId, projectId, app: 'katedra',
          properties: { productKey, tokens, amountEur: amount, stripeSessionId: s.id },
        }))
      }
    }
  }

  return new Response('ok')
}
