import type { LegacyWorkType } from './types'

export type ServerProjectManifest = {
  projectId: string
  topic: string
  workType: LegacyWorkType
  deadline?: string
  unitId?: string
  profileId?: string
}

export function serverStateToManifest(projectId: string, state: unknown): ServerProjectManifest | null {
  if (!projectId.trim() || !state || typeof state !== 'object' || Array.isArray(state)) return null
  const value = state as Record<string, unknown>
  const workType = normalizeWorkType(value.workType, value.workTypeCanonical)
  const topic = typeof value.topic === 'string' ? value.topic.trim() : ''
  if (!workType || !topic) return null

  return {
    projectId,
    topic,
    workType,
    ...(typeof value.deadline === 'string' && value.deadline ? { deadline: value.deadline } : {}),
    ...(typeof value.unitId === 'string' && value.unitId ? { unitId: value.unitId } : {}),
    ...(typeof value.profileId === 'string' && value.profileId ? { profileId: value.profileId } : {}),
  }
}

function normalizeWorkType(value: unknown, canonicalValue: unknown): LegacyWorkType | null {
  if (value === 's' || value === 'z' || value === 'd') return value
  if (canonicalValue === 'seminar' || canonicalValue === 'seminarski') return 's'
  if (canonicalValue === 'final' || canonicalValue === 'zavrsni') return 'z'
  if (canonicalValue === 'graduate' || canonicalValue === 'diplomski') return 'd'
  return null
}
