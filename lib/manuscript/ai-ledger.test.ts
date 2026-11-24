import { describe, expect, it } from 'vitest'

import { aiLedgerExportText, appendAiLedgerEntry, readAiLedger, updateAiLedgerEntry, type ManuscriptAiLedgerEntry } from './ai-ledger'

describe('local editor AI ledger', () => {
  it('records, updates and exports process metadata without full text', () => {
    const storage = new Map<string, string>() as unknown as Storage
    storage.getItem = (key) => storage.get(key) || null
    storage.setItem = (key, value) => { storage.set(key, value) }
    const entry: ManuscriptAiLedgerEntry = { id: 'a1', occurredAt: '2026-08-22T10:00:00Z', projectId: 'p', sectionId: 's', sectionTitle: 'Uvod', action: 'Poboljšaj argument', sentSummary: { instruction: 'Sažmi', messageCount: 2, charCount: 120, selectionChars: 30, attachments: 1, contextKinds: ['section'] }, outcome: 'pending', sources: ['source-1'] }
    appendAiLedgerEntry('p', entry, storage)
    updateAiLedgerEntry('p', 'a1', { outcome: 'accepted', provider: 'router', model: 'model-x' }, storage)
    const entries = readAiLedger('p', storage)
    expect(entries[0].outcome).toBe('accepted')
    expect(aiLedgerExportText(entries)).toContain('Poboljšaj argument')
    expect(aiLedgerExportText(entries)).toContain('sažeti opis naredbe')
    expect(aiLedgerExportText(entries)).not.toContain('Nova tajna akademska rečenica')
  })
})
