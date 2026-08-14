import { createClient } from '@/lib/supabase/server'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  let body
  try { body = await request.json() } catch { body = null }
  if (body?.confirmation !== 'OBRIŠI RAČUN') return Response.json({ error: 'Potrebna je eksplicitna potvrda.' }, { status: 400 })
  if (process.env.KATEDRA_ACCOUNT_DELETE_ENABLED !== 'true') {
    return Response.json({ error: 'Brisanje računa još nije aktivirano na canonical backendu.' }, { status: 503 })
  }
  return Response.json({ error: 'Brisanje računa mora izvršiti canonical identity servis.' }, { status: 503 })
}
