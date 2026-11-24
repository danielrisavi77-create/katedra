import { createClient } from '@/lib/supabase/server'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { resolveProjectCapability } from '@/lib/product/server-capabilities'
import { privateJson } from '@/lib/observability/private-response.js'

export async function GET(request) {
  const projectId = new URL(request.url).searchParams.get('projectId')?.trim() || ''
  if (!projectId) return privateJson({ error: 'Nedostaje projekt.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })
  const owned = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId, allowGuestAlias: true })
  if (!owned.ok) return privateJson({ error: 'Vlasništvo projekta nije moguće provjeriti.' }, { status: 503 })
  if (!owned.value) return privateJson({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const canonicalProjectId = owned.value.projectId

  const [researchDesign, methodology] = await Promise.all([
    resolveProjectCapability(supabase, { userId: user.id, projectId: canonicalProjectId, capability: 'research_design' }),
    resolveProjectCapability(supabase, { userId: user.id, projectId: canonicalProjectId, capability: 'methodology' }),
  ])
  const decisions = { researchDesign, methodology }

  return privateJson({
    projectId: canonicalProjectId,
    capabilities: decisions,
    researchModulesEnabled: process.env.KATEDRA_RESEARCH_MODULES_ENABLED === 'true',
  })
}
