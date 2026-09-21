import { describe, expect, it, vi } from 'vitest'
import { primaryProcessFactForUnit, resolveCapability, type ProcessFact, type ProcessFactPack } from './process-facts'

const now = new Date('2026-09-07T12:00:00Z')
const fact: ProcessFact = {
  id: 'policy-1', unitId: 'unit-1', scope: 'faculty', label: 'Synthetic policy',
  aiPolicy: 'allowed', status: 'verified', verifiedDate: '2026-09-01',
  source: { t: 'Synthetic source', u: 'https://example.test/policy' },
}
function pack(overrides: Partial<ProcessFact>): ProcessFactPack {
  return { schemaVersion: '0.1', generatedAt: now.toISOString(), entries: [{ ...fact, ...overrides }] }
}

describe('institutional capability evidence', () => {
  it.each([
    { status: 'unverified' }, { status: 'partial' }, { source: undefined },
    { source: { t: 'Source', u: 'javascript:alert(1)' } },
    { verifiedDate: undefined }, { verifiedDate: 'not-a-date' },
    { verifiedDate: '2026-02-30' }, { verifiedDate: '2026-09-08' },
    { effectiveDate: '2026-09-08' }, { effectiveDate: 'invalid' },
    { scope: 'course', scopeLabel: 'Unknown course' },
    { scope: 'program', scopeLabel: 'Unknown program' },
  ] satisfies Partial<ProcessFact>[])('does not grant generation from unresolved evidence: %j', (overrides) => {
    const answer = resolveCapability(pack(overrides), 'unit-1', 'generate_large_sections', now)
    expect(answer.effective).toBe('blocked')
    expect(answer.stance).toBe('unspecified')
    expect(answer.condition?.mentorApproval).not.toBe(true)
  })

  it('does not expose a mentor unlock from an unverified conditional fact', () => {
    const answer = resolveCapability(pack({ status: 'unverified', aiCapabilities: {
      generate_large_sections: { stance: 'conditional', condition: { mentorApproval: true } },
    } }), 'unit-1', 'generate_large_sections', now)
    expect(answer.condition).toBeUndefined()
    expect(answer.effective).toBe('blocked')
  })

  it('uses a sourced, verified, applicable faculty fact', () => {
    expect(resolveCapability(pack({}), 'unit-1', 'generate_large_sections', now)).toMatchObject({
      effective: 'allowed', sourceFactId: 'policy-1', sourceStatus: 'verified',
    })
  })

  it.each(['course', 'program'] as const)('does not expose mentor unlock for an unresolved %s', (scope) => {
    const answer = resolveCapability(pack({ scope, aiCapabilities: {
      generate_large_sections: { stance: 'conditional', condition: { mentorApproval: true } },
    } }), 'unit-1', 'generate_large_sections', now)
    expect(answer.effective).toBe('blocked')
    expect(answer.condition).toBeUndefined()
  })

  it('does not show missing evidence as verified in the compact badge', () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    try {
      expect(primaryProcessFactForUnit(pack({ source: undefined }), 'unit-1')?.status).toBe('unverified')
      expect(primaryProcessFactForUnit(pack({}), 'unit-1')?.status).toBe('verified')
    } finally { vi.useRealTimers() }
  })

  it('keeps missing-policy defaults and supersession behavior', () => {
    expect(resolveCapability(null, 'unit-1', 'generate_large_sections', now).effective).toBe('blocked')
    expect(resolveCapability(null, 'unit-1', 'language_editing', now)).toEqual({ capability: 'language_editing', stance: 'unspecified', effective: 'allowed' })
    expect(resolveCapability(pack({ supersededBy: 'policy-2' }), 'unit-1', 'generate_large_sections', now).effective).toBe('blocked')
  })
})
