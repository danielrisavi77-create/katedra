// ============================================================
// KATEDRA — Stripe webhook: uplata → krediti (idempotentno)
// Stripe dashboard → Webhooks → endpoint: /api/webhook
// event: checkout.session.completed
//
// Idempotencija: katedra_topups.stripe_session_id je UNIQUE, a
// katedra_grant RPC radi "on conflict do nothing" na toj koloni —
// ista Stripe sesija (pa i ponovljena dostava istog eventa) prolazi
// samo jednom, bez potrebe za posebnim event-ledgerom.
// ============================================================
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

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
      const tokens = Number(s.metadata?.tokens ?? 0)
      const amount = Number(s.metadata?.amount_eur ?? 0)

      if (userId && tokens > 0 && s.payment_status === 'paid') {
        const db = createAdminClient()
        const { error } = await db.rpc('katedra_grant', {
          p_user: userId,
          p_tokens: tokens,
          p_session: s.id,          // idempotencija — ista sesija prolazi samo jednom
          p_amount: amount,
        })
        if (error) {
          console.error('katedra_grant failed', error)
          return new Response('grant failed', { status: 500 }) // Stripe će retry-ati
        }
      }
    }
  }

  return new Response('ok')
}
