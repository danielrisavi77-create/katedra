import type {
  LegacyWorkType,
  ManuscriptSectionKind,
  ManuscriptSectionV1,
  ManuscriptV1,
  TiptapNode,
} from './types'

const OUTLINES: Record<LegacyWorkType, Array<[string, ManuscriptSectionKind]>> = {
  s: [
    ['Uvod', 'frontmatter'],
    ['Razrada', 'chapter'],
    ['Zaključak', 'conclusion'],
    ['Literatura', 'references'],
  ],
  z: [
    ['Uvod', 'frontmatter'],
    ['Teorijski okvir', 'chapter'],
    ['Analiza i rasprava', 'chapter'],
    ['Zaključak', 'conclusion'],
    ['Literatura', 'references'],
  ],
  d: [
    ['Uvod', 'frontmatter'],
    ['Teorijski okvir', 'chapter'],
    ['Metodologija', 'chapter'],
    ['Analiza i rasprava', 'chapter'],
    ['Zaključak', 'conclusion'],
    ['Literatura', 'references'],
  ],
}

function makeId(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return `${prefix}-${id}`
}

export function emptyDocument(): TiptapNode {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

export function createSection({
  title,
  order,
  kind = 'chapter',
  now = new Date().toISOString(),
}: {
  title: string
  order: number
  kind?: ManuscriptSectionKind
  now?: string
}): ManuscriptSectionV1 {
  return {
    id: makeId('section'),
    title: title.trim() || 'Novo poglavlje',
    kind,
    order,
    status: 'empty',
    content: emptyDocument(),
    updatedAt: now,
  }
}

export function createManuscript({
  projectId,
  title = '',
  workType,
  now = new Date().toISOString(),
}: {
  projectId: string
  title?: string
  workType: LegacyWorkType
  now?: string
}): ManuscriptV1 {
  const sections = OUTLINES[workType].map(([sectionTitle, kind], order) =>
    createSection({ title: sectionTitle, kind, order, now }),
  )

  return {
    schemaVersion: 1,
    projectId,
    title,
    workType,
    activeSectionId: sections[0].id,
    sections,
    sources: [],
    meta: {},
    createdAt: now,
    updatedAt: now,
  }
}

export function countDocumentWords(node: TiptapNode | null | undefined): number {
  const text = collectText(node).trim()
  return text ? text.split(/\s+/u).filter(Boolean).length : 0
}

export function documentText(node: TiptapNode | null | undefined): string {
  return collectText(node).replace(/\s+\n/g, '\n').trim()
}

export function plainTextDocument(text: string): TiptapNode {
  const content = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({ type: 'paragraph', content: [{ type: 'text', text: paragraph }] }))
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

export function appendPlainText(document: TiptapNode, text: string): TiptapNode {
  const imported = plainTextDocument(text).content || []
  const existing = document.content || []
  const onlyEmptyParagraph = existing.length === 1
    && existing[0].type === 'paragraph'
    && !(existing[0].content?.length)
  return { ...document, type: 'doc', content: [...(onlyEmptyParagraph ? [] : existing), ...imported] }
}

function collectText(node: TiptapNode | null | undefined): string {
  if (!node) return ''
  const own = typeof node.text === 'string' ? node.text : ''
  const separator = node.type === 'paragraph' || node.type === 'heading' ? '\n' : ' '
  return own + (node.content || []).map(collectText).join(separator)
}

export function moveSection(
  sections: ManuscriptSectionV1[],
  sectionId: string,
  targetIndex: number,
): ManuscriptSectionV1[] {
  const sourceIndex = sections.findIndex((section) => section.id === sectionId)
  if (sourceIndex < 0) return sections
  const next = [...sections]
  const [section] = next.splice(sourceIndex, 1)
  next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, section)
  return next.map((item, order) => ({ ...item, order }))
}

export function removeSection(sections: ManuscriptSectionV1[], sectionId: string): ManuscriptSectionV1[] {
  if (sections.length <= 1) return sections
  return sections.filter((section) => section.id !== sectionId).map((section, order) => ({ ...section, order }))
}
