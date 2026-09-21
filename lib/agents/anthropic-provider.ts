import type { AgentEvent, AgentInput, AgentProvider, UsageRecord } from './contracts'

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_TIMEOUT_MS = 90_000

type AnthropicMessage = {
  role: 'user' | 'assistant'
  content: string | unknown[]
}

type AnthropicPayload = {
  messages?: AnthropicMessage[]
  system?: string
  signal?: AbortSignal
  maxTokens?: number
  images?: Array<{ mimeType: string; data: string }>
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function errorEvent(message: string, retryable = false): AgentEvent {
  return { type: 'error', message, ...(retryable ? { retryable: true } : {}) }
}

function readPayload(payload: unknown): { ok: true, value: AnthropicPayload } | { ok: false, message: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, message: 'Nedostaju poruke za AI zahtjev.' }
  }

  const value = payload as AnthropicPayload
  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    return { ok: false, message: 'Nedostaju poruke za AI zahtjev.' }
  }
  if (value.system !== undefined && typeof value.system !== 'string') {
    return { ok: false, message: 'Sistemska uputa nije valjana.' }
  }
  if (value.maxTokens !== undefined && (!Number.isInteger(value.maxTokens) || value.maxTokens < 1)) {
    return { ok: false, message: 'Maksimalan broj tokena nije valjan.' }
  }
  if (value.images !== undefined && (!Array.isArray(value.images) || value.images.length > 4 || !value.images.every(isImageAttachment))) {
    return { ok: false, message: 'Skenovi za AI zahtjev nisu valjani.' }
  }
  for (const message of value.messages) {
    if (!message || typeof message !== 'object' || (message.role !== 'user' && message.role !== 'assistant')) {
      return { ok: false, message: 'Poruke za AI zahtjev nisu valjane.' }
    }
    if (typeof message.content !== 'string' && !Array.isArray(message.content)) {
      return { ok: false, message: 'Poruke za AI zahtjev nisu valjane.' }
    }
  }
  return { ok: true, value }
}

function parseSseEvent(data: string): { text?: string, usage?: Partial<UsageRecord> } | null {
  if (!data || data === '[DONE]') return null

  let event: unknown
  try {
    event = JSON.parse(data)
  } catch {
    throw new Error('malformed-sse')
  }

  if (!event || typeof event !== 'object') throw new Error('malformed-sse')
  const candidate = event as {
    type?: unknown
    delta?: { type?: unknown, text?: unknown }
    message?: { usage?: { input_tokens?: unknown, output_tokens?: unknown } }
    usage?: { input_tokens?: unknown, output_tokens?: unknown }
  }
  const usage = {
    inputTokens: Number(candidate.message?.usage?.input_tokens ?? candidate.usage?.input_tokens),
    outputTokens: Number(candidate.message?.usage?.output_tokens ?? candidate.usage?.output_tokens),
  }
  const validUsage = {
    ...(Number.isFinite(usage.inputTokens) && usage.inputTokens >= 0 ? { inputTokens: usage.inputTokens } : {}),
    ...(Number.isFinite(usage.outputTokens) && usage.outputTokens >= 0 ? { outputTokens: usage.outputTokens } : {}),
  }

  if (candidate.type === 'content_block_delta') {
    if (candidate.delta?.type !== 'text_delta' || typeof candidate.delta.text !== 'string') {
      throw new Error('malformed-sse')
    }
    return { text: candidate.delta.text, usage: validUsage }
  }
  if (typeof candidate.type !== 'string') throw new Error('malformed-sse')
  return { usage: validUsage }
}

function statusMessage(status: number) {
  if (status === 429) return 'AI usluga je trenutačno zauzeta. Pokušajte ponovno za trenutak.'
  return 'AI usluga trenutačno nije dostupna. Pokušajte ponovno kasnije.'
}

function requestFailureMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return 'AI zahtjev je prekinut.'
  return 'AI usluga trenutačno nije dostupna. Pokušajte ponovno kasnije.'
}

export function createAnthropicAgentProvider({
  apiKey,
  fetchImpl = fetch,
  model = DEFAULT_MODEL,
  endpoint = DEFAULT_ENDPOINT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  enableVision = false,
}: {
  apiKey: string
  fetchImpl?: FetchImplementation
  model?: string
  endpoint?: string
  timeoutMs?: number
  enableVision?: boolean
}): AgentProvider {
  return {
    id: 'anthropic',
    model,
    capabilities: enableVision ? ['text', 'vision'] : ['text'],
    async *run(input: AgentInput): AsyncIterable<AgentEvent> {
      const parsed = readPayload(input.payload)
      if (parsed.ok === false) {
        yield errorEvent(parsed.message)
        return
      }
      if (!apiKey.trim()) {
        yield errorEvent('AI usluga trenutačno nije konfigurirana.')
        return
      }

      if (parsed.value.images?.length && !enableVision) {
        yield errorEvent('AI provider nema aktiviranu podrĹˇku za obradu slika.')
        return
      }

      const { messages, system, signal, maxTokens, images } = parsed.value
      const providerMessages = images?.length ? addImagesToMessages(messages!, images) : messages
      const requestTimeout = createRequestTimeout(signal, timeoutMs)
      try {
        let response: Response
        try {
          response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': ANTHROPIC_VERSION,
            },
            body: JSON.stringify({
              model,
              stream: true,
              max_tokens: maxTokens ?? 4096,
              ...(system ? { system } : {}),
              messages: providerMessages,
            }),
            signal: requestTimeout.signal,
          })
        } catch (error) {
          yield errorEvent(requestTimeout.didTimeout() ? 'AI zahtjev traje predugo.' : requestFailureMessage(error), requestTimeout.didTimeout())
          return
        }

        if (!response.ok) {
          yield errorEvent(statusMessage(response.status), response.status === 429 || response.status >= 500)
          return
        }
        if (!response.body) {
          yield errorEvent('AI usluga vratila je neispravan odgovor.', true)
          return
        }

        const decoder = new TextDecoder()
        const reader = response.body.getReader()
        let pending = ''
        let output = ''
        let inputTokens = 0
        let outputTokens = 0

        const applyEvent = (data: string) => {
          const parsedEvent = parseSseEvent(data)
          if (!parsedEvent) return null
          if (parsedEvent.usage?.inputTokens !== undefined) inputTokens = Math.max(inputTokens, parsedEvent.usage.inputTokens)
          if (parsedEvent.usage?.outputTokens !== undefined) outputTokens = Math.max(outputTokens, parsedEvent.usage.outputTokens)
          if (parsedEvent.text) {
            output += parsedEvent.text
            return { type: 'delta' as const, value: parsedEvent.text }
          }
          return null
        }

        try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          pending += decoder.decode(value, { stream: true })
          const lines = pending.split('\n')
          pending = lines.pop() ?? ''
          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, '')
            if (!line.startsWith('data:')) continue
            const event = applyEvent(line.slice(5).trimStart())
            if (event) yield event
          }
        }
        pending += decoder.decode()
        if (pending) {
          const line = pending.replace(/\r$/, '')
          if (line.startsWith('data:')) {
            const event = applyEvent(line.slice(5).trimStart())
            if (event) yield event
          }
        }
        } catch (error) {
          const malformed = error instanceof Error && error.message === 'malformed-sse'
          const aborted = error instanceof DOMException && error.name === 'AbortError'
          yield errorEvent(requestTimeout.didTimeout() ? 'AI zahtjev traje predugo.' : malformed ? 'AI usluga vratila je neispravan odgovor.' : requestFailureMessage(error), requestTimeout.didTimeout() || !aborted)
          return
        } finally {
          reader.releaseLock()
        }

        yield { type: 'completed', value: { output, usage: { inputTokens, outputTokens } } }
      } finally {
        requestTimeout.dispose()
      }
    },
  }
}

function isImageAttachment(value: unknown): value is { mimeType: string; data: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const image = value as Record<string, unknown>
  return typeof image.mimeType === 'string'
    && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(image.mimeType)
    && typeof image.data === 'string'
    && image.data.length > 0
    && image.data.length <= 8_000_000
    && /^[A-Za-z0-9+/]+={0,2}$/.test(image.data)
}

function addImagesToMessages(messages: AnthropicMessage[], images: Array<{ mimeType: string; data: string }>): AnthropicMessage[] {
  const firstUserIndex = messages.findIndex((message) => message.role === 'user')
  if (firstUserIndex < 0) return messages
  return messages.map((message, index) => {
    if (index !== firstUserIndex) return message
    const textContent = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content
    return {
      ...message,
      content: [
        ...textContent,
        ...images.map((image) => ({ type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.data } })),
      ],
    }
  })
}

function createRequestTimeout(externalSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  let timedOut = false
  const onExternalAbort = () => controller.abort()
  if (externalSignal?.aborted) controller.abort()
  else externalSignal?.addEventListener('abort', onExternalAbort, { once: true })
  const duration = Number.isFinite(timeoutMs) ? Math.max(1, Math.floor(timeoutMs)) : DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, duration)
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
    },
  }
}
