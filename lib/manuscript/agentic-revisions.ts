import type { ManuscriptSectionV1, ManuscriptV1, TiptapNode } from './types'

export interface AgenticSectionRevisionV1 {
  sectionId: string
  baseRevision: string
  proposedContent: TiptapNode
  status: 'generated' | 'verified' | 'blocked' | 'stale' | 'accepted' | 'rejected'
  verificationMessage?: string
  updatedAt: string
}

export interface AgenticDraftV1 {
  schemaVersion: 1
  projectId: string
  runId: string
  baseManuscriptUpdatedAt: string
  contextRevision: string
  sections: AgenticSectionRevisionV1[]
  createdAt: string
  updatedAt: string
}

export interface AgenticDraftValidation {
  ok: boolean
  errors: string[]
}

const NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'heading',
  'text',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'hardBreak',
  'horizontalRule',
])

const REVISION_STATUSES = new Set(['generated', 'verified', 'blocked', 'stale', 'accepted', 'rejected'])

export function createAgenticDraft({
  projectId,
  runId,
  base,
  now = new Date().toISOString(),
}: {
  projectId: string
  runId: string
  base: ManuscriptV1
  now?: string
}): AgenticDraftV1 {
  if (projectId.trim() !== base.projectId) throw new Error('Agentički draft pripada drugom projektu.')
  if (!runId.trim()) throw new Error('Agentički draft mora imati run ID.')

  return {
    schemaVersion: 1,
    projectId,
    runId,
    baseManuscriptUpdatedAt: base.updatedAt,
    contextRevision: contextRevision(base),
    sections: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function upsertSectionRevision(
  draft: AgenticDraftV1,
  revision: AgenticSectionRevisionV1,
): AgenticDraftV1 {
  if (!revision.sectionId.trim()) throw new Error('Agentička revizija mora imati section ID.')
  if (!isTiptapNode(revision.proposedContent)) throw new Error('Agentička revizija ima neispravan Tiptap sadržaj.')
  const sections = draft.sections.filter((item) => item.sectionId !== revision.sectionId)
  return {
    ...draft,
    sections: [...sections, revision],
    updatedAt: revision.updatedAt,
  }
}

export function markStaleRevisions(draft: AgenticDraftV1, manuscript: ManuscriptV1): AgenticDraftV1 {
  if (draft.projectId !== manuscript.projectId) throw new Error('Agentički draft pripada drugom projektu.')

  const sections = draft.sections.map((revision) => {
    const current = manuscript.sections.find((section) => section.id === revision.sectionId)
    const changed = !current || revision.baseRevision !== current.updatedAt
    if (!changed || !['generated', 'verified'].includes(revision.status)) return revision
    return { ...revision, status: 'stale' as const }
  })
  return { ...draft, sections }
}

export function acceptVerifiedSections(
  base: ManuscriptV1,
  draft: AgenticDraftV1,
  sectionIds?: string[],
): ManuscriptV1 {
  if (draft.projectId !== base.projectId) throw new Error('Agentički draft pripada drugom projektu.')
  const selected = sectionIds ? new Set(sectionIds) : null
  const revisions = new Map(draft.sections.map((revision) => [revision.sectionId, revision]))
  let changed = false

  const sections = base.sections.map((section) => {
    const revision = revisions.get(section.id)
    if (!revision || (selected && !selected.has(section.id))) return section
    if (revision.status !== 'verified' || revision.baseRevision !== section.updatedAt) return section
    changed = true
    return {
      ...section,
      content: cloneNode(revision.proposedContent),
      status: section.status === 'empty' ? 'draft' as const : section.status,
      updatedAt: new Date().toISOString(),
    }
  })

  return changed ? { ...base, sections, updatedAt: new Date().toISOString() } : base
}

export function validateAgenticDraft(value: unknown): AgenticDraftValidation {
  const errors: string[] = []
  if (!isRecord(value)) return { ok: false, errors: ['Draft nije objekt.'] }
  if (value.schemaVersion !== 1) errors.push('Nepodržana verzija drafta.')
  if (!nonEmptyString(value.projectId)) errors.push('Nedostaje project ID.')
  if (!nonEmptyString(value.runId)) errors.push('Nedostaje run ID.')
  if (!validDate(value.baseManuscriptUpdatedAt)) errors.push('Neispravan datum osnovnog rukopisa.')
  if (!nonEmptyString(value.contextRevision)) errors.push('Nedostaje revizija konteksta.')
  if (!Array.isArray(value.sections)) {
    errors.push('Sekcije drafta moraju biti polje.')
  } else {
    const seen = new Set<string>()
    value.sections.forEach((revision, index) => {
      if (!isRecord(revision)) {
        errors.push(`Revizija ${index + 1} nije objekt.`)
        return
      }
      if (!nonEmptyString(revision.sectionId)) errors.push(`Revizija ${index + 1} nema section ID.`)
      if (typeof revision.sectionId === 'string' && seen.has(revision.sectionId)) errors.push(`Sekcija ${revision.sectionId} ima duplu reviziju.`)
      if (typeof revision.sectionId === 'string') seen.add(revision.sectionId)
      if (!nonEmptyString(revision.baseRevision)) errors.push(`Revizija ${index + 1} nema osnovnu reviziju.`)
      if (!isTiptapNode(revision.proposedContent)) errors.push(`Revizija ${index + 1} ima neispravan Tiptap sadržaj.`)
      if (typeof revision.status !== 'string' || !REVISION_STATUSES.has(revision.status)) errors.push(`Revizija ${index + 1} ima neispravan status.`)
      if (!validDate(revision.updatedAt)) errors.push(`Revizija ${index + 1} ima neispravan datum.`)
    })
  }
  if (!validDate(value.createdAt)) errors.push('Draft ima neispravan datum izrade.')
  if (!validDate(value.updatedAt)) errors.push('Draft ima neispravan datum izmjene.')
  return { ok: errors.length === 0, errors }
}

function contextRevision(base: ManuscriptV1): string {
  return hash(JSON.stringify({
    projectId: base.projectId,
    title: base.title,
    workType: base.workType,
    sections: base.sections.map(({ id, title, order, updatedAt }) => ({ id, title, order, updatedAt })),
    sources: base.sources.map(({ id, title, authors, year, urlOrDoi, verified }) => ({ id, title, authors, year, urlOrDoi, verified })),
  }))
}

function hash(input: string): string {
  let value = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0).toString(36)
}

function isTiptapNode(value: unknown): value is TiptapNode {
  if (!isRecord(value) || typeof value.type !== 'string' || !NODE_TYPES.has(value.type)) return false
  if (value.type === 'text' && typeof value.text !== 'string') return false
  if (value.text !== undefined && typeof value.text !== 'string') return false
  if (value.content !== undefined && (!Array.isArray(value.content) || value.content.some((child) => !isTiptapNode(child)))) return false
  return true
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validDate(value: unknown): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function cloneNode(node: TiptapNode): TiptapNode {
  return {
    ...node,
    attrs: node.attrs ? { ...node.attrs } : undefined,
    marks: node.marks?.map((mark) => ({ ...mark, attrs: mark.attrs ? { ...mark.attrs } : undefined })),
    content: node.content?.map(cloneNode),
  }
}
