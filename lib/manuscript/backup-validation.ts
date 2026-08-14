import type { ManuscriptSectionV1, ManuscriptV1, TiptapNode } from './types'
import { isSafeManuscriptHref } from './links'

const MAX_SECTIONS = 100
const MAX_SOURCES = 500
const MAX_TITLE_LENGTH = 500
const MAX_SECTION_TITLE_LENGTH = 300
const MAX_NODE_DEPTH = 20
const MAX_NODE_COUNT = 5_000
const MAX_TEXT_LENGTH = 250_000
const MAX_FIELD_LENGTH = 5_000
const MAX_ATTRIBUTE_STRING_LENGTH = 2_000
const SECTION_KINDS = new Set(['frontmatter', 'chapter', 'conclusion', 'references'])
const SECTION_STATUSES = new Set(['empty', 'draft', 'review', 'approved'])
const WORK_TYPES = new Set(['s', 'z', 'd'])
const NODE_TYPES = new Set(['doc', 'paragraph', 'heading', 'text', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'hardBreak'])
const MARK_TYPES = new Set(['bold', 'italic', 'link'])

type BackupFailureReason = 'invalid' | 'project_mismatch' | 'too_large'
type BackupResult =
  | { ok: true; value: ManuscriptV1 }
  | { ok: false; reason: BackupFailureReason; error: string }

function failure(reason: BackupFailureReason, error: string): BackupResult {
  return { ok: false, reason, error }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function validString(value: unknown, maxLength = MAX_FIELD_LENGTH): value is string {
  return typeof value === 'string' && value.length <= maxLength
}

function validateAttributes(value: unknown): boolean {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  const entries = Object.entries(value)
  if (entries.length > 20) return false
  return entries.every(([, item]) => {
    if (typeof item === 'string') return item.length <= MAX_ATTRIBUTE_STRING_LENGTH
    if (typeof item === 'number') return Number.isFinite(item)
    return typeof item === 'boolean' || item === null
  })
}

function validateNode(value: unknown, counters: { count: number; text: number }, depth = 0): value is TiptapNode {
  if (!isRecord(value) || typeof value.type !== 'string' || !NODE_TYPES.has(value.type)) return false
  if (depth > MAX_NODE_DEPTH || ++counters.count > MAX_NODE_COUNT) return false
  if (value.marks !== undefined) {
    if (!Array.isArray(value.marks) || value.marks.some((mark) => {
      if (!isRecord(mark) || typeof mark.type !== 'string' || !MARK_TYPES.has(mark.type) || !validateAttributes(mark.attrs)) return true
      if (mark.type !== 'link') return false
      return !isRecord(mark.attrs) || !isSafeManuscriptHref(mark.attrs.href)
    })) return false
  }
  if (value.type === 'text') {
    if (!validString(value.text, MAX_TEXT_LENGTH)) return false
    counters.text += value.text.length
    return counters.text <= MAX_TEXT_LENGTH
  }
  if (value.text !== undefined) return false
  if (!validateAttributes(value.attrs)) return false
  if (value.content !== undefined && (!Array.isArray(value.content) || value.content.some((child) => !validateNode(child, counters, depth + 1)))) return false
  if (value.type === 'heading') {
    const level = isRecord(value.attrs) ? value.attrs.level : undefined
    if (level !== 1 && level !== 2 && level !== 3) return false
  }
  return true
}

function validateSection(value: unknown): value is ManuscriptSectionV1 {
  if (!isRecord(value)) return false
  if (!validString(value.id, 200) || !validString(value.title, MAX_SECTION_TITLE_LENGTH)) return false
  if (typeof value.order !== 'number' || !Number.isInteger(value.order) || value.order < 0) return false
  if (typeof value.kind !== 'string' || !SECTION_KINDS.has(value.kind)) return false
  if (typeof value.status !== 'string' || !SECTION_STATUSES.has(value.status)) return false
  if (value.targetWords !== undefined && (typeof value.targetWords !== 'number' || !Number.isInteger(value.targetWords) || value.targetWords < 0 || value.targetWords > 2_000_000)) return false
  if (!validString(value.updatedAt, 100)) return false
  return validateNode(value.content, { count: 0, text: 0 })
}

function validateSource(value: unknown): boolean {
  if (!isRecord(value) || !validString(value.id, 200) || !validString(value.title, MAX_SECTION_TITLE_LENGTH) || typeof value.verified !== 'boolean') return false
  return ['authors', 'year', 'urlOrDoi', 'notes'].every((field) => value[field] === undefined || validString(value[field]))
}

function validateMeta(value: unknown): boolean {
  if (!isRecord(value)) return false
  return ['institution', 'program', 'mentor', 'citationStyle', 'deadline', 'unitId', 'profileId'].every((field) => value[field] === undefined || validString(value[field]))
}

export function validateManuscriptBackup(value: unknown, projectId: string): BackupResult {
  if (!isRecord(value)) return failure('invalid', 'Backup nije objekt.')
  if (value.projectId !== projectId) return failure('project_mismatch', 'Backup pripada drugom projektu.')
  if (value.schemaVersion !== 1 || !validString(value.projectId, 200) || typeof value.title !== 'string' || typeof value.workType !== 'string' || !WORK_TYPES.has(value.workType)) {
    return failure('invalid', 'Backup ima neispravan osnovni oblik.')
  }
  if (value.title.length > MAX_TITLE_LENGTH) return failure('too_large', 'Naslov backupa je prevelik.')
  if (!Array.isArray(value.sections) || value.sections.length === 0) return failure('invalid', 'Backup nema sekcije.')
  if (value.sections.length > MAX_SECTIONS || (value.sections as unknown[]).some((section) => !validateSection(section))) return failure('too_large', 'Backup ima previše ili prevelike sekcije.')
  if (!validString(value.activeSectionId, 200) || !(value.sections as Array<{ id: string }>).some((section) => section.id === value.activeSectionId)) return failure('invalid', 'Aktivna sekcija nije valjana.')
  if (!Array.isArray(value.sources) || value.sources.length > MAX_SOURCES || value.sources.some((source) => !validateSource(source))) return failure('too_large', 'Backup ima previše ili prevelike izvore.')
  if (!validateMeta(value.meta) || !validString(value.createdAt, 100) || !validString(value.updatedAt, 100)) return failure('invalid', 'Backup ima neispravne metapodatke.')

  return {
    ok: true,
    value: {
      ...value,
      sections: [...value.sections].sort((a, b) => a.order - b.order),
      sources: [...value.sources],
    } as ManuscriptV1,
  }
}
