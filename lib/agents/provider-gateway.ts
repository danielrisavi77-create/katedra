import type { AgentEvent, AgentInput, AgentProvider, AgentCapability, UsageRecord } from './contracts'

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_GATEWAY_RESPONSE_BYTES = 1_500_000

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export function createGatewayAgentProvider({
  id,
  endpoint,
  apiKey,
  model,
  capabilities,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  id: string
  endpoint: string
  apiKey: string
  model: string
  capabilities: AgentCapability[]
  fetchImpl?: FetchImplementation
  timeoutMs?: number
}): AgentProvider {
  return {
    id,
    capabilities: [...new Set(capabilities)],
    async *run(input: AgentInput): AsyncIterable<AgentEvent> {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), normalizeTimeout(timeoutMs))
      try {
        let response: Response
        try {
          response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model, projectId: input.projectId, runId: input.runId, attempt: input.attempt, payload: input.payload }),
            signal: controller.signal,
          })
        } catch (error) {
          yield { type: 'error', message: controller.signal.aborted ? 'AI zahtjev traje predugo.' : 'AI usluga trenutačno nije dostupna.', retryable: true }
          return
        }
        if (!response.ok) {
          yield { type: 'error', message: 'AI usluga trenutačno nije dostupna.', retryable: response.status === 429 || response.status >= 500 }
          return
        }
        const body = await readResponse(response)
        if (!body || typeof body.output !== 'string' || !isUsage(body.usage)) {
          yield { type: 'error', message: 'AI usluga vratila je neispravan odgovor.', retryable: true }
          return
        }
        yield { type: 'completed', value: { output: body.output, usage: body.usage } }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

async function readResponse(response: Response): Promise<{ output: string; usage: UsageRecord } | null> {
  try {
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_GATEWAY_RESPONSE_BYTES) return null
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > MAX_GATEWAY_RESPONSE_BYTES) return null
    const value = JSON.parse(text) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const body = value as Record<string, unknown>
    return typeof body.output === 'string' && isUsage(body.usage)
      ? { output: body.output, usage: body.usage }
      : null
  } catch {
    return null
  }
}

function isUsage(value: unknown): value is UsageRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const usage = value as Record<string, unknown>
  return Number.isFinite(usage.inputTokens) && Number.isFinite(usage.outputTokens)
    && Number(usage.inputTokens) >= 0 && Number(usage.outputTokens) >= 0
}

function normalizeTimeout(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(Math.trunc(value), 180_000)) : DEFAULT_TIMEOUT_MS
}
