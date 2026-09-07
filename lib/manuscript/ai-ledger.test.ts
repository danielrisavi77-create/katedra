import { describe, expect, it } from 'vitest'
import { createAiLedgerAttempt, exportAiLedger, readAiLedger } from './ai-ledger'

function storage() {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}
const input = { projectId: 'project-1', proposalId: 'proposal-1', sectionId: 'section-1', action: 'draft' as const }
const now = () => '2026-09-08T00:00:00.000Z'

describe('local AI provenance', () => {
  it('records one bounded request lifecycle and actual acceptance', () => {
    const store = storage()
    const attempt = createAiLedgerAttempt(store, input, now)
    expect(attempt.decide('accepted')).toBe(false)
    attempt.setResponseIdentity('claude-test', 'trace-1')
    attempt.complete()
    attempt.complete()
    attempt.decide('accepted')
    attempt.fail()
    const entries = readAiLedger(store, input.projectId).entries
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ outcome: 'completed', decision: 'accepted', model: 'claude-test', traceRequestId: 'trace-1', billing: 'unknown' })
  })

  it.each(['fail', 'cancel'] as const)('preserves %s against late success', (method) => {
    const store = storage()
    const attempt = createAiLedgerAttempt(store, input, now)
    attempt[method]()
    attempt.complete()
    expect(readAiLedger(store, input.projectId).entries[0].outcome).toBe(method === 'fail' ? 'failed' : 'cancelled')
  })

  it('exports a sanitized versioned projection without prompt, output or foreign-project rows', () => {
    const store = storage()
    createAiLedgerAttempt(store, input, now).complete()
    const [key, raw] = [...store.values][0]
    const payload = JSON.parse(raw)
    payload.prompt = 'PRIVATE_PROMPT'
    payload.entries[0].output = 'PRIVATE_OUTPUT'
    payload.entries.push({ ...payload.entries[0], projectId: 'foreign-project', proposalId: 'foreign-proposal' })
    store.setItem(key, JSON.stringify(payload))
    const exported = exportAiLedger(store, input.projectId)
    expect(exported).not.toMatch(/PRIVATE_|foreign-project|foreign-proposal/)
    expect(JSON.parse(exported)).toMatchObject({ schemaVersion: 1, projectId: 'project-1' })
    expect(JSON.parse(exported).entries).toHaveLength(1)
  })

  it('reports unavailable storage without throwing or claiming a saved record', () => {
    const store = { getItem() { throw new Error('unavailable') }, setItem() { throw new Error('quota') } }
    const attempt = createAiLedgerAttempt(store, input, now)
    expect(attempt.saved).toBe(false)
    expect(attempt.complete()).toBe(false)
    expect(readAiLedger(store, input.projectId).status).toBe('unavailable')
  })

  it('does not relabel a completed response as cancelled after a transient write failure', () => {
    const store = storage()
    let writes = 0
    const unreliable = { ...store, setItem(key: string, value: string) {
      if (++writes === 2) throw new Error('transient quota')
      store.setItem(key, value)
    } }
    const attempt = createAiLedgerAttempt(unreliable, input, now)
    expect(attempt.complete()).toBe(false)
    attempt.cancel()
    expect(readAiLedger(store, input.projectId).entries[0].outcome).not.toBe('cancelled')
    expect(attempt.saved).toBe(false)
    attempt.decide('accepted')
    expect(readAiLedger(store, input.projectId).entries[0]).toMatchObject({ outcome: 'completed', decision: 'accepted' })
    expect(attempt.saved).toBe(false)
  })

  it('retains only the most recent 200 attempts and does not migrate accepted history into invented requests', () => {
    const store = storage()
    store.setItem('katedra_manuscript_log:project-1', JSON.stringify([{ action: 'old', txt: 'private' }]))
    for (let i = 0; i < 205; i++) createAiLedgerAttempt(store, { ...input, proposalId: `proposal-${i}` }, now)
    const ledger = readAiLedger(store, input.projectId)
    expect(ledger.entries).toHaveLength(200)
    expect(ledger.entries[0].proposalId).toBe('proposal-5')
    expect(exportAiLedger(store, input.projectId)).not.toContain('private')
  })
})
