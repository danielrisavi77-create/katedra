import type { AcademicCatalog, AcademicProfile, AcademicUnit } from './types'

export type AcademicProfileResolution =
  | { ok: true; profile: AcademicProfile; unit: AcademicUnit }
  | { ok: false; reason: 'profile_missing' | 'unit_missing' | 'unit_mismatch' | 'profile_not_listed' | 'work_type_mismatch' }

export function resolveAcademicProfile(
  catalog: AcademicCatalog,
  input: { unitId?: string; profileId?: string; workType?: string },
): AcademicProfileResolution {
  const profileId = input.profileId?.trim() || ''
  const unitId = input.unitId?.trim() || ''
  if (!profileId) return { ok: false, reason: 'profile_missing' }
  const profile = catalog.profiles.find((candidate) => candidate.id === profileId)
  if (!profile) return { ok: false, reason: 'profile_missing' }
  if (unitId && profile.unitId !== unitId) return { ok: false, reason: 'unit_mismatch' }
  const unit = catalog.units.find((candidate) => candidate.id === profile.unitId)
  if (!unit) return { ok: false, reason: 'unit_missing' }
  if (!unit.profiles.includes(profile.id)) return { ok: false, reason: 'profile_not_listed' }
  if (input.workType && !profile.workTypes.includes(canonicalWorkType(input.workType))) return { ok: false, reason: 'work_type_mismatch' }
  return { ok: true, profile, unit }
}

export function canonicalWorkType(value: string): string {
  if (value === 's' || value === 'seminar' || value === 'seminarski') return 'seminar'
  if (value === 'z' || value === 'final' || value === 'zavrsni') return 'final'
  if (value === 'd' || value === 'graduate' || value === 'diplomski') return 'graduate'
  return value
}
