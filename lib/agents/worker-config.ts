const REQUIRED_WORKER_CONFIG = ['KATEDRA_AGENT_MODEL', 'KATEDRA_BILLING_RPC_CONTRACT', 'KATEDRA_RATE_LIMIT_STORE'] as const

type WorkerEnvironment = Record<string, unknown>

export type AgentWorkerConfiguration =
  | { ok: true; model: string }
  | { ok: false; missing: string[]; invalid: string[] }

export function resolveAgentWorkerConfiguration(env: WorkerEnvironment = process.env): AgentWorkerConfiguration {
  const missing = REQUIRED_WORKER_CONFIG.filter((key) => !isConfigured(env[key]))
  const invalid: string[] = []

  if (isConfigured(env.KATEDRA_BILLING_RPC_CONTRACT) && env.KATEDRA_BILLING_RPC_CONTRACT !== 'v2') {
    invalid.push('KATEDRA_BILLING_RPC_CONTRACT')
  }
  if (isConfigured(env.KATEDRA_RATE_LIMIT_STORE) && env.KATEDRA_RATE_LIMIT_STORE !== 'supabase') {
    invalid.push('KATEDRA_RATE_LIMIT_STORE')
  }

  if (missing.length || invalid.length) return { ok: false, missing, invalid }
  return { ok: true, model: String(env.KATEDRA_AGENT_MODEL).trim() }
}

function isConfigured(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && !value.trim().startsWith('REPLACE_')
}
