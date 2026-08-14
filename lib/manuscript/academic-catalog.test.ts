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
