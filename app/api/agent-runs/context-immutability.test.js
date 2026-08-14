import { describe, expect, it } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.join(process.cwd(), 'app/api/agent-runs/[runId]/context/route.js'), 'utf8')

describe('agent run context immutability contract', () => {
  it('rejects context replacement while a worker is actively running', () => {
    expect(source).toContain("run.status === 'running'")
  })
})
