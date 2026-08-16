export const REQUIRED_AGENTIC_STAGING_ENV = [
  'KATEDRA_WORKER_APP_URL',
  'KATEDRA_AGENT_WORKER_TOKEN',
  'KATEDRA_AGENT_WORKER_CRON_SECRET',
  'KATEDRA_AGENT_MODEL',
  'KATEDRA_AGENT_RUNS_ENABLED',
  'KATEDRA_PROJECT_LOCKS_ENABLED',
  'KATEDRA_BILLING_RPC_CONTRACT',
  'KATEDRA_RATE_LIMIT_STORE',
  'KATEDRA_VERIFIER_PROVIDER_URL',
  'KATEDRA_VERIFIER_PROVIDER_KEY',
  'KATEDRA_VERIFIER_PROVIDER_MODEL',
  'KATEDRA_VERIFIER_POLICY_APPROVED',
]

function isConfigured(value) {
  return typeof value === 'string' && value.trim() && !value.trim().startsWith('REPLACE_')
}

export function evaluateAgenticStagingEnvironment(env = process.env) {
  const missing = REQUIRED_AGENTIC_STAGING_ENV.filter((key) => !isConfigured(env[key]))
  const invalid = []

  if (env.KATEDRA_MATERIALS_ENABLED === 'true') {
    if (!isConfigured(env.KATEDRA_MATERIAL_DELETE_RPC_CONTRACT)) {
      missing.push('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT')
    } else if (env.KATEDRA_MATERIAL_DELETE_RPC_CONTRACT !== 'v1') {
      invalid.push('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT')
    }
  }

  if (isConfigured(env.KATEDRA_WORKER_APP_URL)) {
    try {
      if (new URL(env.KATEDRA_WORKER_APP_URL).protocol !== 'https:') invalid.push('KATEDRA_WORKER_APP_URL')
    } catch {
      invalid.push('KATEDRA_WORKER_APP_URL')
    }
  }
  if (isConfigured(env.KATEDRA_AGENT_RUNS_ENABLED) && env.KATEDRA_AGENT_RUNS_ENABLED !== 'true') {
    invalid.push('KATEDRA_AGENT_RUNS_ENABLED')
  }
  if (isConfigured(env.KATEDRA_PROJECT_LOCKS_ENABLED) && env.KATEDRA_PROJECT_LOCKS_ENABLED !== 'true') {
    invalid.push('KATEDRA_PROJECT_LOCKS_ENABLED')
  }
  if (isConfigured(env.KATEDRA_BILLING_RPC_CONTRACT) && env.KATEDRA_BILLING_RPC_CONTRACT !== 'v2') {
    invalid.push('KATEDRA_BILLING_RPC_CONTRACT')
  }
  if (isConfigured(env.KATEDRA_RATE_LIMIT_STORE) && env.KATEDRA_RATE_LIMIT_STORE !== 'supabase') {
    invalid.push('KATEDRA_RATE_LIMIT_STORE')
  }
  if (isConfigured(env.KATEDRA_VERIFIER_POLICY_APPROVED) && env.KATEDRA_VERIFIER_POLICY_APPROVED !== 'true') {
    invalid.push('KATEDRA_VERIFIER_POLICY_APPROVED')
  }
  if (isConfigured(env.KATEDRA_VERIFIER_PROVIDER_URL)) {
    try {
      if (new URL(env.KATEDRA_VERIFIER_PROVIDER_URL).protocol !== 'https:') invalid.push('KATEDRA_VERIFIER_PROVIDER_URL')
    } catch {
      invalid.push('KATEDRA_VERIFIER_PROVIDER_URL')
    }
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing: [...new Set(missing)],
    invalid: [...new Set(invalid)],
  }
}
