export const AGENT_IDS = ['intake', 'sources', 'structure', 'planning', 'writing', 'citation', 'review', 'export'] as const
export type AgentId = typeof AGENT_IDS[number]

export type AgentCapability = 'text' | 'vision' | 'web_research'

export interface AgentInput {
  projectId: string
  runId?: string
  payload: unknown
  attempt: number
}

export interface AgentDeltaEvent {
  type: 'delta'
  value: string
}

export interface AgentCompletedEvent {
  type: 'completed'
  value: {
    output: string
    usage: UsageRecord
  }
}

export interface AgentErrorEvent {
  type: 'error'
  message: string
  retryable?: boolean
}

export type AgentEvent = AgentDeltaEvent | AgentCompletedEvent | AgentErrorEvent

export interface AgentProvider {
  id: string
  capabilities: AgentCapability[]
  run(input: AgentInput): AsyncIterable<AgentEvent>
}

export interface CitationEvidence {
  id: string
  title?: string
  url?: string
  doi?: string
  verified: boolean
}

export interface ClaimEvidence {
  id: string
  text: string
  citationIds: string[]
}

export interface UsageRecord {
  inputTokens: number
  outputTokens: number
}

export interface AgentResultV1 {
  agent: AgentId
  output: unknown
  citations: CitationEvidence[]
  claims?: ClaimEvidence[]
  provider: string
  usage?: UsageRecord
  sectionId?: string
  baseRevision?: string
}

export interface VerificationIssue {
  code: 'missing_source' | 'missing_claim_evidence' | 'unverified_source' | 'incomplete_source' | 'invalid_output' | 'provider_capability_unavailable'
  message: string
  citationId?: string
}

export type VerificationStatus = 'verified' | 'needs_revision' | 'blocked' | 'failed'

export interface VerificationResultV1 {
  status: VerificationStatus
  issues: VerificationIssue[]
  evidence: CitationEvidence[]
  resultPayloadId?: string
}

export interface AgentContract {
  agent: AgentId
  verifier: `${AgentId}_verifier`
  provider: string
  maxAttempts: 3
}

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && (AGENT_IDS as readonly string[]).includes(value)
}

export function createAgentContract(agent: AgentId, provider: AgentProvider): AgentContract {
  return {
    agent,
    verifier: `${agent}_verifier`,
    provider: provider.id,
    maxAttempts: 3,
  }
}
