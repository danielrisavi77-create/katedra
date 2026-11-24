import type { LegacyWorkType } from './types'
import type { AcademicCatalog, AcademicProfile, AcademicUnit } from '../academic-context/types'

export { createAcademicCatalog } from '../academic-context/load-pack'
export type { AcademicCatalog, AcademicProfile, AcademicUnit } from '../academic-context/types'

const workTypeByLegacyType: Record<LegacyWorkType, string> = {
  s: 'seminar',
  z: 'final',
  d: 'graduate',
}

export function findAcademicUnits(catalog: AcademicCatalog, query: string): AcademicUnit[] {
  const needle = normalizeCatalogText(query)
  const units = catalog.units.filter((unit) => {
    if (!needle) return true
    return [unit.id, unit.name, unit.inst].some((value) => normalizeCatalogText(value).includes(needle))
  })
  return units.slice(0, 8)
}

export function resolveUniqueAcademicUnit(catalog: AcademicCatalog, query: string): AcademicUnit | null {
  const needle = normalizeCatalogText(query)
  if (!needle) return null
  const matches = catalog.units.filter((unit) => [unit.id, unit.name].some((value) => normalizeCatalogText(value) === needle))
  return matches.length === 1 ? matches[0] : null
}

export function findProfilesForUnit(catalog: AcademicCatalog, unitId: string, workType: LegacyWorkType | string, query = ''): AcademicProfile[] {
  const needle = normalizeCatalogText(query)
  const canonicalWorkType = workTypeByLegacyType[workType as LegacyWorkType] || workType
  return catalog.profiles
    .filter((profile) => profile.unitId === unitId && profile.workTypes.includes(canonicalWorkType))
    .filter((profile) => !needle || normalizeCatalogText(profile.label).includes(needle) || normalizeCatalogText(profile.id).includes(needle))
    .slice(0, 12)
}

export function normalizeCatalogText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('hr')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function displayAcademicProfile(profile: AcademicProfile): string {
  const parts = profile.label.split('·').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return profile.label
  const visible = parts
    .slice(1)
    .filter((part) => !isWorkTypeLabel(part))
    .map((part) => part.replace(/^(prijediplomska|prijediplomsko|diplomska|diplomsko|doktorski studij)\s+/i, ''))
    .filter(Boolean)
  return visible.length ? visible.join(' — ') : profile.label
}

function isWorkTypeLabel(value: string): boolean {
  return /\b(seminarski|završni|diplomski|specijalistički|doktorski)\s+rad\b|master'?s\s+thesis|opći akademski rad/i.test(value)
}
