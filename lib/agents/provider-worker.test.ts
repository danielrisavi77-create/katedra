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
        expect(JSON.stringify(input.payload)).toContain('Teza.')
        expect(JSON.stringify(input.payload)).toContain('https://example.com')
        expect(JSON.stringify(input.payload)).toContain('Jasnija teza.')
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
      citations: [{ id: 'source-1', verified: true }],
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
      citations: [{ id: 'source-doi', doi: '10.1234/example', verified: true }],
    })
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
