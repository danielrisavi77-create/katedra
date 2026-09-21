import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, it } from 'vitest'

const runbook = readFileSync(join(import.meta.dirname, '../../docs/release/AGENT_WORKER_RUNBOOK.md'), 'utf8')

it('documents the worker deployment, secret boundary and release gate', () => {
  expect(runbook).toContain('katedra-agent-worker')
  expect(runbook).toContain('KATEDRA_AGENT_WORKER_CRON_SECRET')
  expect(runbook).toContain('KATEDRA_AGENT_WORKER_TOKEN')
  expect(runbook).toContain('cron.job_run_details')
  expect(runbook).toContain('ne šalje service-role ključ')
  expect(runbook).toContain('KATEDRA_AGENT_RUNS_ENABLED=true')
})
