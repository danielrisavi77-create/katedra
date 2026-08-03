// ============================================================
// KATEDRA — stanje Passa (za header + proaktivni paywall,
// bez čekanja na 402 iz chata)
//
// Audit 4: primarni signal korisniku je Pass status po projektu, ne sirovi
// wallet balance. balance/low ostaju u odgovoru za interne proaktivne
// provjere (v. katedraNeedsPass u katedra-engine.js), ne za prikaz broja.
//
// FIX: ova ruta mora dodijeliti isti free-starter budžet kao /api/chat PRIJE
// nego pročita balance — inače je za posve nov projekt balance=0, low=true,
// pa klijent (katedraNeedsPass) proaktivno prikaže paywall i NIKAD ne pozove
// /api/chat, gdje se grant stvarno dogadao. Rezultat bez ovoga: obećana
// "jedna besplatna intervencija" (Audit 4 §16-17) je bila nedostižna kroz
// normalan UI tok. V. lib/katedra-free-starter.js za idempotentni mehanizam.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MIN_BALANCE } from '@/lib/limits'
import { ensureFreeStarterGrant } from '@/lib/katedra-free-starter'

const PASS_SCOPES = ['academic-pass', 'academic-pass-plus']

export async function GET(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  let hasPass = false
  if (projectId) {
    const { data: entitlement } = await supabase
      .from('entitlements')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .in('scope', PASS_SCOPES)
      .eq('status', 'active')
      .maybeSingle()
    hasPass = Boolean(entitlement)
  }

  if (!hasPass && projectId) {
    await ensureFreeStarterGrant(createAdminClient(), user.id, projectId)
  }

  const { data: wallet } = await supabase
    .from('katedra_wallets')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()
  const balance = wallet?.balance ?? 0

  return Response.json({ hasPass, balance, low: balance < MIN_BALANCE })
}
