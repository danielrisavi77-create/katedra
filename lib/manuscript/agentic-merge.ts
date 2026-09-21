import type { AgenticDraftV1 } from './agentic-revisions'
import { acceptVerifiedSections } from './agentic-revisions'
import type { ManuscriptV1 } from './types'

export type AgenticMergeResult =
  | { ok: true; manuscript: ManuscriptV1; acceptedSectionIds: string[] }
  | { ok: false; error: string }

export function mergeVerifiedAgenticSections({ manuscript, draft, sectionIds }: { manuscript: ManuscriptV1; draft: AgenticDraftV1; sectionIds?: string[] }): AgenticMergeResult {
  if (draft.projectId !== manuscript.projectId) return { ok: false, error: 'Agentički draft pripada drugom projektu.' }
  const baseSections = new Map(manuscript.sections.map((section) => [section.id, section]))
  const requested = sectionIds ? new Set(sectionIds) : null
  const acceptedSectionIds: string[] = []

  for (const revision of draft.sections) {
    if (!baseSections.has(revision.sectionId)) return { ok: false, error: `Sekcija ${revision.sectionId} ne postoji u glavnom rukopisu.` }
    if (requested && !requested.has(revision.sectionId)) continue
    const section = baseSections.get(revision.sectionId)
    if (revision.status === 'verified' && section && revision.baseRevision === section.updatedAt) acceptedSectionIds.push(revision.sectionId)
  }

  if (acceptedSectionIds.length === 0) return { ok: false, error: 'Nema aktualnih verificiranih sekcija za prihvat.' }
  const merged = acceptVerifiedSections(manuscript, draft, acceptedSectionIds)
  return { ok: true, manuscript: merged, acceptedSectionIds }
}
