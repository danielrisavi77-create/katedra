// ============================================================
// KATEDRA — stanje Passa (za header + proaktivni paywall,
// bez čekanja na 402 iz chata)
//
// Audit 4: primarni signal korisniku je Pass status po projektu, ne sirovi
// wallet balance. balance/low ostaju u odgovoru za interne proaktivne
// provjere (v. katedraNeedsPass u katedra-engine.js), ne za prikaz broja.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { MIN_BALANCE } from '@/lib/limits'

const PASS_SCOPES = ['academic-pass', 'academic-pass-plus']

export async function GET(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const { data: wallet } = await supabase
    .from('katedra_wallets')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()
  const balance = wallet?.balance ?? 0

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

  return Response.json({ hasPass, balance, low: balance < MIN_BALANCE })
}
