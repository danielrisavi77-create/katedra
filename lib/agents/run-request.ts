import type { AgentRunMode, SourcePolicy } from './run-state'

export type AgentRunRequest = { mode: AgentRunMode; sourcePolicy: SourcePolicy; sectionIds: string[]; materialIds?: string[]; manuscript?: unknown }

export type AgentRunSectionSelection =
  | { ok: true; value: string[] }
  | { ok: false; error: string }

type ManuscriptSectionSource = { sections: Array<{ id: string }> }

export function parseAgentRunRequest(body: unknown):
  | { ok: true; value: AgentRunRequest }
  | { ok: false; status: 400; error: string } {
  if (!body || typeof body !== 'object') return invalid()
  const mode = (body as Record<string, unknown>).mode
  const sourcePolicy = (body as Record<string, unknown>).sourcePolicy
  const sectionIds = (body as Record<string, unknown>).sectionIds
  if (!['guided', 'accelerated', 'autonomous'].includes(String(mode))) return invalid()
  if (!['uploaded_only', 'uploaded_plus_suggestions', 'web_research'].includes(String(sourcePolicy))) return invalid()
  if (!Array.isArray(sectionIds) || sectionIds.length > 100 || sectionIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 200)) return invalid()
  const value: AgentRunRequest = { mode: mode as AgentRunMode, sourcePolicy: sourcePolicy as SourcePolicy, sectionIds }
  if (Object.prototype.hasOwnProperty.call(body, 'materialIds')) {
    const materialIds = (body as Record<string, unknown>).materialIds
    if (!Array.isArray(materialIds) || materialIds.length > 100 || materialIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 200)) return invalid()
    value.materialIds = materialIds
  }
  if (Object.prototype.hasOwnProperty.call(body, 'manuscript')) value.manuscript = (body as Record<string, unknown>).manuscript
  return { ok: true, value }
}

export function validateAgentRunSectionSelection(
  sectionIds: string[],
  manuscript: ManuscriptSectionSource,
): AgentRunSectionSelection {
  const available = new Set(manuscript.sections.map((section) => section.id))
  if (new Set(sectionIds).size !== sectionIds.length) {
    return { ok: false, error: 'Popis sekcija sadrži duplikate.' }
  }
  if (sectionIds.some((sectionId) => !available.has(sectionId))) {
    return { ok: false, error: 'Jedna ili više odabranih sekcija ne postoji u snapshotu rukopisa.' }
  }
  return { ok: true, value: [...sectionIds] }
}

function invalid() {
  return { ok: false as const, status: 400 as const, error: 'Neispravan način rada ili politika izvora.' }
}
