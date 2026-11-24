import { countDocumentWords, documentText } from './model'
import type { ManuscriptChangeKind, ManuscriptSnapshotV1, ManuscriptV1 } from './types'

export interface VersionSectionDiff {
  sectionId: string
  title: string
  beforeText: string
  afterText: string
  beforeWords: number
  afterWords: number
  changed: boolean
}

export interface ManuscriptVersionDiff {
  titleChanged: boolean
  metadataChanged: boolean
  beforeWords: number
  afterWords: number
  changedSections: number
  sections: VersionSectionDiff[]
}

export type VersionRestoreTarget = 'before' | 'after'

export function inferChangeKind(reason: string): ManuscriptChangeKind {
  const value = reason.toLocaleLowerCase('hr')
  if (value.includes('ai') || value.includes('prijedlog')) return 'ai_proposal'
  if (value.includes('uvoz') || value.includes('import') || value.includes('backup')) return 'import'
  if (value.includes('mentor')) return 'mentor_review'
  if (value.includes('agent')) return 'agentic'
  if (value.includes('vrat')) return 'restore'
  if (value.includes('promjen') || value.includes('uređ')) return 'user_change'
  return 'unknown'
}

export function changeKindLabel(kind: ManuscriptChangeKind): string {
  return {
    ai_proposal: 'AI prijedlog',
    user_change: 'Korisnička promjena',
    import: 'Uvoz',
    mentor_review: 'Mentorova revizija',
    restore: 'Vraćanje verzije',
    agentic: 'Agenticni rezultat',
    unknown: 'Lokalna verzija',
  }[kind]
}

export function compareManuscripts(before: ManuscriptV1, after: ManuscriptV1): ManuscriptVersionDiff {
  const afterById = new Map(after.sections.map((section) => [section.id, section]))
  const sections = before.sections.map((section) => {
    const next = afterById.get(section.id)
    const beforeText = documentText(section.content)
    const afterText = documentText(next?.content)
    return {
      sectionId: section.id,
      title: next?.title || section.title,
      beforeText,
      afterText,
      beforeWords: countDocumentWords(section.content),
      afterWords: countDocumentWords(next?.content),
      changed: beforeText !== afterText || section.title !== next?.title || section.status !== next?.status,
    }
  })
  after.sections.filter((section) => !before.sections.some((item) => item.id === section.id)).forEach((section) => {
    sections.push({ sectionId: section.id, title: section.title, beforeText: '', afterText: documentText(section.content), beforeWords: 0, afterWords: countDocumentWords(section.content), changed: true })
  })
  return {
    titleChanged: before.title !== after.title,
    metadataChanged: JSON.stringify(before.meta) !== JSON.stringify(after.meta) || before.workType !== after.workType,
    beforeWords: before.sections.reduce((sum, section) => sum + countDocumentWords(section.content), 0),
    afterWords: after.sections.reduce((sum, section) => sum + countDocumentWords(section.content), 0),
    changedSections: sections.filter((section) => section.changed).length,
    sections,
  }
}

export function snapshotChangeKind(snapshot: ManuscriptSnapshotV1): ManuscriptChangeKind {
  return snapshot.changeKind || inferChangeKind(snapshot.reason)
}

export function restoreTargetManuscript(snapshot: ManuscriptSnapshotV1, target: VersionRestoreTarget): ManuscriptV1 {
  return target === 'after' && snapshot.after ? snapshot.after : snapshot.manuscript
}
