import { describe, expect, it } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.join(process.cwd(), 'app/api/internal/agent-worker/route.js'), 'utf8')

describe('internal agent worker route contract', () => {
  it('is fail-closed, claims through the canonical lease RPC, and executes one step at a time', () => {
    expect(source).toContain('KATEDRA_AGENT_WORKER_TOKEN')
    expect(source).toContain('runAgentWorkerLoop')
    expect(source).toContain('maxSteps: 1')
  })

  it('loads private context and uses the billing-aware provider executor', () => {
    expect(source).toContain('loadRunManuscriptContext')
    expect(source).toContain('loadRunMaterialContexts')
    expect(source).toContain('createProviderBackedExecutor')
    expect(source).toContain('KATEDRA_AGENT_RUNS_ENABLED')
    expect(source).toContain('ANTHROPIC_API_KEY')
  })
})
