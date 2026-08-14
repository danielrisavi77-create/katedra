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
  const workType: LegacyWorkType = ['s', 'z', 'd'].includes(manifest?.workType || '')
    ? manifest!.workType as LegacyWorkType
    : 'z'
  const manuscript = createManuscript({
    projectId: manifest?.projectId || createLegacyProjectId(),
    title: manifest?.topic || '',
    workType,
    now,
  })
  const gen = legacyState?.gen || {}
  manuscript.meta = {
    institution: stringValue(gen.f_fakultet) || manifest?.institution,
    program: stringValue(gen.f_smjer) || manifest?.program,
    mentor: stringValue(gen.f_mentor),
    citationStyle: stringValue(gen.f_stil),
    deadline: manifest?.deadline || stringValue(gen.f_rok),
    unitId: manifest?.unitId,
    profileId: manifest?.profileId,
  }
  return manuscript
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function createLegacyProjectId(): string {
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
