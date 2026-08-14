import { createClient } from '@/lib/supabase/server'
import { katedraPassProductFilter } from '@/lib/katedra-pass-catalog.js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const [projects, passes, usage] = await Promise.all([
    safeQuery(() => supabase.from('katedra_projects').select('project_id, guest_project_id, topic, unit_id, profile_id, work_type, work_type_canonical, deadline, lekta_score, lekta_checked_at, updated_at').eq('user_id', user.id).order('updated_at', { ascending: false })),
    safeQuery(() => supabase.from('entitlements').select('id, academic_project_id, product_id, work_type, status, purchase_expires_at, created_at').eq('user_id', user.id).eq('provider', 'stripe').or(katedraPassProductFilter()).order('created_at', { ascending: false })),
    safeQuery(() => supabase.from('katedra_usage').select('input_tokens, output_tokens, charged, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500)),
  ])

  const usageSummary = (usage.data || []).reduce((summary, row) => ({
    requests: summary.requests + 1,
    inputTokens: summary.inputTokens + Number(row.input_tokens || 0),
    outputTokens: summary.outputTokens + Number(row.output_tokens || 0),
    charged: summary.charged + Number(row.charged || 0),
  }), { requests: 0, inputTokens: 0, outputTokens: 0, charged: 0 })

  return Response.json({
    user: { id: user.id, email: user.email || null },
    projects: projects.data || [],
    passes: passes.data || [],
    usage: usageSummary,
    warnings: [...(projects.error ? ['Projekti trenutačno nisu dostupni.'] : []), ...(passes.error ? ['Status Passova trenutačno nije dostupan.'] : [])],
  })
}

async function safeQuery(run) {
  try {
    const result = await run()
    return { data: result.data || [], error: result.error || null }
  } catch (error) {
    return { data: [], error }
  }
}
