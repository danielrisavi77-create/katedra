import { describe, expect, it, vi } from 'vitest'

import { createGatewayAgentProvider } from './provider-gateway'

describe('configured agent provider gateway', () => {
  it('executes a configured capability provider without exposing provider details to the client', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      output: JSON.stringify({ output: 'Istraženi rezultat.', citations: [] }),
      usage: { inputTokens: 12, outputTokens: 7 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const provider = createGatewayAgentProvider({
      id: 'research-gateway',
      endpoint: 'https://research.example.test/run',
      apiKey: 'gateway-secret',
      model: 'research-model',
      capabilities: ['text', 'web_research'],
      fetchImpl,
      timeoutMs: 2_000,
    })

    const events = []
    for await (const event of provider.run({ projectId: 'project-1', runId: 'run-1', attempt: 2, payload: { task: 'sources' } })) events.push(event)

    expect(events).toEqual([{ type: 'completed', value: { output: JSON.stringify({ output: 'Istraženi rezultat.', citations: [] }), usage: { inputTokens: 12, outputTokens: 7 } } }])
    expect(fetchImpl).toHaveBeenCalledWith('https://research.example.test/run', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer gateway-secret' }),
      body: expect.stringContaining('research-model'),
    }))
  })

  it('fails closed on malformed gateway responses', async () => {
    const provider = createGatewayAgentProvider({
      id: 'research-gateway',
      endpoint: 'https://research.example.test/run',
      apiKey: 'gateway-secret',
      model: 'research-model',
      capabilities: ['text', 'web_research'],
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ detail: 'private upstream failure' }), { status: 500 })),
    })

    const events = []
    for await (const event of provider.run({ projectId: 'project-1', attempt: 1, payload: { task: 'sources' } })) events.push(event)

    expect(events).toEqual([{ type: 'error', message: 'AI usluga trenutačno nije dostupna.', retryable: true }])
    expect(JSON.stringify(events)).not.toContain('private upstream failure')
  })
})
