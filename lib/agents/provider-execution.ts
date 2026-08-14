import type { AgentInput, AgentProvider, AgentResultV1, UsageRecord } from './contracts'

export async function executeAgentProvider(
  provider: AgentProvider,
  input: AgentInput,
): Promise<Omit<AgentResultV1, 'agent'>> {
  let streamedOutput = ''
  let completedOutput: string | undefined
  let usage: UsageRecord | undefined

  for await (const event of provider.run(input)) {
    if (event.type === 'delta') {
      streamedOutput += event.value
      continue
    }
    if (event.type === 'error') {
      throw new Error(event.message)
    }
    if (typeof event.value?.output !== 'string' || !isUsage(event.value.usage)) {
      throw new Error('Provider nije vratio valjan završni rezultat.')
    }
    completedOutput = event.value.output
    usage = event.value.usage
  }

  if (completedOutput === undefined || usage === undefined) {
    throw new Error('Provider nije završio agentni rezultat.')
  }

  return {
    output: completedOutput || streamedOutput,
    citations: [],
    provider: provider.id,
    usage,
  }
}

function isUsage(value: unknown): value is UsageRecord {
  if (!value || typeof value !== 'object') return false
  const usage = value as Record<string, unknown>
  return Number.isFinite(usage.inputTokens)
    && Number.isFinite(usage.outputTokens)
    && Number(usage.inputTokens) >= 0
    && Number(usage.outputTokens) >= 0
}
