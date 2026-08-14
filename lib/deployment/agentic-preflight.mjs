export const REQUIRED_AGENTIC_STAGING_ENV = [
  'KATEDRA_WORKER_APP_URL',
  'KATEDRA_AGENT_WORKER_TOKEN',
  'KATEDRA_AGENT_WORKER_CRON_SECRET',
  'KATEDRA_AGENT_MODEL',
  'KATEDRA_AGENT_RUNS_ENABLED',
  'KATEDRA_PROJECT_LOCKS_ENABLED',
]

function isConfigured(value) {
  return typeof value === 'string' && value.trim() && !value.trim().startsWith('REPLACE_')
}

export function evaluateAgenticStagingEnvironment(env = process.env) {
  const missing = REQUIRED_AGENTIC_STAGING_ENV.filter((key) => !isConfigured(env[key]))
  const invalid = []

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

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing: [...new Set(missing)],
    invalid: [...new Set(invalid)],
  }
}
