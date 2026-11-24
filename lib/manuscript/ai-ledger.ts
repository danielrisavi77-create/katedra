export type ManuscriptAiLedgerOutcome = 'pending' | 'accepted' | 'edited' | 'rejected' | 'error'

export interface ManuscriptAiLedgerEntry {
  id: string
  occurredAt: string
  projectId: string
  sectionId: string
  sectionTitle: string
  action: string
  provider?: string
  model?: string
  requestId?: string
  sentSummary: { instruction?: string; messageCount: number; charCount: number; selectionChars: number; attachments: number; contextKinds: string[] }
  outcome: ManuscriptAiLedgerOutcome
  sources: string[]
}

const MAX_ENTRIES = 200
const MAX_TEXT = 240
export type AiLedgerStorage = Pick<Storage, 'getItem' | 'setItem'>

export function aiLedgerKey(projectId: string): string { return `katedra_ai_ledger_v1:${projectId}` }

export function readAiLedger(projectId: string, storage: AiLedgerStorage | null): ManuscriptAiLedgerEntry[] {
  if (!storage) return []
  try {
    const raw = JSON.parse(storage.getItem(aiLedgerKey(projectId)) || '[]')
    return Array.isArray(raw) ? raw.filter(isEntry).slice(0, MAX_ENTRIES) : []
  } catch { return [] }
}

export function appendAiLedgerEntry(projectId: string, entry: ManuscriptAiLedgerEntry, storage: AiLedgerStorage | null): ManuscriptAiLedgerEntry[] {
  const next = [entry, ...readAiLedger(projectId, storage)].slice(0, MAX_ENTRIES)
  try { storage?.setItem(aiLedgerKey(projectId), JSON.stringify(next)) } catch { /* local ledger is best effort */ }
  return next
}

export function updateAiLedgerEntry(projectId: string, id: string, patch: Partial<Pick<ManuscriptAiLedgerEntry, 'outcome' | 'provider' | 'model' | 'requestId'>>, storage: AiLedgerStorage | null): ManuscriptAiLedgerEntry[] {
  const next = readAiLedger(projectId, storage).map((entry) => entry.id === id ? { ...entry, ...patch } : entry)
  try { storage?.setItem(aiLedgerKey(projectId), JSON.stringify(next)) } catch { /* local ledger is best effort */ }
  return next
}

export function aiLedgerExportText(entries: ManuscriptAiLedgerEntry[]): string {
  const lines = ['Izjava o uporabi AI-ja u rukopisu', '', 'Katedra bilježi procesne metapodatke lokalno na ovom uređaju. Akademski tekst i puni sadržaj razgovora nisu dio ove izjave; bilježi se samo sažeti opis naredbe i opseg poslanog konteksta.', '']
  entries.slice().reverse().forEach((entry) => {
    lines.push(`- ${new Date(entry.occurredAt).toLocaleString('hr-HR')} · ${entry.sectionTitle} · ${entry.action} · ${entry.outcome}`)
    lines.push(`  Poslano: ${entry.sentSummary.instruction || 'kontekst aktivne sekcije'}; ${entry.sentSummary.messageCount} poruka, ${entry.sentSummary.charCount} znakova; selekcija ${entry.sentSummary.selectionChars} znakova.`)
    if (entry.provider || entry.model) lines.push(`  Sustav: ${entry.provider || 'nepoznat'}${entry.model ? ` / ${entry.model}` : ''}`)
    if (entry.sources.length) lines.push(`  Izvori: ${entry.sources.join(', ')}`)
  })
  return lines.join('\n')
}

function isEntry(value: unknown): value is ManuscriptAiLedgerEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ManuscriptAiLedgerEntry>
  return typeof item.id === 'string' && typeof item.projectId === 'string' && typeof item.sectionId === 'string' && typeof item.action === 'string' && typeof item.outcome === 'string' && Boolean(item.sentSummary && typeof item.sentSummary === 'object') && Array.isArray(item.sources)
}

export function boundedInstruction(value?: string): string | undefined {
  const clean = value?.trim()
  return clean ? clean.slice(0, MAX_TEXT) : undefined
}
