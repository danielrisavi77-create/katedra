type RuntimeEnvironment = Record<string, unknown>

const REQUIRED_TRUE_FLAGS = [
  'KATEDRA_AGENT_RUNS_ENABLED',
  'KATEDRA_PROJECT_LOCKS_ENABLED',
  'KATEDRA_MATERIALS_ENABLED',
] as const

const REQUIRED_CONFIG = [
  'KATEDRA_AGENT_MODEL',
  'KATEDRA_BILLING_RPC_CONTRACT',
  'KATEDRA_RATE_LIMIT_STORE',
  'KATEDRA_WORKER_APP_URL',
  'KATEDRA_AGENT_WORKER_TOKEN',
  'KATEDRA_AGENT_WORKER_CRON_SECRET',
  'ANTHROPIC_API_KEY',
] as const

/**
 * The browser-facing availability bit must mean that the complete workflow
 * can actually start. Feature flags alone are not enough: otherwise the UI
 * offers autonomous work while the worker, billing contract, or private
 * material path is still missing and the first click only produces a 503.
 */
export function isAgenticWorkspaceAvailable(env: RuntimeEnvironment = process.env): boolean {
  if (REQUIRED_TRUE_FLAGS.some((key) => env[key] !== 'true')) return false
  if (env.KATEDRA_BILLING_RPC_CONTRACT !== 'v2') return false
  if (env.KATEDRA_RATE_LIMIT_STORE !== 'supabase') return false
  if (env.KATEDRA_MATERIAL_DELETE_RPC_CONTRACT !== 'v1') return false
  if (REQUIRED_CONFIG.some((key) => !isConfigured(env[key]))) return false

  try {
    return new URL(String(env.KATEDRA_WORKER_APP_URL)).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Web research remains unavailable until the canonical policy source and a
 * provider adapter are deployed. The current worker only has text capability.
 */
export function isAgentWebResearchAvailable(_env: RuntimeEnvironment = process.env): boolean {
  return false
}

function isConfigured(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && !value.trim().startsWith('REPLACE_')
}
