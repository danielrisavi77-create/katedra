// ============================================================
// KATEDRA — Jednostrani raskid ugovora (Zakon o zaštiti potrošača, čl. 81.a,
// NN 59/2026, na snazi od 19.6.2026)
//
// POST { reason?: string, referenceId?: string }
//
// Zapisuje zahtjev u withdrawal_requests nakon što Lekta deploya tablicu i
// durable reservation contract. Trenutni connected schema još nema tu tablicu;
// ruta zato vraća kontrolirani 503 umjesto da glumi uspješan legalni prijem.
// Nakon upisa automatski
// šalje potvrdu na trajnom mediju (e-mail, Resend) s točnim vremenom
// primitka — to je zakonski zahtjev, ne samo "lijepo imati". Običan e-mail
// kontakt sam po sebi ne zadovoljava zahtjev za vidljivu, uvijek-dostupnu
// funkciju u aplikaciji (v. app/uvjeti §5).
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { isDistributedWithdrawalConfigured, reserveDistributedWithdrawal } from '@/lib/security/withdrawal-reservation'
import { reserveWithdrawal } from '@/lib/security/withdrawal-limit'
import { getRequestId, withRequestId } from '../../../lib/observability/request-id.js'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'
import { logOperationalEvent } from '../../../lib/observability/operational-events'

// 'onboarding@resend.dev' je Resendov test domain — radi bez verifikacije
// domene, ali NE smije ići u produkciju. Prije lansiranja postaviti
// WITHDRAWAL_FROM_EMAIL na verificiranu adresu (@katedra.hr) u Resend
// dashboardu i ovdje kroz env var.
const FROM_EMAIL = process.env.WITHDRAWAL_FROM_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'onboarding@resend.dev')

export async function POST(req) {
  return withRequestId(await handlePOST(req), getRequestId(req))
}

async function handlePOST(req) {
  const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return Response.json({ error: origin.error }, { status: origin.status })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const parsed = await readJsonBody(req, JSON_BODY_LIMITS.withdrawal)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 2000) || null : null
  const referenceId = typeof body?.referenceId === 'string' ? body.referenceId.trim().slice(0, 200) || null : null

  let db
  try {
    db = createAdminClient()
  } catch (error) {
    logOperationalEvent({
      eventName: 'withdrawal_admin_client_unavailable',
      userId: user.id,
      error,
    }, 'error')
    return Response.json({ error: 'Zahtjev trenutno nije moguće zaprimiti.' }, { status: 503 })
  }
  const distributedStore = isDistributedWithdrawalConfigured()
  if (process.env.NODE_ENV === 'production' && !distributedStore) {
    console.error('[withdrawal] durable reservation store is not configured')
    return Response.json({ error: 'Zahtjev trenutno nije moguće zaprimiti.' }, { status: 503 })
  }

  const reservation = distributedStore
    ? await reserveDistributedWithdrawal(db, { userId: user.id, referenceId })
    : reserveWithdrawal(user.id, referenceId)
  if (!reservation.allowed) {
    if (reservation.reason === 'duplicate') {
      return Response.json({ error: 'Ovaj zahtjev je već zaprimljen.' }, { status: 409 })
    }
    if (reservation.reason === 'unavailable') {
      return Response.json({ error: 'Zahtjev trenutno nije moguće zaprimiti.' }, { status: 503 })
    }
    return Response.json({ error: 'Previše zahtjeva. Pokušaj ponovno kasnije.' }, { status: 429 })
  }

  if (process.env.NODE_ENV === 'production' && (!process.env.RESEND_API_KEY || !FROM_EMAIL)) {
    console.error('[withdrawal] production email configuration is incomplete')
    await safeRelease(reservation, user.id, referenceId)
    return Response.json({ error: 'Zahtjev trenutno nije moguće zaprimiti.' }, { status: 503 })
  }

  const requestedAt = new Date()

  const { data: row, error: insertError } = await db
    .from('withdrawal_requests')
    .insert({
      user_id: user.id,
      app: 'katedra',
      reference_id: referenceId,
      reason,
      contact_email: user.email,
      requested_at: requestedAt.toISOString(),
    })
    .select('id, requested_at')
    .single()

  if (insertError) {
    logOperationalEvent({ eventName: 'withdrawal_insert_failed', userId: user.id, error: insertError }, 'error')
    await safeRelease(reservation, user.id, referenceId)
    const missingWithdrawalContract = insertError?.code === '42P01' || insertError?.code === 'PGRST205'
    return Response.json(
      {
        error: missingWithdrawalContract
          ? 'Zahtjev trenutno nije moguće zaprimiti jer withdrawal sustav nije konfiguriran.'
          : 'Zahtjev trenutno nije moguće zaprimiti. Pošalji e-mail na podrska@katedra.hr da ne izgubiš rok.',
      },
      { status: missingWithdrawalContract ? 503 : 500 },
    )
  }

  // Automatska potvrda na trajnom mediju (zakonski zahtjev) — šalje se prije
  // vraćanja odgovora, tako da confirmed_at točno odražava kad je stvarno
  // otišla, ne kad je enqueued.
  let reservationCommitPending = false
  try {
    await reservation.commit(row.id)
  } catch (commitError) {
    // The request row is already durable. Keep an explicit reconciliation
    // signal instead of releasing a possibly live reservation.
    reservationCommitPending = true
    logOperationalEvent({ eventName: 'withdrawal_reservation_commit_pending', userId: user.id, error: commitError }, 'error')
  }

  let confirmedAt = null
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const fmt = requestedAt.toLocaleString('hr-HR', { dateStyle: 'long', timeStyle: 'medium', timeZone: 'Europe/Zagreb' })
      await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: 'Potvrda zaprimljenog zahtjeva za raskid ugovora — Katedra',
        text: `Zaprimili smo tvoj zahtjev za jednostrani raskid ugovora.\n\nVrijeme primitka: ${fmt}\nBroj zahtjeva: ${row.id}\n\nObradit ćemo zahtjev i javiti se na ovu adresu. Ako imaš pitanja, odgovori na ovaj e-mail ili piši na podrska@katedra.hr.\n\n— Katedra`,
      })
      confirmedAt = new Date()
      await db.from('withdrawal_requests')
        .update({ status: 'confirmed', confirmed_at: confirmedAt.toISOString() })
        .eq('id', row.id)
    } catch (emailError) {
      // Zahtjev je već spremljen (ima requested_at) — propust slanja e-maila
      // ne smije izgubiti sam zahtjev. Zabilježi i nastavi; podrška može
      // ručno potvrditi korisniku.
      logOperationalEvent({ eventName: 'withdrawal_confirmation_email_failed', userId: user.id, error: emailError }, 'error')
    }
  } else {
    console.error('[withdrawal] RESEND_API_KEY nije postavljen — automatska potvrda NIJE poslana (zakonski zahtjev nije u potpunosti zadovoljen dok se ne postavi)')
  }

  return Response.json({
    ok: true,
    requestId: row.id,
    requestedAt: row.requested_at,
    emailSent: !!confirmedAt,
    reconciliationPending: reservationCommitPending,
  })
}

async function safeRelease(reservation, userId, referenceId) {
  try {
    await reservation.release()
  } catch (error) {
    logOperationalEvent({ eventName: 'withdrawal_reservation_release_pending', userId, reason: referenceId ? 'reference_present' : 'reference_absent', error }, 'error')
    try {
      await reservation.release()
    } catch (retryError) {
      logOperationalEvent({ eventName: 'withdrawal_reservation_release_retry_pending', userId, reason: referenceId ? 'reference_present' : 'reference_absent', error: retryError }, 'error')
    }
  }
}
