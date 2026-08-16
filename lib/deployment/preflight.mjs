export const REQUIRED_PRODUCTION_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'WITHDRAWAL_FROM_EMAIL',
  'NEXT_PUBLIC_APP_URL',
  'KATEDRA_BILLING_RPC_CONTRACT',
  'KATEDRA_RATE_LIMIT_STORE',
  'KATEDRA_PROJECT_LOCKS_ENABLED',
]

function isConfigured(value) {
  return typeof value === 'string' && value.trim() && !value.trim().startsWith('REPLACE_')
}

export function evaluateProductionEnvironment(env = process.env) {
  const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !isConfigured(env[key]))
  const invalid = []

  if (env.KATEDRA_MATERIALS_ENABLED === 'true') {
    if (!isConfigured(env.KATEDRA_MATERIAL_DELETE_RPC_CONTRACT)) {
      missing.push('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT')
    } else if (env.KATEDRA_MATERIAL_DELETE_RPC_CONTRACT !== 'v1') {
      invalid.push('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT')
    }
  }

  if (env.KATEDRA_AGENT_RUNS_ENABLED === 'true') {
    if (!isConfigured(env.KATEDRA_AGENT_WORKER_TOKEN)) missing.push('KATEDRA_AGENT_WORKER_TOKEN')
    if (!isConfigured(env.KATEDRA_AGENT_MODEL)) missing.push('KATEDRA_AGENT_MODEL')
    if (!isConfigured(env.KATEDRA_WORKER_APP_URL)) missing.push('KATEDRA_WORKER_APP_URL')
    if (!isConfigured(env.KATEDRA_AGENT_WORKER_CRON_SECRET)) missing.push('KATEDRA_AGENT_WORKER_CRON_SECRET')
  }

  if (isConfigured(env.NEXT_PUBLIC_APP_URL)) {
    try {
      if (new URL(env.NEXT_PUBLIC_APP_URL).protocol !== 'https:') invalid.push('NEXT_PUBLIC_APP_URL')
    } catch {
      invalid.push('NEXT_PUBLIC_APP_URL')
    }
  }
  if (isConfigured(env.KATEDRA_WORKER_APP_URL)) {
    try {
      if (new URL(env.KATEDRA_WORKER_APP_URL).protocol !== 'https:') invalid.push('KATEDRA_WORKER_APP_URL')
    } catch {
      invalid.push('KATEDRA_WORKER_APP_URL')
    }
  }
  if (isConfigured(env.WITHDRAWAL_FROM_EMAIL) && /@resend\.dev$/i.test(env.WITHDRAWAL_FROM_EMAIL.trim())) invalid.push('WITHDRAWAL_FROM_EMAIL')
  if (isConfigured(env.KATEDRA_BILLING_RPC_CONTRACT) && env.KATEDRA_BILLING_RPC_CONTRACT !== 'v2') invalid.push('KATEDRA_BILLING_RPC_CONTRACT')
  if (isConfigured(env.KATEDRA_RATE_LIMIT_STORE) && env.KATEDRA_RATE_LIMIT_STORE !== 'supabase') invalid.push('KATEDRA_RATE_LIMIT_STORE')
  if (isConfigured(env.KATEDRA_PROJECT_LOCKS_ENABLED) && env.KATEDRA_PROJECT_LOCKS_ENABLED !== 'true') invalid.push('KATEDRA_PROJECT_LOCKS_ENABLED')

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing: [...new Set(missing)],
    invalid: [...new Set(invalid)],
  }
}
