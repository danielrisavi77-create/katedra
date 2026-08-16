import { describe, expect, it, vi } from 'vitest'

import { createAnthropicAgentProvider } from './anthropic-provider'

function streamFromChunks(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

function responseFromChunks(chunks: Uint8Array[], status = 200) {
  return new Response(streamFromChunks(chunks), {
    status,
    headers: { 'content-type': 'text/event-stream' },
  })
}

async function eventsFrom(provider: ReturnType<typeof createAnthropicAgentProvider>, payload: unknown) {
  const events = []
  for await (const event of provider.run({ projectId: 'project-1', payload, attempt: 1 })) events.push(event)
  return events
}

describe('Anthropic AgentProvider', () => {
  it('streams text deltas across arbitrary SSE and UTF-8 chunk boundaries', async () => {
    const encoder = new TextEncoder()
    const body = [
      'event: message_start\r\ndata: {"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":0}}}\r\n\r\n',
      'event: content_block_delta\r\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Ča"}}\r\n\r\n',
      'event: content_block_delta\r\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"k i tekst"}}\r\n\r\n',
      'event: message_delta\r\ndata: {"type":"message_delta","usage":{"output_tokens":7}}\r\n\r\n',
    ].join('')
    const encoded = encoder.encode(body)
    const splitAt = encoded.findIndex((byte) => byte === 0xC4) + 1
    const fetchImpl = vi.fn().mockResolvedValue(responseFromChunks([
      encoded.slice(0, 29),
      encoded.slice(29, splitAt),
      encoded.slice(splitAt, splitAt + 8),
      encoded.slice(splitAt + 8),
    ]))
    const provider = createAnthropicAgentProvider({ apiKey: 'test-key', fetchImpl, model: 'test-model' })

    const events = await eventsFrom(provider, {
      system: 'Piši akademski.',
      messages: [{ role: 'user', content: 'Napiši uvod.' }],
    })

    expect(events).toEqual([
      { type: 'delta', value: 'Ča' },
      { type: 'delta', value: 'k i tekst' },
      { type: 'completed', value: { output: 'Čak i tekst', usage: { inputTokens: 12, outputTokens: 7 } } },
    ])
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-key', 'anthropic-version': '2023-06-01' }),
      }),
    )
  })

  it('keeps the greatest observed usage values and flushes a final unterminated event', async () => {
    const encoder = new TextEncoder()
    const fetchImpl = vi.fn().mockResolvedValue(responseFromChunks([
      encoder.encode('data: {"type":"message_start","message":{"usage":{"input_tokens":9}}}\n\ndata: {"type":"message_delta","usage":{"output_tokens":2}}\n\ndata: {"type":"message_delta","usage":{"output_tokens":8}}'),
    ]))
    const provider = createAnthropicAgentProvider({ apiKey: 'test-key', fetchImpl })

    const events = await eventsFrom(provider, { messages: [{ role: 'user', content: 'Test' }] })

    expect(events).toEqual([
      { type: 'completed', value: { output: '', usage: { inputTokens: 9, outputTokens: 8 } } },
    ])
  })

  it('sends validated scan images as native vision blocks only when vision is enabled', async () => {
    const encoder = new TextEncoder()
    const fetchImpl = vi.fn().mockResolvedValue(responseFromChunks([
      encoder.encode('data: {"type":"message_delta","usage":{"output_tokens":1}}\n\n'),
    ]))
    const provider = createAnthropicAgentProvider({ apiKey: 'test-key', fetchImpl, enableVision: true })

    await expect(eventsFrom(provider, {
      messages: [{ role: 'user', content: 'Analiziraj sken.' }],
      images: [{ mimeType: 'image/png', data: 'iVBORw0KGgo=' }],
    })).resolves.toEqual([{ type: 'completed', value: { output: '', usage: { inputTokens: 0, outputTokens: 1 } } }])
    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(requestBody.messages[0].content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'image', source: expect.objectContaining({ media_type: 'image/png', data: 'iVBORw0KGgo=' }) }),
    ]))
  })

  it('fails closed when an image is sent to a text-only provider', async () => {
    const fetchImpl = vi.fn()
    const provider = createAnthropicAgentProvider({ apiKey: 'test-key', fetchImpl })

    await expect(eventsFrom(provider, {
      messages: [{ role: 'user', content: 'Analiziraj sken.' }],
      images: [{ mimeType: 'image/png', data: 'iVBORw0KGgo=' }],
    })).resolves.toEqual([{ type: 'error', message: expect.stringMatching(/slika/i) }])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([[429, true], [500, true], [400, false]])('sanitizes provider HTTP %i responses and marks retryability', async (status, retryable) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'internal provider detail' } }), { status }))
    const provider = createAnthropicAgentProvider({ apiKey: 'test-key', fetchImpl })

    const events = await eventsFrom(provider, { messages: [{ role: 'user', content: 'Test' }] })

    expect(events).toEqual([expect.objectContaining({ type: 'error' })])
    expect(events[0].message).not.toContain('internal provider detail')
    expect(events[0].message).not.toContain('Anthropic')
    const firstEvent = events[0]
    expect(firstEvent?.type === 'error' ? firstEvent.retryable : undefined).toBe(retryable ? true : undefined)
  })

  it('emits a validation error when payload has no messages', async () => {
    const fetchImpl = vi.fn()
    const provider = createAnthropicAgentProvider({ apiKey: 'test-key', fetchImpl })

    const events = await eventsFrom(provider, { system: 'Nema poruka.' })

    expect(events).toEqual([expect.objectContaining({ type: 'error', message: expect.stringMatching(/poruk/i) })])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('turns an aborted provider request into a sanitized error event', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException('request aborted', 'AbortError')
      return new Response()
    })
    const provider = createAnthropicAgentProvider({ apiKey: 'test-key', fetchImpl })

    const events = await eventsFrom(provider, {
      messages: [{ role: 'user', content: 'Test' }],
      signal: controller.signal,
    })

    expect(events).toEqual([expect.objectContaining({ type: 'error', message: expect.stringMatching(/prekinut/i) })])
    expect(events[0].message).not.toContain('request aborted')
  })

  it('aborts a provider request that exceeds the configured timeout', async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('request timed out', 'AbortError')), { once: true })
    }))
    const provider = createAnthropicAgentProvider({ apiKey: 'test-key', fetchImpl, timeoutMs: 5 })

    const events = await eventsFrom(provider, { messages: [{ role: 'user', content: 'Test' }] })

    expect(events).toEqual([{ type: 'error', message: 'AI zahtjev traje predugo.', retryable: true }])
  })

  it('supports the worker production timeout of 150 seconds', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('request timed out', 'AbortError')), { once: true })
      }))
      const provider = createAnthropicAgentProvider({ apiKey: 'test-key', fetchImpl, timeoutMs: 150_000 })
      const eventsPromise = eventsFrom(provider, { messages: [{ role: 'user', content: 'Test' }] })

      await vi.advanceTimersByTimeAsync(149_999)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)

      await expect(eventsPromise).resolves.toEqual([{ type: 'error', message: 'AI zahtjev traje predugo.', retryable: true }])
    } finally {
      vi.useRealTimers()
    }
  })
})
