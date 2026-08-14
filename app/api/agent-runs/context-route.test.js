import { describe, expect, it } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.join(process.cwd(), 'app/api/agent-runs/[runId]/context/route.js'), 'utf8')

describe('agent run context route contract', () => {
  it('validates and stores the local manuscript as a private run payload', () => {
    expect(source).toContain('storeAgentRunContext')
    expect(source).toContain('MAX_AGENT_CONTEXT_BYTES')
    expect(source).toContain('arrayBuffer')
    expect(source).toContain('attachAgentPayloadsToRun')
    expect(source).toContain('materialIds')
  })

  it('does not expose manuscript text through canonical registration metadata', () => {
    expect(source).toContain('manuscript: body?.manuscript')
    expect(source).not.toContain('extractedText')
    expect(source).not.toContain('validated.manuscript')
  })

  it('allows blocked runs to receive a revised context before resume', () => {
    expect(source).not.toContain("['completed', 'blocked', 'failed', 'cancelled']")
    expect(source).toContain("['completed', 'failed', 'cancelled']")
    expect(source).toContain('Svi odabrani materijali nisu potvrđeni')
  })
})
