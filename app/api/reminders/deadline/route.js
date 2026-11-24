import { createClient } from '@/lib/supabase/server'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'
import { privateJson } from '@/lib/observability/private-response.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })

  const projectId = new URL(request.url).searchParams.get('projectId')?.trim() || ''
  if (!UUID.test(projectId)) return privateJson({ error: 'Projekt nije canonical UUID.' }, { status: 400 })

  const owned = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if (!owned.ok) return privateJson({ error: 'Vlasništvo projekta nije moguće provjeriti.' }, { status: 503 })
  if (!owned.value) return privateJson({ error: 'Projekt nije pronađen.' }, { status: 404 })

  const { data, error } = await supabase.from('deadline_subscriptions')
    .select('deadline_date')
    .eq('user_id', user.id)
    .eq('academic_project_id', owned.value.projectId)
    .is('unsubscribed_at', null)
    .maybeSingle()
  if (error) return privateJson({ error: 'Podsjetnik nije moguće učitati.' }, { status: 503 })

  return privateJson({ enabled: Boolean(data), deadline: data?.deadline_date || null })
}

export async function POST(request) {
  const origin = validateSameOriginRequest(request, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return privateJson({ error: origin.error }, { status: origin.status })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return privateJson({ error: 'Prijavi se za e-mail podsjetnik.' }, { status: 401 })
  const body = await readJsonBody(request, JSON_BODY_LIMITS.state)
  if (!body.ok) return privateJson({ error: body.error }, { status: body.status })
  const value = body.value || {}
  const projectId = typeof value.projectId === 'string' ? value.projectId.trim() : ''
  const deadline = typeof value.deadline === 'string' ? value.deadline.trim() : ''
  if (!projectId || !UUID.test(projectId)) return privateJson({ error: 'Projekt nije canonical UUID.' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return privateJson({ error: 'Rok mora biti datum u formatu YYYY-MM-DD.' }, { status: 400 })
  if (value.consent !== true) return privateJson({ error: 'E-mail podsjetnik zahtijeva izričitu privolu.' }, { status: 400 })
  const owned = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if (!owned.ok) return privateJson({ error: 'Vlasništvo projekta nije moguće provjeriti.' }, { status: 503 })
  if (!owned.value) return privateJson({ error: 'Projekt nije pronađen.' }, { status: 404 })
  const { data: project, error: projectError } = await supabase.from('katedra_projects').select('unit_id, work_type_canonical, topic').eq('user_id', user.id).eq('project_id', owned.value.projectId).maybeSingle()
  if (projectError || !project) return privateJson({ error: 'Projekt nije moguće učitati.' }, { status: projectError ? 503 : 404 })
  const academicYear = deadline.slice(0, 4)
  const rawWorkType = project.work_type_canonical || owned.value.workType || 'project'
  const workType = rawWorkType === 'seminar' ? 'seminarski' : rawWorkType === 'final' ? 'zavrsni' : rawWorkType === 'graduate' ? 'diplomski' : rawWorkType
  const row = {
    user_id: user.id,
    academic_project_id: owned.value.projectId,
    faculty_id: project.unit_id || 'katedra',
    work_type: workType,
    academic_year: academicYear,
    deadline_date: deadline,
    deadline_source: 'katedra_project_user_reported',
    consent_at: new Date().toISOString(),
    unsubscribed_at: null,
  }
  const existing = await supabase.from('deadline_subscriptions').select('id').eq('user_id', user.id).eq('academic_project_id', owned.value.projectId).is('unsubscribed_at', null).maybeSingle()
  if (existing.error) return privateJson({ error: 'Postojeći podsjetnik nije moguće provjeriti.' }, { status: 503 })
  const result = existing.data
    ? await supabase.from('deadline_subscriptions').update(row).eq('id', existing.data.id).eq('user_id', user.id)
    : await supabase.from('deadline_subscriptions').insert(row)
  if (result.error) return privateJson({ error: 'E-mail podsjetnik nije moguće spremiti.' }, { status: 503 })
  return privateJson({ ok: true })
}

export async function DELETE(request) {
  const origin = validateSameOriginRequest(request, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return privateJson({ error: origin.error }, { status: origin.status })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })
  const projectId = new URL(request.url).searchParams.get('projectId')?.trim() || ''
  if (!UUID.test(projectId)) return privateJson({ error: 'Projekt nije canonical UUID.' }, { status: 400 })
  const owned = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if (!owned.ok) return privateJson({ error: 'Vlasništvo projekta nije moguće provjeriti.' }, { status: 503 })
  if (!owned.value) return privateJson({ error: 'Projekt nije pronađen.' }, { status: 404 })
  const result = await supabase.from('deadline_subscriptions').update({ unsubscribed_at: new Date().toISOString() }).eq('user_id', user.id).eq('academic_project_id', owned.value.projectId).is('unsubscribed_at', null)
  if (result.error) return privateJson({ error: 'Podsjetnik nije moguće isključiti.' }, { status: 503 })
  return privateJson({ ok: true })
}
