import { createManuscript } from './model'
import type { LegacyWorkType, ManuscriptV1 } from './types'

type LegacyManifest = {
  projectId?: string
  topic?: string
  workType?: string
  unitId?: string
  profileId?: string
  deadline?: string
  institution?: string
  program?: string
}

type LegacyState = { gen?: Record<string, unknown> }

export function migrateLegacyProject({
  manifest,
  legacyState,
  now = new Date().toISOString(),
}: {
  manifest?: LegacyManifest | null
  legacyState?: LegacyState | null
  now?: string
}): ManuscriptV1 {
  const rawWorkType = stringValue(manifest?.workType)
  const workType: LegacyWorkType = ['s', 'z', 'd'].includes(rawWorkType || '')
    ? rawWorkType as LegacyWorkType
    : 'z'
  const manuscript = createManuscript({
    projectId: stringValue(manifest?.projectId, 200) || createLegacyProjectId(),
    title: stringValue(manifest?.topic, 500) || '',
    workType,
    now,
  })
  const gen = legacyState?.gen || {}
  manuscript.meta = {
    institution: stringValue(gen.f_fakultet) || stringValue(manifest?.institution),
    program: stringValue(gen.f_smjer) || stringValue(manifest?.program),
    mentor: stringValue(gen.f_mentor),
    citationStyle: stringValue(gen.f_stil),
    deadline: stringValue(manifest?.deadline) || stringValue(gen.f_rok),
    unitId: stringValue(manifest?.unitId),
    profileId: stringValue(manifest?.profileId),
  }
  return manuscript
}

function stringValue(value: unknown, maxLength = 5_000): string | undefined {
  return typeof value === 'string' && value.length <= maxLength && value.trim() ? value.trim() : undefined
}

function createLegacyProjectId(): string {
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
