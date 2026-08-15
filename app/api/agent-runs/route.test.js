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

  it('cleans stale initialization before creating a replacement run', () => {
    expect(source).toContain('cleanupStaleInitializingAgentRun')
    expect(source.indexOf('await cleanupStaleInitializingAgentRun')).toBeLessThan(source.indexOf('await createAgentRun'))
  })

  it('activates an initializing run only after its private context is ready', () => {
    expect(source).toContain('activateAgentRun')
    expect(source.indexOf('await storeAgentRunContext')).toBeLessThan(source.indexOf('await activateAgentRun'))
  })

  it('attaches selected materials before exposing the run to workers', () => {
    expect(source).toContain('attachAgentPayloadsToRun')
    expect(source.indexOf('await attachAgentPayloadsToRun')).toBeLessThan(source.indexOf('await activateAgentRun'))
  })

  it('uses the configured private bucket for the run manuscript snapshot', () => {
    expect(source).toContain("const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'")
    expect(source).toContain('bucket: BUCKET')
  })

  it('compares the submitted run snapshot with the canonical paid-project lock', () => {
    expect(source).toContain('validateAgentRunContext')
    expect(source).toContain('validateLockedProjectMutation')
    expect(source).toContain('manuscript.title')
    expect(source).toContain('manuscript.workType')
  })
})
