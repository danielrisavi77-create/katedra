import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/agent-payload-cleanup.yml'), 'utf8')

describe('agent payload cleanup scheduler workflow', () => {
  it('runs on a bounded schedule with a dedicated secret', () => {
    expect(workflow).toContain("cron: '*/15 * * * *'")
    expect(workflow).toContain('KATEDRA_AGENT_PAYLOAD_CLEANUP_URL')
    expect(workflow).toContain('KATEDRA_AGENT_PAYLOAD_CLEANUP_CRON_SECRET')
    expect(workflow).toContain('Authorization: Bearer $CLEANUP_SECRET')
    expect(workflow).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('fails when the endpoint or secret is not configured', () => {
    expect(workflow).toContain('Require cleanup configuration')
    expect(workflow).toContain('exit 1')
  })
})
