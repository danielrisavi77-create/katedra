import { describe, expect, it } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.join(process.cwd(), 'app/api/agent-runs/route.js'), 'utf8')

describe('agent run route contract', () => {
  it('uses the canonical create_agent_run RPC instead of direct run/step inserts', () => {
    expect(source).toContain('createAgentRun')
    expect(source).toContain('create_agent_run')
    expect(source).not.toContain("from('agent_runs').insert")
    expect(source).not.toContain("from('agent_steps').insert")
  })

  it('prepares the private manuscript context before exposing the run', () => {
    expect(source).toContain('storeAgentRunContext')
    expect(source).toContain('Snapshot rukopisa je obavezan')
    expect(source).toContain('cancelAgentRun')
    expect(source).toContain('attachAgentPayloadsToRun')
    expect(source).toContain('resolveProjectCapability')
    expect(source).toContain("'autonomous_run'")
  })

  it('activates an initializing run only after its private context is ready', () => {
    expect(source).toContain('activateAgentRun')
    expect(source.indexOf('await storeAgentRunContext')).toBeLessThan(source.indexOf('await activateAgentRun'))
  })
})
