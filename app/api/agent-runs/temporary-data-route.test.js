import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.join(process.cwd(), 'app/api/agent-runs/[runId]/temporary-data/route.js'), 'utf8')

describe('temporary agent run data route contract', () => {
  it('scopes read and delete operations to the authenticated project run', () => {
    expect(source).toContain(".eq('project_id', projectId)")
    expect(source).toContain(".eq('user_id', userId)")
    expect(source).toContain('deleteAgentRunPayloads')
  })

  it('does not allow deletion while a run can still execute', () => {
    expect(source).toContain("['completed', 'blocked', 'failed', 'cancelled']")
    expect(source).toContain('nakon završetka ili zaustavljanja runa')
  })
})
