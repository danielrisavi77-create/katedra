import { describe, expect, it } from 'vitest'

import { createAcademicCatalog, displayAcademicProfile, findAcademicUnits, findProfilesForUnit, resolveUniqueAcademicUnit } from './academic-catalog'

const pack = {
  units: [
    { id: 'fpzg', name: 'Fakultet političkih znanosti', inst: 'Sveučilište u Zagrebu', profiles: ['fpzg-politologija-zavrsni', 'fpzg-politologija-diplomski'] },
    { id: 'ffzg', name: 'Filozofski fakultet', inst: 'Sveučilište u Zagrebu', profiles: ['ffzg-povijest-zavrsni'] },
  ],
  profiles: [
    { id: 'fpzg-politologija-zavrsni', unitId: 'fpzg', label: 'FPZG · prijediplomska Politologija · završni rad', workTypes: ['final'] },
    { id: 'fpzg-politologija-diplomski', unitId: 'fpzg', label: 'FPZG · diplomska Politologija · diplomski rad', workTypes: ['graduate'] },
    { id: 'ffzg-povijest-zavrsni', unitId: 'ffzg', label: 'FFZG · Povijest · završni rad', workTypes: ['final'] },
  ],
}

describe('academic catalog', () => {
  it('finds a faculty by its acronym as well as its full name', () => {
    const catalog = createAcademicCatalog(pack)

    expect(findAcademicUnits(catalog, 'FPZG').map((unit) => unit.id)).toEqual(['fpzg'])
    expect(findAcademicUnits(catalog, 'političkih znanosti').map((unit) => unit.id)).toEqual(['fpzg'])
  })

  it('returns only profiles that match the selected work type', () => {
    const catalog = createAcademicCatalog(pack)

    expect(findProfilesForUnit(catalog, 'fpzg', 'z').map((profile) => profile.id)).toEqual(['fpzg-politologija-zavrsni'])
  })

  it('retains the bounded academic rules needed by the selected profile', () => {
    const catalog = createAcademicCatalog({
      units: [{ id: 'fpzg', name: 'Fakultet političkih znanosti', profiles: ['fpzg-politologija-diplomski'] }],
      profiles: [{
        id: 'fpzg-politologija-diplomski',
        unitId: 'fpzg',
        label: 'FPZG · diplomska Politologija · diplomski rad',
        status: 'verified',
        workTypes: ['graduate'],
        verifiedAt: '2026-06-28',
        wordMin: 10000,
        wordMax: 12000,
        minReferences: 15,
        font: 'Times New Roman',
        size: 12,
        spacing: 1.5,
        sections: ['izjava o autorstvu', 'sadržaj'],
        manualChecks: ['Najmanje tri knjige.'],
        facts: ['10.000–12.000 riječi', 'najmanje 3 knjige'],
        submissionFacts: ['Učitaj PDF/A prije obrane.'],
        sources: [{ t: 'Službene upute', u: 'https://example.test/upute.pdf' }],
        ignoredRawField: 'must not leak',
      }],
    })
    const profile = catalog.profiles[0]

    expect(profile).toMatchObject({
      status: 'verified',
      verifiedAt: '2026-06-28',
      wordMin: 10000,
      wordMax: 12000,
      minReferences: 15,
      font: 'Times New Roman',
      size: 12,
      spacing: 1.5,
      sections: ['izjava o autorstvu', 'sadržaj'],
      manualChecks: ['Najmanje tri knjige.'],
      facts: ['10.000–12.000 riječi', 'najmanje 3 knjige'],
      submissionFacts: ['Učitaj PDF/A prije obrane.'],
      sources: [{ title: 'Službene upute', url: 'https://example.test/upute.pdf' }],
    })
    expect(profile).not.toHaveProperty('ignoredRawField')
  })

  it('keeps valid profiles while discarding malformed units, profiles and sources', () => {
    const catalog = createAcademicCatalog({
      units: [
        { id: 'valid', name: 'Validna ustanova', profiles: ['valid-profile'] },
        { id: '', name: 'Nevažeća ustanova' },
        { id: 'not-an-object', name: 42 },
      ],
      profiles: [
        {
          id: 'valid-profile',
          unitId: 'valid',
          label: 'Validan profil',
          status: 'partial',
          workTypes: ['graduate'],
          sources: [
            { t: 'Valjan izvor', u: 'https://example.test/valid' },
            { t: '', u: 'https://example.test/missing-title' },
            { t: 'Missing URL', u: '' },
            { t: 'Wrong shape', u: 42 },
          ],
        },
        { id: '', unitId: 'valid', label: 'Nevažeći profil', workTypes: ['graduate'] },
        { id: 'missing-unit', label: 'Nevažeći profil', workTypes: ['graduate'] },
      ],
    })

    expect(catalog.units.map((unit) => unit.id)).toEqual(['valid'])
    expect(catalog.profiles.map((profile) => profile.id)).toEqual(['valid-profile'])
    expect(catalog.profiles[0].sources).toEqual([{ title: 'Valjan izvor', url: 'https://example.test/valid' }])
    expect(createAcademicCatalog({}).units).toEqual([])
    expect(createAcademicCatalog({}).profiles).toEqual([])
  })

  it('supports FPZG profile search by acronym, program and compatible graduate work type', () => {
    const catalog = createAcademicCatalog({
      units: [{ id: 'fpzg', name: 'Fakultet političkih znanosti', profiles: ['fpzg-politologija-diplomski'] }],
      profiles: [{
        id: 'fpzg-politologija-diplomski',
        unitId: 'fpzg',
        label: 'FPZG · diplomska Politologija · diplomski rad',
        status: 'verified',
        workTypes: ['graduate'],
      }],
    })

    expect(findAcademicUnits(catalog, 'fpzg').map((unit) => unit.id)).toEqual(['fpzg'])
    expect(findProfilesForUnit(catalog, 'fpzg', 'd', 'Politologija').map((profile) => profile.id)).toEqual(['fpzg-politologija-diplomski'])
    expect(findProfilesForUnit(catalog, 'fpzg', 'graduate', 'Politologija').map((profile) => profile.id)).toEqual(['fpzg-politologija-diplomski'])
  })

  it('resolves an unambiguous faculty acronym but not a broad query', () => {
    const catalog = createAcademicCatalog(pack)

    expect(resolveUniqueAcademicUnit(catalog, 'FPZG')?.id).toBe('fpzg')
    expect(resolveUniqueAcademicUnit(catalog, 'fakultet')).toBeNull()
  })

  it('makes study choices shorter without losing a meaningful distinction', () => {
    expect(displayAcademicProfile({
      id: 'fpzg-politologija-zavrsni', unitId: 'fpzg', label: 'FPZG · prijediplomska Politologija · završni rad', workTypes: ['final'],
    })).toBe('Politologija')
    expect(displayAcademicProfile({
      id: 'fpzg-novinarstvo-zavrsni-tekst', unitId: 'fpzg', label: 'FPZG · prijediplomsko Novinarstvo · završni rad · tekstualni', workTypes: ['final'],
    })).toBe('Novinarstvo — tekstualni')
  })
})
