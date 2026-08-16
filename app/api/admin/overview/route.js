import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminAccess } from '@/lib/auth/admin-access'
import { privateJson } from '@/lib/observability/private-response.js'
import { logOperationalEvent } from '@/lib/observability/operational-events'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })

  const access = getAdminAccess(user)
  if (!access.allowed) return privateJson({ error: 'Admin pristup nije dopušten.' }, { status: 403 })

  let db
  try {
    db = createAdminClient()
  } catch (error) {
    logOperationalEvent({
      eventName: 'admin_overview_admin_client_unavailable',
      userId: user.id,
      error,
    }, 'error')
    return privateJson({ error: 'Admin pregled trenutno nije dostupan.' }, { status: 503 })
  }
  const [projects, agentRuns, usage] = await Promise.all([
    safeQuery(() => db.from('katedra_projects')
      .select('project_id, topic, unit_id, profile_id, work_type, work_type_canonical, deadline, lekta_score, lekta_checked_at, updated_at, user_id')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })),
    safeQuery(() => db.from('agent_runs')
      .select('run_id, project_id, mode, source_policy, status, created_at, updated_at, user_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)),
    safeQuery(() => db.from('katedra_usage')
      .select('input_tokens, output_tokens, charged, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500)),
  ])

  return privateJson({
    admin: { enabled: true, reason: access.reason },
    user: { id: user.id, email: user.email || null },
    projects: projects.error ? null : projects.data,
    agentRuns: agentRuns.error ? null : agentRuns.data,
    usage: usage.error ? null : summarizeUsage(usage.data),
    featureFlags: {
      projectLocks: process.env.KATEDRA_PROJECT_LOCKS_ENABLED === 'true',
      agentRuns: process.env.KATEDRA_AGENT_RUNS_ENABLED === 'true',
      materials: process.env.KATEDRA_MATERIALS_ENABLED === 'true',
      billingContract: process.env.KATEDRA_BILLING_RPC_CONTRACT || 'not_configured',
    },
    warnings: [
      ...(projects.error ? ['Projekti nisu dostupni.'] : []),
      ...(agentRuns.error ? ['Agent runovi nisu dostupni; Lekta ugovor možda još nije aktivan.'] : []),
      ...(usage.error ? ['AI potrošnja nije dostupna.'] : []),
    ],
  })
}

function summarizeUsage(rows) {
  return rows.reduce((summary, row) => ({
    requests: summary.requests + 1,
    inputTokens: summary.inputTokens + Number(row.input_tokens || 0),
    outputTokens: summary.outputTokens + Number(row.output_tokens || 0),
    charged: summary.charged + Number(row.charged || 0),
  }), { requests: 0, inputTokens: 0, outputTokens: 0, charged: 0 })
}

async function safeQuery(run) {
  try {
    const result = await run()
    return { data: result.data || [], error: result.error || null }
  } catch (error) {
    return { data: [], error }
  }
}
