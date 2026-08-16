import { describe, expect, it, vi } from 'vitest'

import type { AgentProvider } from './contracts'
import { createProviderBackedExecutor } from './provider-worker'
import { loadRunManuscriptContext } from './run-context-loader'

const manuscript = {
  schemaVersion: 1 as const,
  projectId: 'project-1',
  title: 'Rad',
  workType: 's' as const,
  activeSectionId: 'section-1',
  sections: [{ id: 'section-1', title: 'Uvod', kind: 'chapter' as const, order: 0, status: 'draft' as const, content: { type: 'doc' as const, content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Teza.' }] }] }, updatedAt: '2026-08-14T10:00:00.000Z' }],
  sources: [{ id: 'source-1', title: 'Izvor', urlOrDoi: 'https://example.com', verified: true }],
  meta: {},
  createdAt: '2026-08-14T10:00:00.000Z',
  updatedAt: '2026-08-14T10:00:00.000Z',
}

function billingDependencies() {
  const rpc = vi.fn(async (name: string) => name === 'katedra_reserve_request'
    ? { data: { status: 'reserved' }, error: null }
    : name === 'katedra_consume'
      ? { data: { status: 'settled' }, error: null }
      : { data: { status: 'released' }, error: null })
  return { db: { rpc }, userId: 'user-1', model: 'agent-model' }
}

describe('provider-backed worker context', () => {
  it('loads and validates a manuscript from private storage', async () => {
    const storage = { download: vi.fn(async () => new TextEncoder().encode(JSON.stringify({ manuscript })).buffer) }

    await expect(loadRunManuscriptContext(storage, { storagePath: 'user/project/run/manuscript-context.json', projectId: 'project-1' })).resolves.toEqual(manuscript)
  })

  it('passes only the scoped section and verified sources to the provider', async () => {
    const provider: AgentProvider = {
      id: 'fake',
      capabilities: ['text'],
      async *run(input) {
        const payload = JSON.stringify(input.payload)
        expect(payload).toContain('Teza.')
        expect(payload).toContain('https://example.com')
        expect(payload).toContain('Jasnija teza.')
        expect(payload).toContain('sourceCandidates')
        expect(payload).not.toContain('verifiedSources')
        yield { type: 'completed', value: { output: 'Nacrt.', usage: { inputTokens: 10, outputTokens: 4 } } }
      },
    }
    const execute = createProviderBackedExecutor({
      projectId: 'project-1',
      runId: 'run-1',
      loadContext: async () => manuscript,
      loadMaterials: async () => [{ id: 'material-1', name: 'Upute', kind: 'mentor', text: 'Jasnija teza.', warnings: [] }],
      router: { providerFor: () => provider },
      billing: billingDependencies(),
    })

    await expect(execute({ id: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'section-1', order: 1, attempt: 1, status: 'pending' })).resolves.toMatchObject({
      output: 'Nacrt.',
      provider: 'fake',
      citations: [{ id: 'source-1', verified: false }],
    })
  })

  it('passes verified outputs from earlier agents into the next provider context', async () => {
    const provider: AgentProvider = {
      id: 'fake',
      capabilities: ['text'],
      async *run(input) {
        const payload = JSON.stringify(input.payload)
        expect(payload).toContain('Verificirani plan')
        expect(payload).not.toContain('Neprovjereni plan')
        yield { type: 'completed', value: { output: 'Nacrt iz plana.', usage: { inputTokens: 10, outputTokens: 4 } } }
      },
    }
    const execute = createProviderBackedExecutor({
      projectId: 'project-1',
      runId: 'run-1',
      loadContext: async () => manuscript,
      loadResults: async () => [
        {
          schemaVersion: 1,
          kind: 'agent-step-result',
          materialId: 'agent-result:planning:1',
          projectId: 'project-1',
          runId: 'run-1',
          stepId: 'planning-step',
          stepOrder: 3,
          agent: 'planning',
          verifier: 'planning_verifier',
          attempt: 1,
          output: 'Verificirani plan',
          citations: [],
          verification: { status: 'verified', issues: [], evidence: [] },
          provider: 'planner',
          usage: { inputTokens: 8, outputTokens: 6 },
          createdAt: '2026-08-16T10:00:00.000Z',
          expiresAt: '2026-08-19T10:00:00.000Z',
        },
        {
          schemaVersion: 1,
          kind: 'agent-step-result',
          materialId: 'agent-result:bad:1',
          projectId: 'project-1',
          runId: 'run-1',
          stepId: 'bad-step',
          stepOrder: 2,
          agent: 'structure',
          verifier: 'structure_verifier',
          attempt: 1,
          output: 'Neprovjereni plan',
          citations: [],
          verification: { status: 'needs_revision', issues: [], evidence: [] },
          provider: 'planner',
          usage: { inputTokens: 8, outputTokens: 6 },
          createdAt: '2026-08-16T10:00:00.000Z',
          expiresAt: '2026-08-19T10:00:00.000Z',
        },
      ],
      router: { providerFor: () => provider },
      billing: billingDependencies(),
    })

    await expect(execute({ id: 'run-1:writing:section-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'section-1', order: 4, attempt: 1, status: 'pending' })).resolves.toMatchObject({
      output: 'Nacrt iz plana.',
      inputArtifactIds: ['agent-result:planning:1'],
    })
  })

  it('uses the billing lifecycle when worker billing is configured', async () => {
    const provider: AgentProvider = {
      id: 'fake',
      capabilities: ['text'],
      async *run() {
        yield { type: 'completed', value: { output: 'Naplaćeni nacrt.', usage: { inputTokens: 4, outputTokens: 5 } } }
      },
    }
    const rpc = vi.fn(async (name: string) => name === 'katedra_reserve_request'
      ? { data: { status: 'reserved' }, error: null }
      : name === 'katedra_consume'
        ? { data: { status: 'settled' }, error: null }
        : { data: { status: 'released' }, error: null })
    const execute = createProviderBackedExecutor({
      projectId: 'project-1',
      runId: 'run-1',
      loadContext: async () => manuscript,
      router: { providerFor: () => provider },
      billing: { db: { rpc }, userId: 'user-1', model: 'agent-model' },
    })

    await expect(execute({ id: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'section-1', order: 1, attempt: 1, status: 'pending' })).resolves.toMatchObject({ output: 'Naplaćeni nacrt.' })
    expect(rpc).toHaveBeenCalledWith('katedra_consume', expect.objectContaining({ p_request_id: 'run-1:step-1:1', p_project_id: 'project-1' }))
  })

  it('keeps a DOI as DOI evidence instead of labeling it as a URL', async () => {
    const provider: AgentProvider = {
      id: 'fake',
      capabilities: ['text'],
      async *run() {
        yield { type: 'completed', value: { output: 'Nacrt.', usage: { inputTokens: 10, outputTokens: 4 } } }
      },
    }
    const execute = createProviderBackedExecutor({
      projectId: 'project-1',
      runId: 'run-1',
      loadContext: async () => ({ ...manuscript, sources: [{ id: 'source-doi', title: 'DOI izvor', urlOrDoi: '10.1234/example', verified: true }] }),
      router: { providerFor: () => provider },
      billing: billingDependencies(),
    })

    await expect(execute({ id: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'section-1', order: 1, attempt: 1, status: 'pending' })).resolves.toMatchObject({
      citations: [{ id: 'source-doi', doi: '10.1234/example', verified: false }],
    })
  })

  it('normalizes DOI URLs from the manuscript before building inherited evidence', async () => {
    const provider: AgentProvider = {
      id: 'fake',
      capabilities: ['text'],
      async *run() {
        yield { type: 'completed', value: { output: 'Nacrt.', usage: { inputTokens: 10, outputTokens: 4 } } }
      },
    }
    const execute = createProviderBackedExecutor({
      projectId: 'project-1',
      runId: 'run-1',
      loadContext: async () => ({ ...manuscript, sources: [{ id: 'source-doi-url', title: 'DOI URL izvor', urlOrDoi: 'https://doi.org/10.1234/example', verified: true }] }),
      router: { providerFor: () => provider },
      billing: billingDependencies(),
    })

    await expect(execute({ id: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'section-1', order: 1, attempt: 1, status: 'pending' })).resolves.toMatchObject({
      citations: [{ id: 'source-doi-url', doi: '10.1234/example', verified: false }],
    })
  })

  it('does not treat inherited manuscript sources as independently verified without a verifier', async () => {
    const provider: AgentProvider = {
      id: 'fake',
      capabilities: ['text'],
      async *run() {
        yield { type: 'completed', value: { output: 'Nacrt.', usage: { inputTokens: 10, outputTokens: 4 } } }
      },
    }
    const execute = createProviderBackedExecutor({
      projectId: 'project-1',
      runId: 'run-1',
      loadContext: async () => ({ ...manuscript, sources: [{ id: 'source-unchecked', title: 'Nepotvrđen izvor', urlOrDoi: '10.1234/example', verified: true }] }),
      router: { providerFor: () => provider },
      billing: billingDependencies(),
    })

    await expect(execute({ id: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'section-1', order: 1, attempt: 1, status: 'pending' })).resolves.toMatchObject({
      citations: [{ id: 'source-unchecked', doi: '10.1234/example', verified: false }],
    })
  })

  it('replaces provider citation trust with the independent verification result', async () => {
    const provider: AgentProvider = {
      id: 'fake',
      capabilities: ['text'],
      async *run() {
        yield {
          type: 'completed',
          value: {
            output: JSON.stringify({
              output: 'Nacrt s novim izvorom.',
              citations: [{ id: 'source-new', doi: '10.1000/example', verified: true }],
              claims: [{ id: 'claim-new', text: 'Nacrt s novim izvorom.', citationIds: ['source-new'] }],
            }),
            usage: { inputTokens: 10, outputTokens: 4 },
          },
        }
      },
    }
    const verifyCitations = vi.fn(async (citations) => citations.map((citation) => ({
      ...citation,
      verified: citation.id === 'source-new',
      verification: { status: citation.id === 'source-new' ? 'verified' : 'needs_review', method: 'crossref', checkedAt: '2026-08-16T12:00:00.000Z' },
    })))
    const execute = createProviderBackedExecutor({
      projectId: 'project-1',
      runId: 'run-1',
      loadContext: async () => manuscript,
      verifyCitations,
      router: { providerFor: () => provider },
      billing: billingDependencies(),
    })

    await expect(execute({ id: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'section-1', order: 1, attempt: 1, status: 'pending' })).resolves.toMatchObject({
      citations: expect.arrayContaining([expect.objectContaining({ id: 'source-new', verified: true, verification: expect.objectContaining({ status: 'verified' }) })]),
    })
    expect(verifyCitations).toHaveBeenCalled()
  })

  it('keeps scan images as provider-native attachments instead of embedding base64 in text context', async () => {
    const provider: AgentProvider = {
      id: 'vision',
      capabilities: ['text', 'vision'],
      async *run(input) {
        const payload = input.payload as { messages: Array<{ content: string }>; images?: Array<{ mimeType: string; data: string }> }
        expect(payload.images).toEqual([{ mimeType: 'image/png', data: 'iVBORw==' }])
        expect(payload.messages[0].content).not.toContain('iVBORw==')
        yield { type: 'completed', value: { output: 'Analiza skena.', usage: { inputTokens: 10, outputTokens: 4 } } }
      },
    }
    const execute = createProviderBackedExecutor({
      projectId: 'project-1',
      runId: 'run-1',
      loadContext: async () => manuscript,
      loadMaterials: async () => [{ id: 'scan-1', name: 'Sken', kind: 'scan', warnings: [], image: { mimeType: 'image/png', data: 'iVBORw==' } }],
      router: { providerFor: () => provider },
      billing: billingDependencies(),
    })

    await expect(execute({ id: 'step-vision', agent: 'intake', verifier: 'intake_verifier', order: 0, attempt: 1, status: 'pending' })).resolves.toMatchObject({ output: 'Analiza skena.' })
  })

  it('uses the selected provider model for billing attribution', async () => {
    const provider: AgentProvider = {
      id: 'research-gateway',
      model: 'research-model',
      capabilities: ['text'],
      async *run() {
        yield { type: 'completed', value: { output: 'Rezultat.', usage: { inputTokens: 10, outputTokens: 4 } } }
      },
    }
    const rpc = vi.fn(async (name: string) => name === 'katedra_reserve_request'
      ? { data: { status: 'reserved' }, error: null }
      : name === 'katedra_consume'
        ? { data: { status: 'settled' }, error: null }
        : { data: { status: 'released' }, error: null })
    const execute = createProviderBackedExecutor({
      projectId: 'project-1',
      runId: 'run-1',
      loadContext: async () => manuscript,
      router: { providerFor: () => provider },
      billing: { db: { rpc }, userId: 'user-1', model: 'default-model' },
    })

    await execute({ id: 'step-model', agent: 'writing', verifier: 'writing_verifier', sectionId: 'section-1', order: 1, attempt: 1, status: 'pending' })

    expect(rpc).toHaveBeenCalledWith('katedra_consume', expect.objectContaining({ p_model: 'research-model' }))
  })

  it('bounds the default billing request id when a section id is long', async () => {
    const provider: AgentProvider = {
      id: 'fake',
      capabilities: ['text'],
      async *run() {
        yield { type: 'completed', value: { output: 'Nacrt.', usage: { inputTokens: 10, outputTokens: 4 } } }
      },
    }
    const rpc = vi.fn(async (name: string) => name === 'katedra_reserve_request'
      ? { data: { status: 'reserved' }, error: null }
      : name === 'katedra_consume'
        ? { data: { status: 'settled' }, error: null }
        : { data: { status: 'released' }, error: null })
    const execute = createProviderBackedExecutor({
      projectId: 'project-1',
      runId: 'run-1',
      loadContext: async () => manuscript,
      router: { providerFor: () => provider },
      billing: { db: { rpc }, userId: 'user-1', model: 'agent-model' },
    })

    await execute({ id: `run-1:writing:${'x'.repeat(200)}`, agent: 'writing', verifier: 'writing_verifier', sectionId: 'section-1', order: 1, attempt: 1, status: 'pending' })

    const reservation = (rpc.mock.calls as unknown as Array<[string, Record<string, unknown>]>).find(([name]) => name === 'katedra_reserve_request')?.[1]
    expect(reservation.p_request_id).toHaveLength(78)
    expect(reservation.p_request_id).toMatch(/^katedra-agent-[a-f0-9]{64}$/)
  })
})
