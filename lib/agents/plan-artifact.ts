/**
 * PlanArtifactV1: strukturirani plan koji structure i planning agenti ostavljaju u svom izlazu,
 * a gate verifikator (katedra-pkg service/) treba da bi odobrio plan (perspective gate + PLAN GATE).
 *
 * Izvor istine je izlaz agenata koji je već spremljen kroz storeAgentStepResult (privatni bucket),
 * pa ne treba nova tablica ni novi payload: ovaj modul ga samo izvuče iz verificiranih artefakata.
 *
 * Oblik u izlazu agenta (doktrina to traži): blok
 *   <!-- PLAN:JSON --> { ... } <!-- /PLAN:JSON -->
 * Rezerva: markdown tablica između <!-- STRUKTURA:POCETAK --> i <!-- STRUKTURA:KRAJ --> i redak "Teza:".
 */

import type { ManuscriptSectionV1 } from '../manuscript/types'
import type { VerifiedAgentArtifactContext } from './artifact-chain'

export interface PlanPerspective { label: string; position: string; why: string }
export interface PlanChapter { sectionId?: string; title?: string; pages?: number; content?: string; sources?: string[] }
export interface PlanArtifactV1 {
  thesis?: string
  question?: string
  perspectives: PlanPerspective[]
  chapters: PlanChapter[]
}

const JSON_BLOCK = /<!--\s*PLAN:JSON\s*-->([\s\S]*?)<!--\s*\/PLAN:JSON\s*-->/i
const TABLE_BLOCK = /<!--\s*STRUKTURA:POCETAK\s*-->([\s\S]*?)<!--\s*STRUKTURA:KRAJ\s*-->/i
const THESIS_LINE = /^\s*\**\s*teza\s*\**\s*[:：]\s*(.+?)\s*$/im

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function parseJsonBlock(output: string): Partial<PlanArtifactV1> | null {
  const match = JSON_BLOCK.exec(output)
  if (!match) return null
  try {
    const raw = JSON.parse(match[1].replace(/```json|```/g, '').trim()) as Record<string, unknown>
    const perspectives = Array.isArray(raw.perspectives)
      ? raw.perspectives
        .map((p) => (p && typeof p === 'object') ? {
          label: asString((p as Record<string, unknown>).label) || '',
          position: asString((p as Record<string, unknown>).position) || '',
          why: asString((p as Record<string, unknown>).why) || '',
        } : null)
        .filter((p): p is PlanPerspective => p !== null && Boolean(p.label && p.position))
      : []
    const chapters: PlanChapter[] = []
    if (Array.isArray(raw.chapters)) {
      for (const c of raw.chapters) {
        if (!c || typeof c !== 'object') continue
        const r = c as Record<string, unknown>
        const chapter: PlanChapter = {
          sectionId: asString(r.sectionId),
          title: asString(r.title),
          pages: typeof r.pages === 'number' ? r.pages : undefined,
          content: asString(r.content),
          sources: Array.isArray(r.sources) ? r.sources.filter((s): s is string => typeof s === 'string') : undefined,
        }
        if (chapter.sectionId || chapter.title) chapters.push(chapter)
      }
    }
    return { thesis: asString(raw.thesis), question: asString(raw.question), perspectives, chapters }
  } catch {
    return null
  }
}

function parseTable(output: string): PlanChapter[] {
  const match = TABLE_BLOCK.exec(output)
  if (!match) return []
  const chapters: PlanChapter[] = []
  for (const line of match[1].split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 4 || !/^\d+(\.\d+)?\.?$/.test(cells[1] || '')) continue
    const pages = Number.parseInt(cells[3] || '', 10)
    chapters.push({
      title: cells[2],
      pages: Number.isFinite(pages) ? pages : undefined,
      content: cells[4] || undefined,
      sources: cells[5] ? cells[5].split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    })
  }
  return chapters
}

/** Spoji: kasniji artefakt (planning) nadjačava raniji (structure) po polju, ne u cijelosti. */
export function extractPlanArtifact(
  artifacts: readonly VerifiedAgentArtifactContext[],
  sections: readonly Pick<ManuscriptSectionV1, 'id' | 'title' | 'kind'>[] = [],
): PlanArtifactV1 | null {
  // Legacy tables have titles only. Match an existing chapter uniquely, never by position.
  const resolveChapter = (chapter: PlanChapter): PlanChapter => {
    if (chapter.sectionId || !chapter.title) return chapter
    const normalize = (title: string) => title.trim().replace(/\s+/g, ' ').toLowerCase()
    const matches = sections.filter((section) => (section.kind === 'chapter' || section.kind === 'conclusion')
      && normalize(section.title) === normalize(chapter.title!))
    return matches.length === 1 ? { ...chapter, sectionId: matches[0].id } : chapter
  }
  const ordered = [...artifacts]
    .filter((a) => a.agent === 'structure' || a.agent === 'planning')
    .sort((a, b) => a.stepOrder - b.stepOrder || a.attempt - b.attempt)
  if (!ordered.length) return null
  const plan: PlanArtifactV1 = { perspectives: [], chapters: [] }
  for (const artifact of ordered) {
    const json = parseJsonBlock(artifact.output)
    if (json) {
      if (json.thesis) plan.thesis = json.thesis
      if (json.question) plan.question = json.question
      if (json.perspectives?.length) plan.perspectives = json.perspectives
      if (json.chapters?.length) plan.chapters = mergeChapters(plan.chapters, json.chapters.map(resolveChapter))
      continue
    }
    const thesis = THESIS_LINE.exec(artifact.output)?.[1]
    if (thesis && !plan.thesis) plan.thesis = thesis
    const table = parseTable(artifact.output)
    if (table.length) plan.chapters = mergeChapters(plan.chapters, table.map(resolveChapter))
  }
  return plan.thesis || plan.chapters.length || plan.perspectives.length ? plan : null
}

function mergeChapters(base: PlanChapter[], incoming: PlanChapter[]): PlanChapter[] {
  const key = (c: PlanChapter) => c.sectionId || (c.title || '').toLowerCase()
  const map = new Map(base.map((c) => [key(c), c]))
  for (const c of incoming) {
    const existing = map.get(key(c))
    map.set(key(c), existing ? { ...existing, ...stripUndefined(c) } : c)
  }
  return [...map.values()]
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}

/** Plan je "odobren" za gate kad ima ono što PLAN GATE traži; app ne prosuđuje kvalitetu, samo prisutnost. */
export function planLooksApprovable(plan: PlanArtifactV1 | null, workType: 's' | 'z' | 'd'): boolean {
  if (!plan || !plan.thesis || !plan.chapters.length) return false
  if (workType !== 's' && plan.perspectives.length < 2) return false
  return plan.chapters.every((c) => Boolean(c.content) && Boolean(c.sources?.length))
}
