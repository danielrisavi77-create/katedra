import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

import { expect, it } from 'vitest'

const SCRIPT = join(import.meta.dirname, 'agent-worker-local-contract-e2e.mjs')

function runContractScript({ env = {} } = {}) {
  return execFileSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

it('reports blocked external staging instead of claiming a successful worker run', () => {
  try {
    runContractScript({ env: { KATEDRA_AGENT_WORKER_CONTRACT_MODE: '' } })
    throw new Error('A missing external contract must not exit successfully')
  } catch (error) {
    expect(error.status).toBe(1)
    expect(error.stdout).toContain('BLOCKED_EXTERNAL')
    expect(error.stdout).not.toContain('_PASS')
  }
})

it('runs a deterministic retrying dispatcher fixture to completion', () => {
  const output = runContractScript({ env: { KATEDRA_AGENT_WORKER_CONTRACT_MODE: 'fixture' } })

  expect(output).toContain('fixture tick 1: dispatcher=200 step=retrying')
  expect(output).toContain('fixture tick 2: dispatcher=200 run=completed')
  expect(output).toContain('AGENT_WORKER_RESPONSE_FIXTURE_ONLY_PASS')
  expect(output).toContain('NOT_AN_INTEGRATION_TEST')
  expect(output).not.toContain('AGENT_WORKER_CONTRACT_PASS')
})
