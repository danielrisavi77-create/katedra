import { describe, expect, it } from 'vitest'

import pack from '../../public/katedra-pack.json'
import { createAcademicCatalog } from './load-pack'
import { academicRuleStatusForProfile, compileAcademicContext } from './compile-context'
import { assessAcademicFreshness } from './freshness'
import { resolveAcademicProfile } from './resolve-profile'

const catalog = createAcademicCatalog(pack)

describe('academic context compiler', () => {
  it('compiles the FPZG politology graduate profile into actionable rules', () => {
    const context = compileAcademicContext({
      catalog,
      unitId: 'fpzg',
      profileId: 'fpzg-politologija-diplomski',
      workType: 'd',
    })

    expect(context).toMatchObject({
      unitId: 'fpzg',
      profileId: 'fpzg-politologija-diplomski',
      status: 'verified',
      verifiedAt: '2026-06-28',
      wordRange: { min: 10000, max: 12000 },
      minimumReferences: 15,
      minimumBooks: 3,
      citationStyle: 'FPZG autor–godina',
      formatting: { font: 'Times New Roman', fontSize: 12, lineSpacing: 1.5 },
    })
    expect(context.requiredSections.length).toBeGreaterThan(0)
    expect(context.manualChecks.length).toBeGreaterThan(0)
    expect(context.sources.length).toBeGreaterThan(0)
    expect(context.sources.every((source) => source.url.startsWith('http'))).toBe(true)
    expect(context.aiPolicy.mode).toBe('full')
    expect(context.capabilities).toMatchObject({ facultyCoaching: true, paidPass: true, webResearch: true, autonomousRun: true })
  })

  it('keeps FPZG graduate and final profiles materially different', () => {
    const graduate = compileAcademicContext({ catalog, unitId: 'fpzg', profileId: 'fpzg-politologija-diplomski', workType: 'd' })
    const final = compileAcademicContext({ catalog, unitId: 'fpzg', profileId: 'fpzg-politologija-zavrsni', workType: 'z' })

    expect(graduate.wordRange).not.toEqual(final.wordRange)
    expect(graduate.minimumReferences).not.toBe(final.minimumReferences)
    expect(graduate.manualChecks).not.toEqual(final.manualChecks)
  })

  it('fails closed to generic context for unknown, mismatched or free-text profiles', () => {
    expect(resolveAcademicProfile(catalog, { unitId: 'ffzg', profileId: 'fpzg-politologija-diplomski', workType: 'd' })).toMatchObject({ ok: false, reason: 'unit_mismatch' })
    expect(resolveAcademicProfile(catalog, { unitId: 'fpzg', profileId: 'fpzg-politologija-diplomski', workType: 'z' })).toMatchObject({ ok: false, reason: 'work_type_mismatch' })

    const generic = compileAcademicContext({ catalog, unitId: '', profileId: '', workType: 'd', institutionName: 'Moj fakultet', program: 'Moj smjer' })
    expect(generic).toMatchObject({ status: 'generic', unitId: '', profileId: '', institutionName: 'Moj fakultet', profileLabel: 'Moj smjer' })
    expect(generic.capabilities).toMatchObject({ facultyCoaching: false, paidPass: false, webResearch: false, autonomousRun: false })
    expect(generic.aiPolicy.mode).toBe('generic')
  })

  it('rejects a profile that is not listed by the canonical academic unit', () => {
    const catalog = {
      units: [{ id: 'fpzg', name: 'FPZG', inst: 'Sveučilište', profiles: ['another-profile'] }],
      profiles: [{ id: 'fpzg-politologija-diplomski', unitId: 'fpzg', label: 'FPZG diplomski', workTypes: ['graduate'], status: 'verified' as const, verifiedAt: '2026-06-28' }],
    }

    expect(resolveAcademicProfile(catalog, { unitId: 'fpzg', profileId: 'fpzg-politologija-diplomski', workType: 'd' })).toMatchObject({ ok: false, reason: 'profile_not_listed' })
    expect(compileAcademicContext({ catalog, unitId: 'fpzg', profileId: 'fpzg-politologija-diplomski', workType: 'd' }).status).toBe('generic')
  })

  it('does not infer a minimum book count without an explicit number', () => {
    const context = compileAcademicContext({
      catalog: {
        units: [{ id: 'test', name: 'Test', inst: '', profiles: ['test-profile'] }],
        profiles: [{ id: 'test-profile', unitId: 'test', label: 'Test profil', workTypes: ['graduate'], status: 'verified', verifiedAt: '2026-06-28', facts: ['Koristi relevantne knjige.'], sections: [], manualChecks: [], submissionFacts: [], sources: [] }],
      },
      unitId: 'test',
      profileId: 'test-profile',
      workType: 'd',
    })

    expect(context.minimumBooks).toBeUndefined()
  })

  it('rejects impossible verification dates and keeps stale dates advisory', () => {
    expect(assessAcademicFreshness('2026-02-31')).toMatchObject({ validDate: false, isStale: false })

    const context = compileAcademicContext({
      catalog: {
        units: [{ id: 'test', name: 'Test', inst: '', profiles: ['test-profile'] }],
        profiles: [{ id: 'test-profile', unitId: 'test', label: 'Test profil', workTypes: ['graduate'], status: 'verified', verifiedAt: '2020-06-28', sections: [], manualChecks: [], submissionFacts: [], sources: [] }],
      },
      unitId: 'test',
      profileId: 'test-profile',
      workType: 'd',
    })

    expect(context.status).toBe('verified')
    expect(context.verifiedAt).toBe('2020-06-28')
    expect(context.freshness).toMatchObject({ validDate: true, isStale: true })
    expect(context.aiPolicy.claims.join(' ')).toContain('stariji')
  })

  it('uses the same verified status in selector presentation and compiled context', () => {
    expect(academicRuleStatusForProfile({ status: 'verified', verifiedAt: 'not-a-date' })).toBe('partial')
    expect(academicRuleStatusForProfile({ status: 'verified', verifiedAt: '2026-06-28' })).toBe('verified')
  })

  it('does not expose final or autonomous capabilities to a verified seminar profile', () => {
    const context = compileAcademicContext({
      catalog: {
        units: [{ id: 'test', name: 'Test', inst: '', profiles: ['test-seminar'] }],
        profiles: [{ id: 'test-seminar', unitId: 'test', label: 'Seminarski profil', workTypes: ['seminar'], status: 'verified', verifiedAt: '2026-06-28', sections: [], manualChecks: [], submissionFacts: [], sources: [] }],
      },
      unitId: 'test',
      profileId: 'test-seminar',
      workType: 's',
    })

    expect(context.capabilities.aiCapabilities).not.toContain('web_research')
    expect(context.capabilities.aiCapabilities).not.toContain('autonomous_run')
    expect(context.capabilities.webResearch).toBe(false)
    expect(context.capabilities.autonomousRun).toBe(false)
  })
})
