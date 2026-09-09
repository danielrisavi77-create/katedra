import { describe, expect, it } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.join(process.cwd(), 'app/api/internal/agent-worker/route.js'), 'utf8')

describe('internal agent worker route contract', () => {
  it('is fail-closed, claims through the canonical lease RPC, and executes one step at a time', () => {
    expect(source).toContain("import { createAdminClient } from '@/lib/supabase/admin'")
    expect(source).not.toContain("import { createAdminClient } from '@/lib/supabase/server'")
    expect(source).toContain('KATEDRA_AGENT_WORKER_TOKEN')
    expect(source).toContain('KATEDRA_PROJECT_LOCKS_ENABLED')
    expect(source).toContain('runAgentWorkerLoop')
    expect(source).toContain('maxSteps: 1')
    expect(source).toContain("import { privateJson } from '@/lib/observability/private-response.js'")
    expect(source).toContain('return privateJson({ runId, ...result })')
    expect(source).not.toContain('Response.json(')
    expect(source).toContain('agent_worker_admin_client_unavailable')
    expect(source).toContain('Agent worker storage trenutno nije konfiguriran.')
    expect(source).toContain('!downloaded.data')
  })

  it('loads private context and uses the billing-aware provider executor', () => {
    expect(source).toContain('loadActiveRunContextSnapshot')
    expect(source).not.toContain('loadRunManuscriptContext(')
    expect(source).toContain('loadRunMaterialContexts')
    expect(source).toContain('createProviderBackedExecutor')
    expect(source).toContain('KATEDRA_AGENT_RUNS_ENABLED')
    expect(source).toContain('ANTHROPIC_API_KEY')
    expect(source).toContain('executeBilledPassageVerification')
  })

  it('fails closed when the model or canonical billing/rate-limit contracts are not configured', () => {
    expect(source).toContain('resolveAgentWorkerConfiguration')
    expect(source).toContain('worker safety configuration unavailable')
    expect(source).not.toContain("process.env.KATEDRA_AGENT_MODEL || 'claude-sonnet-5'")
  })

  it('keeps the worker configuration error readable in Croatian', () => {
    expect(source).toContain('Agent worker još nije konfiguriran za sigurnu naplatu.')
    expect(source).not.toContain('joĹˇ nije konfiguriran')
  })
})
