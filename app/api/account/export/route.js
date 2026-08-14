import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  let projectResult
  try {
    projectResult = await supabase.from('katedra_projects').select('project_id, guest_project_id, topic, unit_id, profile_id, work_type, work_type_canonical, deadline, lekta_score, lekta_checked_at, updated_at').eq('user_id', user.id)
  } catch {
    return Response.json({ error: 'Izvoz trenutačno nije dostupan.' }, { status: 503 })
  }
  if (projectResult.error) return Response.json({ error: 'Izvoz trenutačno nije dostupan.' }, { status: 503 })
  return Response.json({ exportedAt: new Date().toISOString(), user: { id: user.id, email: user.email || null }, projects: projectResult.data || [] })
}
