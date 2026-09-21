import type { AgentInput, AgentProvider, AgentResultV1, UsageRecord } from './contracts'
import { executeAgentProvider } from './provider-execution'
import { executeRecoveredProviderOperation, type ProviderExecutionContext, type RecoverableOperation } from './provider-execution-recovery.server'
import type { TrackedUploadClient } from './tracked-upload'
import { logAiEvent } from '../observability/ai-events'
export { AgentBillingReconciliationError } from './billing-errors'

export type BillingDatabase = TrackedUploadClient
export interface BilledOperationResult<T> {
  value: T
  usage: UsageRecord
  billingState: 'settled'
  charged: number
}

export async function executeBilledAgentProvider(
  db: BillingDatabase,
  input: {
    provider: AgentProvider
    agentInput: AgentInput
    userId: string
    projectId: string
    requestId: string
    agent?: string
    model: string
    execution: ProviderExecutionContext
    maxOutputTokens?: number
  },
): Promise<Omit<AgentResultV1, 'agent'>> {
  const billed = await executeBilledOperation(db, {
    operation: 'provider',
    execution: input.execution,
    provider: input.provider.id,
    model: input.model,
    agent: input.agent,
    runId: input.agentInput.runId,
    attempt: input.agentInput.attempt,
    payload: input.agentInput.payload,
    userId: input.userId,
    projectId: input.projectId,
    requestId: input.requestId,
    maxOutputTokens: input.maxOutputTokens,
    execute: async () => {
      const result = await executeAgentProvider(input.provider, input.agentInput)
      return { value: result, usage: result.usage }
    },
  })
  return { ...billed.value, usage: billed.usage, billingState: billed.billingState }
}

export async function executeBilledOperation<T>(db: BillingDatabase, input: RecoverableOperation<T> & { agent?: string }): Promise<BilledOperationResult<T>> {
  const startedAt = Date.now()
  const result = await executeRecoveredProviderOperation(db, input)
  logAiEvent({ eventName: 'agent_billing_settled', requestId: input.requestId, userId: input.userId,
    projectId: input.projectId, runId: input.runId, agent: input.agent, provider: input.provider,
    model: input.model, attempt: input.attempt, charged: result.charged,
    inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens,
    billingState: 'settled', outcome: 'settled', latencyMs: Date.now() - startedAt })
  return result
}
