import { describe, expect, it } from 'vitest'

import { buildAiUsageLedger } from './usage-ledger'

describe('buildAiUsageLedger', () => {
  it('creates a bounded operational ledger without academic content', () => {
    const ledger = buildAiUsageLedger({
      projectId: 'project-1',
      runId: 'run-1',
      mode: 'autonomous',
      steps: [
        { step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', status: 'verified', attempt: 1 },
        { step_id: 'step-2', agent: 'citation', verifier: 'citation_verifier', status: 'pending', attempt: 1 },
      ],
      results: [{
        materialId: 'result-1',
        stepId: 'step-1',
        agent: 'writing',
        verifier: 'writing_verifier',
        attempt: 1,
        provider: 'configured-provider',
        usage: { inputTokens: 12, outputTokens: 34 },
        verification: { status: 'verified' },
        billingState: 'settled',
        sectionId: 'intro',
        output: 'Ovaj tekst ne smije završiti u ledgeru.',
        prompt: 'Ni prompt ne smije završiti u ledgeru.',
        manuscript: { content: 'Ni rukopis.' },
        citations: [{ title: 'Izvor koji ne treba biti u ledgeru', quote: 'Citat' }],
        createdAt: '2026-08-16T10:01:00.000Z',
      }],
      appliedSectionIds: ['intro'],
    })

    expect(ledger.schemaVersion).toBe(1)
    expect(ledger.projectId).toBe('project-1')
    expect(ledger.runId).toBe('run-1')
    expect(ledger.rows).toHaveLength(2)
    expect(ledger.rows[0]).toMatchObject({
      stepId: 'step-1',
      agent: 'writing',
      verifier: 'writing_verifier',
      attempt: 1,
      status: 'verified',
      provider: 'configured-provider',
      inputTokens: 12,
      outputTokens: 34,
      billingState: 'settled',
      applied: 'accepted',
      occurredAt: '2026-08-16T10:01:00.000Z',
    })
    expect(ledger.rows[1]).toMatchObject({
      stepId: 'step-2',
      status: 'pending',
      billingState: 'unknown',
      applied: 'not_applicable',
      inputTokens: 0,
      outputTokens: 0,
    })

    const serialized = JSON.stringify(ledger)
    expect(serialized).not.toContain('Ovaj tekst ne smije')
    expect(serialized).not.toContain('Ni prompt')
    expect(serialized).not.toContain('Ni rukopis')
    expect(serialized).not.toContain('Izvor koji ne treba')
    expect(serialized).not.toContain('Citat')
  })

  it('keeps separate attempts and normalizes invalid usage fail-closed', () => {
    const ledger = buildAiUsageLedger({
      projectId: 'project-1',
      runId: 'run-2',
      steps: [],
      results: [
        { materialId: 'result-1', stepId: 'step-1', agent: 'sources', verifier: 'sources_verifier', attempt: 1, usage: { inputTokens: -5, outputTokens: 'bad' }, verification: { status: 'needs_revision' } },
        { materialId: 'result-2', stepId: 'step-1', agent: 'sources', verifier: 'sources_verifier', attempt: 2, usage: { input_tokens: 7.8, output_tokens: 11.2 }, verification: { status: 'verified' }, billingState: 'pending_reconciliation' },
      ],
      rejectedSectionIds: [],
    })

    expect(ledger.rows).toHaveLength(2)
    expect(ledger.rows.map((row) => row.attempt)).toEqual([1, 2])
    expect(ledger.rows[0]).toMatchObject({ inputTokens: 0, outputTokens: 0, applied: 'not_applicable' })
    expect(ledger.rows[1]).toMatchObject({ inputTokens: 7, outputTokens: 11, billingState: 'pending_reconciliation' })
    expect(ledger.totals).toMatchObject({ calls: 2, inputTokens: 7, outputTokens: 11, pendingBilling: 1 })
  })

  it('marks rejected and pending section results without trusting arbitrary applied fields', () => {
    const ledger = buildAiUsageLedger({
      projectId: 'project-1',
      runId: 'run-3',
      steps: [],
      results: [
        { materialId: 'result-rejected', stepId: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'methods', attempt: 1, verification: { status: 'verified' }, applied: 'accepted' },
        { materialId: 'result-pending', stepId: 'step-2', agent: 'writing', verifier: 'writing_verifier', sectionId: 'results', attempt: 1, verification: { status: 'generated' } },
      ],
      rejectedSectionIds: ['methods'],
    })

    expect(ledger.rows[0].applied).toBe('rejected')
    expect(ledger.rows[1].applied).toBe('pending')
  })
})
