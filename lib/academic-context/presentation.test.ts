import { describe, expect, it } from 'vitest'

import pack from '../../public/katedra-pack.json'
import { compileAcademicContext } from './compile-context'
import { createAcademicCatalog } from './load-pack'
import { academicContextExportWarning, academicHandoffParams } from './presentation'

const context = compileAcademicContext({
  catalog: createAcademicCatalog(pack),
  unitId: 'fpzg',
  profileId: 'fpzg-politologija-diplomski',
  workType: 'd',
})

describe('academic context presentation metadata', () => {
  it('makes export limitations and selected rules transparent', () => {
    const warning = academicContextExportWarning(context)
    expect(warning).toContain('DOCX je izrađen iz rukopisa, ali nije tehnički verificiran.')
    expect(warning).toContain('fpzg-politologija-diplomski')
    expect(warning).toContain('10.000–12.000 riječi')
    expect(warning).toContain('15 izvora')
    expect(warning).toContain('Službeni izvor')
    expect(warning).toContain('fpzg.unizg.hr')
    expect(warning).toContain('Lekti')
  })

  it('passes bounded canonical academic metadata to Lekta', () => {
    expect(academicHandoffParams(context)).toMatchObject({
      profile: 'fpzg-politologija-diplomski',
      rulesStatus: 'verified',
      rulesVerifiedAt: '2026-06-28',
      rulesMinWords: '10000',
      rulesMaxWords: '12000',
      rulesMinReferences: '15',
      rulesMinBooks: '3',
      citationStyle: 'FPZG autor–godina',
    })
    expect(academicHandoffParams(context).rulesSource).toContain('fpzg.unizg.hr')
  })

  it('carries stale verification as an advisory instead of hiding it', () => {
    const stale = { ...context, freshness: { validDate: true, ageDays: 900, isStale: true } }
    expect(academicContextExportWarning(stale)).toContain('stariji od preporučenog roka')
    expect(academicHandoffParams(stale).rulesFreshness).toBe('stale')
  })
})
