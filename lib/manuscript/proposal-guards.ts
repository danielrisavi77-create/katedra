import type { AiProposalV1, TiptapNode } from './types'
import { isProposalStale } from './proposals'

export type ProposalGuardResult =
  | { ok: true }
  | { ok: false; reason: 'section_mismatch' | 'not_ready' | 'stale' }

export function canApplyProposal(
  proposal: AiProposalV1,
  activeSectionId: string,
  currentContent: TiptapNode,
): ProposalGuardResult {
  if (proposal.sectionId !== activeSectionId) return { ok: false, reason: 'section_mismatch' }
  if (proposal.status !== 'ready') return { ok: false, reason: 'not_ready' }
  if (isProposalStale(proposal, currentContent)) return { ok: false, reason: 'stale' }
  return { ok: true }
}

export function isCurrentAiRequest(
  requestId: string | null,
  activeRequestId: string | null,
  requestSectionId: string,
  currentSectionId: string,
): boolean {
  return Boolean(requestId && requestId === activeRequestId && requestSectionId === currentSectionId)
}
