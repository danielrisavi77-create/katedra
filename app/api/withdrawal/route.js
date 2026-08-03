// ============================================================
// KATEDRA — Jednostrani raskid ugovora (Zakon o zaštiti potrošača, čl. 81.a,
// NN 59/2026, na snazi od 19.6.2026)
//
// POST { reason?: string, referenceId?: string }
//
// Zapisuje zahtjev u withdrawal_requests (Lekta migracija 0049 — poslana kao
// PR na danielrisavi77-create/Lekta, čeka pregled/merge na Lekta strani; dok
// ne slegne, ovaj insert vraća 500 jer tablica još ne postoji) i automatski
// šalje potvrdu na trajnom mediju (e-mail, Resend) s točnim vremenom
// primitka — to je zakonski zahtjev, ne samo "lijepo imati". Običan e-mail
// kontakt sam po sebi ne zadovoljava zahtjev za vidljivu, uvijek-dostupnu
// funkciju u aplikaciji (v. app/uvjeti §5).
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

// 'onboarding@resend.dev' je Resendov test domain — radi bez verifikacije
// domene, ali NE smije ići u produkciju. Prije lansiranja postaviti
// WITHDRAWAL_FROM_EMAIL na verificiranu adresu (@katedra.hr) u Resend
// dashboardu i ovdje kroz env var.
const FROM_EMAIL = process.env.WITHDRAWAL_FROM_EMAIL || 'onboarding@resend.dev'

export async function POST(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  let body
  try { body = await req.json() } catch { body = {} }
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 2000) || null : null
  const referenceId = typeof body?.referenceId === 'string' ? body.referenceId.trim().slice(0, 200) || null : null

  const db = createAdminClient()
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
    console.error('[withdrawal] insert failed', insertError)
    return Response.json(
      { error: 'Zahtjev trenutno nije moguće zaprimiti. Pošalji e-mail na podrska@katedra.hr da ne izgubiš rok.' },
      { status: 500 },
    )
  }

  // Automatska potvrda na trajnom mediju (zakonski zahtjev) — šalje se prije
  // vraćanja odgovora, tako da confirmed_at točno odražava kad je stvarno
  // otišla, ne kad je enqueued.
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
      console.error('[withdrawal] confirmation email failed', emailError)
    }
  } else {
    console.error('[withdrawal] RESEND_API_KEY nije postavljen — automatska potvrda NIJE poslana (zakonski zahtjev nije u potpunosti zadovoljen dok se ne postavi)')
  }

  return Response.json({
    ok: true,
    requestId: row.id,
    requestedAt: row.requested_at,
    emailSent: !!confirmedAt,
  })
}
