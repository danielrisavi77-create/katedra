import { describe, expect, it } from 'vitest'

import { createAcademicCatalog, loadAcademicPackFromValue } from './load-pack'

const richPack = {
  meta: { schemaVersion: '0.1', generatedAt: '2026-08-02' },
  units: [
    { id: 'fpzg', name: 'Fakultet političkih znanosti', inst: 'Sveučilište u Zagrebu', profiles: ['fpzg-politologija-diplomski'] },
  ],
  profiles: [
    {
      id: 'fpzg-politologija-diplomski',
      unitId: 'fpzg',
      label: 'FPZG · diplomska Politologija · diplomski rad',
      status: 'verified',
      workTypes: ['graduate'],
      verifiedAt: '2026-06-28',
      wordMin: 10000,
      wordMax: 12000,
      pageMin: 50,
      pageMax: 70,
      minReferences: 15,
      minimumBooks: 3,
      citation: 'fpzg',
      font: 'Times New Roman',
      size: 12,
      spacing: 1.5,
      sections: ['Uvod', 'Teorijski okvir', 'Metodologija', 'Zaključak', 'Literatura'],
      manualChecks: ['Najmanje 3 knjige.'],
      facts: ['Najmanje 15 znanstvenih izvora.'],
      submissionFacts: ['Predaja prema službenim uputama.'],
      sources: [{ t: 'FPZG upute za diplomski rad', u: 'https://fpzg.unizg.hr/upute' }],
      ignored: 'ne smije završiti u katalogu',
    },
  ],
}

describe('academic pack loader', () => {
  it('preserves rich verified profile rules needed by the compiler', () => {
    const catalog = createAcademicCatalog(richPack)
    const profile = catalog.profiles[0]

    expect(profile).toMatchObject({
      id: 'fpzg-politologija-diplomski',
      status: 'verified',
      verifiedAt: '2026-06-28',
      wordMin: 10000,
      wordMax: 12000,
      minReferences: 15,
      minimumBooks: 3,
      citation: 'fpzg',
      font: 'Times New Roman',
      size: 12,
      spacing: 1.5,
      sections: ['Uvod', 'Teorijski okvir', 'Metodologija', 'Zaključak', 'Literatura'],
      manualChecks: ['Najmanje 3 knjige.'],
      facts: ['Najmanje 15 znanstvenih izvora.'],
      submissionFacts: ['Predaja prema službenim uputama.'],
      sources: [{ title: 'FPZG upute za diplomski rad', url: 'https://fpzg.unizg.hr/upute' }],
    })
    expect(profile).not.toHaveProperty('ignored')
  })

  it('discards malformed records and invalid sources without rejecting valid records', () => {
    const catalog = createAcademicCatalog({
      units: [
        { id: 'valid', name: 'Validna ustanova', inst: '', profiles: ['valid-profile'] },
        { id: '', name: 'Bez identiteta' },
        { id: 'not-an-object' },
      ],
      profiles: [
        { id: 'valid-profile', unitId: 'valid', label: 'Validan profil', workTypes: ['graduate'], sources: [{ t: 'Valjan', u: 'https://example.com' }, { t: '', u: 'https://bad.example' }, { t: 'Nije URL', u: 'not-a-url' }] },
        { id: 'missing-unit', label: 'Bez ustanove', workTypes: ['graduate'] },
        { id: 'missing-label', unitId: 'valid', workTypes: ['graduate'] },
      ],
    })

    expect(catalog.units).toHaveLength(1)
    expect(catalog.profiles).toHaveLength(1)
    expect(catalog.profiles[0].sources).toEqual([{ title: 'Valjan', url: 'https://example.com' }])
  })

  it('returns an empty catalog for missing top-level arrays', () => {
    expect(loadAcademicPackFromValue({}).units).toEqual([])
    expect(loadAcademicPackFromValue({ profiles: null }).profiles).toEqual([])
  })
})
