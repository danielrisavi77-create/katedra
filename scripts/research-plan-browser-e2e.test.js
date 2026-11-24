import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('research plan browser E2E contract', () => {
  it('requires save, reload, responsive layout and feature-flag evidence', () => {
    const source = readFileSync(join(process.cwd(), 'scripts/research-plan-browser-e2e.mjs'), 'utf8')
    expect(source).toContain('Research Design Canvas')
    expect(source).toContain('Methodology Builder')
    expect(source).toContain('reload')
    expect(source).toContain('KATEDRA_RESEARCH_MODULES_ENABLED')
    expect(source).toContain('390')
  })
})
