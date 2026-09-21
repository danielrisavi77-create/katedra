import type { AiProposalStatus, AiProposalV1, TiptapNode } from './types'

export function documentRevision(content: TiptapNode): string {
  const input = JSON.stringify(content)
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function createAiProposal({
  sectionId,
  action,
  baseContent,
  proposedText,
  selectedFrom,
  selectedTo,
  now = new Date().toISOString(),
}: {
  sectionId: string
  action: string
  baseContent: TiptapNode
  proposedText: string
  selectedFrom?: number
  selectedTo?: number
  now?: string
}): AiProposalV1 {
  return {
    id: `proposal-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    sectionId,
    action,
    baseRevision: documentRevision(baseContent),
    selectedFrom,
    selectedTo,
    proposedText,
    status: proposedText ? 'ready' : 'streaming',
    createdAt: now,
  }
}

export function isProposalStale(proposal: AiProposalV1, currentContent: TiptapNode): boolean {
  return proposal.baseRevision !== documentRevision(currentContent)
}

export function proposalApplyRange(
  proposal: AiProposalV1,
  mode: 'replace' | 'append',
  currentContent: TiptapNode,
): { from: number; to: number } | null {
  if (mode !== 'replace' || isProposalStale(proposal, currentContent)) return null
  if (typeof proposal.selectedFrom !== 'number' || typeof proposal.selectedTo !== 'number') return null
  if (!Number.isInteger(proposal.selectedFrom) || !Number.isInteger(proposal.selectedTo)) return null
  if (proposal.selectedFrom < 0 || proposal.selectedTo < proposal.selectedFrom) return null
  return { from: proposal.selectedFrom, to: proposal.selectedTo }
}

export function proposalApplyTarget(
  proposal: AiProposalV1,
  mode: 'replace' | 'append',
  currentContent: TiptapNode,
): { mode: 'replace' | 'append'; from?: number; to?: number } | null {
  if (isProposalStale(proposal, currentContent)) return null
  const range = proposalApplyRange(proposal, mode, currentContent)
  const hasSelectionMetadata = proposal.selectedFrom !== undefined || proposal.selectedTo !== undefined

  if (mode === 'replace' && hasSelectionMetadata && !range) return null
  if (range) return { mode: 'replace', from: range.from, to: range.to }
  return { mode: 'append' }
}

export function resolveProposal(
  proposal: AiProposalV1,
  status: Extract<AiProposalStatus, 'accepted' | 'rejected'>,
  currentContent: TiptapNode,
): AiProposalV1 {
  if (status === 'accepted' && isProposalStale(proposal, currentContent)) {
    return { ...proposal, status: 'stale' }
  }
  return { ...proposal, status }
}
