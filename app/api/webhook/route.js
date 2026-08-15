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
// Faza 1 stavka 3 — insert shape VERIFICIRAN izravno protiv Lekta repozitorija
// (danielrisavi77-create/Lekta), ne pretpostavljen:
// - supabase/migrations/0001_monetization.sql: entitlements ima
//   (user_id, work_type, slots_total, status, order_id, provider,
//   purchase_expires_at) — work_type CHECK ('seminarski'|'zavrsni'|
//   'diplomski'|'doktorski'), unique(provider, order_id) za idempotenciju.
//   NEMA scope/capabilities/source_product_id kolona (stariji Katedra kod je
//   na te kolone pisao — svaka bi kupnja pukla na insertu).
// - supabase/migrations/0002_products_catalog.sql: entitlements.product_id
//   je NULLABLE FK na products(id). Lekta katalog nema SKU za Katedrin
//   bundlani "Pass" (ima samo slot_*/bundle_*/pass_semestralni pojedinačne
//   Lekta provjere) — zato product_id ostaje null dok se katalog ne uskladi
//   (zaseban, poslovni dogovor s Lekta stranom, ne nešto što ovaj webhook
//   smije sam izmisliti).
// - supabase/migrations/0035_academic_suite_foundation.sql:
//   entitlements.academic_project_id (uuid, nullable FK na
//   academic_projects.id) + trigger koji odbija insert ako project
//   pripada drugom korisniku.
// - supabase/functions/webhook-mor/index.ts + src/report/webhook.ts
//   (buildEntitlementInsert): Lekta svoj webhook radi identičnim obrascem
//   (service-role insert direktno u entitlements) — insert-pa-uhvati-23505
//   umjesto SELECT-prije-INSERT race-a, repliciran ovdje.
// - src/report/slot-logic.ts: 1 slot = 1 rad, re-check ISTOG otiska u istom
//   prozoru je besplatan — poklapa se točno s "Lekta re-checkovi u Passu
//   slobodno neograničeni" (VIZIJA.md), pa slots_total=1 po Pass kupnji.
//
// Idempotencija: katedra_topups.stripe_session_id je UNIQUE, a katedra_grant
// RPC radi "on conflict do nothing" na toj koloni za wallet dio. Za
// entitlements idempotencija dolazi iz stvarnog unique(provider, order_id)
// constrainta (provider='stripe', order_id=Stripe session id) — insert pa
// 23505 = već grantano, nastavi na wallet dio.
// ============================================================
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getKatedraPackage, PURCHASE_WINDOW_DAYS } from '@/lib/stripe/catalog'
import { validateCheckoutConfirmation } from '../../../lib/stripe/checkout-validation.js'
import { refundDuplicateProjectPass } from '../../../lib/stripe/duplicate-refund.js'
import { katedraPassProductFilter, katedraPassProductId } from '../../../lib/katedra-pass-catalog.js'
import { lockPaidProject } from '../../../lib/academic-suite/project-lock'
import { getRequestId, withRequestId } from '../../../lib/observability/request-id.js'

// purchaseWindowDays: koliko dugo Pass vrijedi za trošenje slota, po tipu
// rada — diplomski/zavrsni radovi traju dulje od seminarskih, pa dulji
// prozor. Lektin vlastiti katalog ide 90-180 dana za usporedive tipove
// (supabase/migrations/0002_products_catalog.sql); Katedrin Pass je
// namjerno velikodušniji jer pokriva cijeli proces, ne samo jednu provjeru.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req) {
  return withRequestId(await handlePOST(req), getRequestId(req))
}

async function handlePOST(req) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('no signature', { status: 400 })

  const stripe = getStripe()

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
      const projectLocksEnabled = process.env.KATEDRA_PROJECT_LOCKS_ENABLED === 'true'
      if (process.env.NODE_ENV === 'production' && !projectLocksEnabled) {
        console.error(JSON.stringify({ eventName: 'webhook_project_lock_contract_unavailable', sessionId: s.id }))
        return new Response('project lock contract unavailable', { status: 503 })
      }
      if (process.env.NODE_ENV === 'production' && process.env.KATEDRA_BILLING_RPC_CONTRACT !== 'v2') {
        console.error(JSON.stringify({ eventName: 'webhook_billing_contract_unavailable', sessionId: s.id }))
        return new Response('billing contract unavailable', { status: 503 })
      }
      const userId = s.metadata?.user_id
      const projectId = s.metadata?.academic_project_id
       const productKey = s.metadata?.product_key
       const tokens = Number(s.metadata?.tokens ?? 0)
       const amount = Number(s.metadata?.amount_eur ?? 0)

       if (s.payment_status !== 'paid') return new Response('ignored')
       const pkg = getKatedraPackage(productKey)
       if (!userId || !projectId || !pkg || tokens !== pkg.tokens || amount !== pkg.eur) {
         console.error('invalid paid session metadata', { sessionId: s.id, productKey })
         return new Response('invalid metadata', { status: 400 })
       }

       if (userId && projectId && pkg && tokens === pkg.tokens && amount === pkg.eur && s.payment_status === 'paid') {
         const db = createAdminClient()

         if (!UUID_RE.test(projectId)) {
           console.error('invalid canonical project id in paid session', { projectId, sessionId: s.id })
           return new Response('invalid project', { status: 400 })
         }
         if (s.currency !== 'eur' || s.amount_total !== Math.round(pkg.eur * 100)) {
           console.error('paid session catalog mismatch', {
             sessionId: s.id, productKey, currency: s.currency, amountTotal: s.amount_total,
           })
           return new Response('catalog mismatch', { status: 400 })
         }

         const { data: project, error: projectError } = await db
           .from('katedra_projects')
           .select('user_id, project_id, topic')
           .eq('user_id', userId)
           .eq('project_id', projectId)
           .maybeSingle()
         if (projectError || !project) {
           console.error('paid session project ownership mismatch', { sessionId: s.id, userId, projectId })
           return new Response('invalid project', { status: 400 })
         }

         if (projectLocksEnabled) {
           const confirmation = validateCheckoutConfirmation({
             topic: s.metadata?.topic,
             projectTopic: project.topic,
             lockConfirmation: s.metadata?.lock_confirmation === 'true',
           })
           if (!confirmation.ok) {
             console.error('paid session lock confirmation mismatch', { sessionId: s.id, userId, projectId })
             return new Response('invalid lock confirmation', { status: confirmation.status })
           }
         }

         // 1) PRAVI PASS — entitlement vezan uz ovaj projekt. Stvarne kolone
        // (v. napomena na vrhu datoteke) — ne scope/capabilities/source_product_id.
         const windowDays = PURCHASE_WINDOW_DAYS[productKey]
         const productId = katedraPassProductId(productKey)
          if (!windowDays || !productId) {
           console.error('unknown product_key for entitlement window', { productKey })
           return new Response('unknown product', { status: 400 }) // ne retry-aj, konfiguracijska greška
         }

         // Checkout performs the same check optimistically, but Stripe can
         // deliver two paid sessions created by concurrent tabs. A different
         // active Pass for the same project must not receive another
         // entitlement or wallet grant. The Lekta-side unique/RPC contract
         // remains the atomic authority; this query is defense in depth and
         // gives the webhook a safe sequential retry behavior.
         const { data: activePass, error: activePassError } = await db
           .from('entitlements')
           .select('id, order_id')
           .eq('user_id', userId)
           .eq('academic_project_id', projectId)
           .eq('provider', 'stripe')
           .or(katedraPassProductFilter())
           .eq('status', 'active')
           .gt('purchase_expires_at', new Date().toISOString())
           .limit(1)
           .maybeSingle()
         if (activePassError) {
           console.error('active project pass lookup failed', { sessionId: s.id, userId, projectId, error: activePassError.message })
           return new Response('active pass lookup failed', { status: 500 })
         }
         if (activePass && activePass.order_id !== s.id) {
           const refund = await refundDuplicateProjectPass(stripe, {
             sessionId: s.id,
             paymentIntent: s.payment_intent,
           })
           if (!refund.ok) {
             console.error(JSON.stringify({
               eventName: 'duplicate_project_pass_reconciliation_pending',
               sessionId: s.id,
               existingOrderId: activePass.order_id,
               userId,
               projectId,
               reason: refund.reason,
             }))
             return new Response('duplicate refund pending', { status: 500 })
           }
           console.log(JSON.stringify({
             eventName: 'duplicate_project_pass_refunded',
             sessionId: s.id,
             existingOrderId: activePass.order_id,
             refundId: refund.refundId,
             userId,
             projectId,
           }))
           return new Response('ok')
         }
         if (projectLocksEnabled) {
           const lockResult = await lockPaidProject(db, {
             userId,
             projectId,
             topic: String(s.metadata?.topic || project.topic || '').trim(),
             workType: productKey,
             productKey,
             paymentId: s.id,
             lockedAt: new Date().toISOString(),
           })
           if (!lockResult.ok) {
             console.error('paid project lock failed', { sessionId: s.id, userId, projectId, error: lockResult.error })
             return new Response('project lock failed', { status: 500 })
           }
         }

         const { error: insertError } = await db.from('entitlements').insert({
          user_id: userId,
          work_type: productKey, // 'seminarski'|'zavrsni'|'diplomski' — isti rječnik kao entitlements.work_type CHECK
          slots_total: 1,        // 1 Pass = 1 rad; re-check istog otiska je besplatan (src/report/slot-logic.ts)
          product_id: productId,
          order_id: s.id,        // Stripe session id — jedinstven, nosi unique(provider, order_id) idempotenciju
          provider: 'stripe',
          purchase_expires_at: new Date(Date.now() + windowDays * 24 * 3600 * 1000).toISOString(),
          academic_project_id: UUID_RE.test(projectId) ? projectId : null,
        })
        // 23505 = unique(provider, order_id) već pogođen (retry iste Stripe sesije) — grant je već izvršen.
        if (insertError && insertError.code !== '23505') {
          console.error('entitlement grant failed', insertError)
          return new Response('entitlement grant failed', { status: 500 }) // Stripe će retry-ati
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
