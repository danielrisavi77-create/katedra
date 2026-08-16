import type { AgentId, CitationEvidence, ClaimEvidence } from './contracts'
import type { AgentStepResultPayloadV1 } from './run-result-storage'

const MAX_ARTIFACT_OUTPUT_CHARS = 120_000
const MAX_TOTAL_ARTIFACT_OUTPUT_CHARS = 600_000
const MAX_ARTIFACTS_PER_CONTEXT = 32

/**
 * The only agent output that may become context for a later step.
 * Keep this projection deliberately small: verification and billing internals
 * stay server-side and are not echoed back into a provider prompt.
 */
export interface VerifiedAgentArtifactContext {
  artifactId: string
  stepId: string
  agent: AgentId
  verifier: `${AgentId}_verifier`
  stepOrder: number
  attempt: 1 | 2 | 3
  output: string
  citations: CitationEvidence[]
  claims?: ClaimEvidence[]
}

export function selectVerifiedAgentArtifacts(
  results: AgentStepResultPayloadV1[],
  currentStep: { order: number; projectId?: string; runId?: string },
): VerifiedAgentArtifactContext[] {
  const latestByStep = new Map<string, AgentStepResultPayloadV1>()

  for (const result of results) {
    if (result.verification.status !== 'verified') continue
    if (currentStep.projectId && result.projectId !== currentStep.projectId) continue
    if (currentStep.runId && result.runId !== currentStep.runId) continue
    if (!Number.isInteger(result.stepOrder) || result.stepOrder >= currentStep.order) continue

    const previous = latestByStep.get(result.stepId)
    if (!previous || isLaterAttempt(result, previous)) latestByStep.set(result.stepId, result)
  }

  let totalOutputChars = 0
  return [...latestByStep.values()]
    .sort((left, right) => left.stepOrder! - right.stepOrder! || left.createdAt.localeCompare(right.createdAt))
    .slice(0, MAX_ARTIFACTS_PER_CONTEXT)
    .flatMap((result) => {
      if (totalOutputChars >= MAX_TOTAL_ARTIFACT_OUTPUT_CHARS) return []
      const remaining = MAX_TOTAL_ARTIFACT_OUTPUT_CHARS - totalOutputChars
      const output = result.output.slice(0, Math.min(MAX_ARTIFACT_OUTPUT_CHARS, remaining))
      totalOutputChars += output.length
      return [{
        artifactId: result.materialId,
        stepId: result.stepId,
        agent: result.agent,
        verifier: result.verifier,
        stepOrder: result.stepOrder!,
        attempt: result.attempt,
        output,
        citations: result.citations.slice(0, 100),
        ...(result.claims ? { claims: result.claims.slice(0, 200) } : {}),
      }]
    })
}

function isLaterAttempt(candidate: AgentStepResultPayloadV1, previous: AgentStepResultPayloadV1): boolean {
  if (candidate.attempt !== previous.attempt) return candidate.attempt > previous.attempt
  return candidate.createdAt > previous.createdAt
}
