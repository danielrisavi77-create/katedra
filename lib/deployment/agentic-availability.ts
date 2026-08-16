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
 * Web research is advertised only when the server-side gateway, model and
 * explicit policy approval are all configured. The browser never receives the
 * gateway key or routing details.
 */
export function isAgentWebResearchAvailable(env: RuntimeEnvironment = process.env): boolean {
  return isApprovedGatewayAvailable(env, {
    approvalKey: 'KATEDRA_RESEARCH_POLICY_APPROVED',
    urlKey: 'KATEDRA_RESEARCH_PROVIDER_URL',
    keyKey: 'KATEDRA_RESEARCH_PROVIDER_KEY',
    modelKey: 'KATEDRA_RESEARCH_PROVIDER_MODEL',
  })
}

/**
 * An independent verifier adapter is optional, but it must never become
 * available merely because the primary text provider is configured. Keeping
 * this separate makes provider diversity an explicit release decision rather
 * than an accidental routing side effect.
 */
export function isAgentVerifierProviderAvailable(env: RuntimeEnvironment = process.env): boolean {
  return isApprovedGatewayAvailable(env, {
    approvalKey: 'KATEDRA_VERIFIER_POLICY_APPROVED',
    urlKey: 'KATEDRA_VERIFIER_PROVIDER_URL',
    keyKey: 'KATEDRA_VERIFIER_PROVIDER_KEY',
    modelKey: 'KATEDRA_VERIFIER_PROVIDER_MODEL',
  })
}

function isApprovedGatewayAvailable(
  env: RuntimeEnvironment,
  config: { approvalKey: string, urlKey: string, keyKey: string, modelKey: string },
): boolean {
  if (!isAgenticWorkspaceAvailable(env)) return false
  if (env[config.approvalKey] !== 'true') return false
  if (!isConfigured(env[config.keyKey]) || !isConfigured(env[config.modelKey])) return false
  try {
    return new URL(String(env[config.urlKey])).protocol === 'https:'
  } catch {
    return false
  }
}

function isConfigured(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && !value.trim().startsWith('REPLACE_')
}
