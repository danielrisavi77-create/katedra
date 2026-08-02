// ============================================================
// KATEDRA — stanje kredita (za header + proaktivni paywall,
// bez čekanja na 402 iz chata)
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { MIN_BALANCE } from '@/lib/limits'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const { data: wallet } = await supabase
    .from('katedra_wallets')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()
  const balance = wallet?.balance ?? 0

  return Response.json({ balance, low: balance < MIN_BALANCE })
}
