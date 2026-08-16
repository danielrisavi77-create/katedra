import { describe, expect, it } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'

const routePaths = [
  '[runId]/pause/route.js',
  '[runId]/resume/route.js',
  '[runId]/cancel/route.js',
  '[runId]/route.js',
].map((relativePath) => path.join(process.cwd(), 'app/api/agent-runs', relativePath))

describe('agent run private control responses', () => {
  it('does not allow authenticated run state to be cached publicly', () => {
    for (const routePath of routePaths) {
      const source = fs.readFileSync(routePath, 'utf8')
      expect(source).toContain("from '@/lib/observability/private-response.js'")
      expect(source).toContain('privateJson(')
      expect(source).toContain("from '@/lib/observability/request-id.js'")
      expect(source).toContain('withRequestId(')
    }
  })
})
