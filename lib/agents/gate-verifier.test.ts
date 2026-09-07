import { describe, expect, it, vi } from 'vitest'

import type { AgentResultV1, VerificationResultV1 } from './contracts'
import type { AgentStepRecord } from './run-state'
import type { ManuscriptV1 } from '../manuscript/types'
import { callGateVerifier, createGateBackedVerifier, gateSummaryForStorage, mergeVerification, resolveGateVerifierConfig } from './gate-verifier'

const manuscript = { version: 1, id: 'm', title: 't', workType: 'd', meta: {}, sections: [], sources: [] } as unknown as ManuscriptV1
const step = { id: 'step-1', agent: 'writing', attempt: 1, order: 5 } as unknown as AgentStepRecord
const result: AgentResultV1 = { agent: 'writing', output: 'x', citations: [], provider: 'p', usage: { inputTokens: 1, outputTokens: 1 } }
const ok: VerificationResultV1 = { status: 'verified', issues: [], evidence: [] }

describe('gate-verifier', () => {
  it('bez konfiguracije: preskok s informacijom, ili needs_revision kad je obavezan', async () => {
    const soft = createGateBackedVerifier({ config: {}, runId: 'r', baseVerify: () => ok, loadContext: async () => ({ manuscript, artifacts: [] }) })
    expect((await soft(result, { step })).status).toBe('verified')
    expect((await soft(result, { step })).issues[0]?.code).toBe('gate_step_skipped')
    const hard = createGateBackedVerifier({ config: { required: true }, runId: 'r', baseVerify: () => ok, loadContext: async () => ({ manuscript, artifacts: [] }) })
    expect((await hard(result, { step })).status).toBe('needs_revision')
  })

  it('zove servis s wait=1 i tokenom, spaja status i issues', async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://gate.example/v1/verify?wait=1')
      expect((init.headers as Record<string, string>)['x-katedra-worker-token']).toBe('tok')
      const body = JSON.parse(String(init.body))
      expect(body.agent).toBe('writing')
      expect(body.planApproved).toBe(false)
      return new Response(JSON.stringify({ status: 'done', result: { status: 'needs_revision', issues: [{ code: 'gate_finding', step: 'argument', message: 'nema teze', blocking: true }], gate: { faza: 'pisanje', prolaz: false, koraci: [{ korak: 'argument', naziv: 'teza', stanje: 'nalaz', blokira: true }] }, gateExitCode: 1 } }), { status: 200 })
    })
    const summaries: Record<string, unknown>[] = []
    const verify = createGateBackedVerifier({
      config: { url: 'https://gate.example', token: 'tok', fetchImpl: fetchImpl as unknown as typeof fetch },
      runId: 'r', baseVerify: () => ok, loadContext: async () => ({ manuscript, artifacts: [] }), onGateResult: (s) => summaries.push(s),
    })
    const merged = await verify(result, { step })
    expect(merged.status).toBe('needs_revision')
    expect(merged.issues[0]).toMatchObject({ code: 'gate_finding', message: '[gate:argument] nema teze' })
    expect(summaries[0]).toMatchObject({ faza: 'pisanje', prolaz: false })
    expect(JSON.stringify(summaries[0])).not.toContain('nema teze')
  })

  it('pad servisa ne ruši korak: needs_revision s verifier_error', async () => {
    const verify = createGateBackedVerifier({
      config: { url: 'https://gate.example', token: 'tok', fetchImpl: (async () => new Response('x', { status: 503 })) as unknown as typeof fetch },
      runId: 'r', baseVerify: () => ok, loadContext: async () => ({ manuscript, artifacts: [] }),
    })
    const out = await verify(result, { step })
    expect(out.status).toBe('needs_revision')
    expect(out.issues[0]?.code).toBe('verifier_error')
  })

  it('mergeVerification: stroži status pobjeđuje, base failed se ne poziva dalje', () => {
    expect(mergeVerification({ status: 'needs_revision', issues: [], evidence: [] }, { status: 'verified', issues: [] }).status).toBe('needs_revision')
    expect(mergeVerification(ok, { status: 'blocked', issues: [] }).status).toBe('blocked')
    expect(gateSummaryForStorage({ status: 'verified', issues: [] })).toMatchObject({ prolaz: true })
  })

  it('config iz env', () => {
    const c = resolveGateVerifierConfig({ KATEDRA_GATE_VERIFIER_URL: 'https://x', KATEDRA_GATE_VERIFIER_TOKEN: 't', KATEDRA_GATE_VERIFIER_REQUIRED: 'true' })
    expect(c).toMatchObject({ url: 'https://x', token: 't', required: true })
  })
})


describe('gate failure invariants', () => {
  it.each(['unconfigured', 'unavailable'] as const)('preserves blocked citations when the gate is %s', async (failure) => {
    const verify = createGateBackedVerifier({
      config: failure === 'unconfigured' ? { required: true } : {
        url: 'https://gate.example', token: 'tok', fetchImpl: vi.fn().mockRejectedValue(new Error('private manuscript text')),
      },
      runId: 'r', baseVerify: () => ({ ...ok, status: 'blocked', issues: [{ code: 'unverified_source', message: 'Unverified citation' }] }),
      loadContext: async () => ({ manuscript, artifacts: [] }),
    })
    const merged = await verify(result, { step })
    expect(merged.status).toBe('blocked')
    expect(merged.issues).toHaveLength(2)
    expect(JSON.stringify(merged)).not.toContain('private manuscript text')
  })

  it('rejects malformed issue entries instead of accepting a verified response', async () => {
    const verify = createGateBackedVerifier({
      config: { url: 'https://gate.example', token: 'tok', fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { status: 'verified', issues: [null] } }))) },
      runId: 'r', baseVerify: () => ok, loadContext: async () => ({ manuscript, artifacts: [] }),
    })
    const merged = await verify(result, { step })
    expect(merged.status).toBe('needs_revision')
    expect(JSON.stringify(merged)).not.toContain('Cannot read')
  })
})


it('sends chapter scope and a legacy plan mapped to manuscript section IDs', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { status: 'verified', issues: [] } })))
  const legacyManuscript = { ...manuscript, workType: 's' as const, sections: [{ id: 'chapter-1', kind: 'chapter', title: 'Uvod', order: 0, content: '', targetWords: 600 }] } as unknown as ManuscriptV1
  await callGateVerifier({ url: 'https://gate.example', token: 'fixture', fetchImpl }, {
    runId: 'r', step: { ...step, sectionId: 'chapter-1' }, result, manuscript: legacyManuscript,
    artifacts: [{ artifactId: 'structure', stepId: 'structure', agent: 'structure', verifier: 'structure_verifier', stepOrder: 2, attempt: 1, citations: [],
      output: 'Teza: A test thesis.\n<!-- STRUKTURA:POCETAK -->\n| 1. | Uvod | 2 | Chapter program | source-1 |\n<!-- STRUKTURA:KRAJ -->',
    }],
  })
  const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
  expect(body.sectionId).toBe('chapter-1')
  expect(body.planApproved).toBe(true)
  expect(body.plan.chapters).toEqual([{ sectionId: 'chapter-1', title: 'Uvod', pages: 2, content: 'Chapter program', sources: ['source-1'] }])
})

it('aborts a timed-out service and retains the blocking citation result', async () => {
  const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('private upstream timeout detail')), { once: true })
  }))
  const verify = createGateBackedVerifier({
    config: { url: 'https://gate.example', token: 'fixture', timeoutMs: 5, fetchImpl },
    runId: 'r', baseVerify: () => ({ ...ok, status: 'blocked' }), loadContext: async () => ({ manuscript, artifacts: [] }),
  })
  const merged = await verify(result, { step })
  expect(merged.status).toBe('blocked')
  expect(merged.issues[0].code).toBe('verifier_error')
  expect(JSON.stringify(merged)).not.toContain('private upstream')
})
