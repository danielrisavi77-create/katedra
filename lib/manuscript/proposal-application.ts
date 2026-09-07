import { canApplyProposal } from './proposal-guards'
import { proposalApplyTarget } from './proposals'
import type { AiProposalV1, ManuscriptV1, TiptapNode } from './types'

export type ProposalApplication = {
  id: string
  sectionId: string
  mode: 'replace' | 'append'
  text: string
  expectedContent: TiptapNode
  from?: number
  to?: number
}

export async function prepareProposalApplication(input: {
  proposal: AiProposalV1
  manuscript: ManuscriptV1
  mode: 'replace' | 'append'
  snapshot: (manuscript: ManuscriptV1, reason: string) => Promise<unknown>
  readCurrent: () => { proposal: AiProposalV1 | null; manuscript: ManuscriptV1 | null }
}): Promise<ProposalApplication | null> {
  await input.snapshot(input.manuscript, `AI prijedlog: ${input.proposal.action}`)
  const current = input.readCurrent()
  if (current.proposal !== input.proposal || current.manuscript?.projectId !== input.manuscript.projectId) return null
  const section = current.manuscript.sections.find(entry => entry.id === current.manuscript?.activeSectionId)
  if (!section || !canApplyProposal(input.proposal, section.id, section.content).ok) return null
  const target = proposalApplyTarget(input.proposal, input.mode, section.content)
  if (!target) return null
  return {
    id: input.proposal.id, sectionId: section.id, text: input.proposal.proposedText,
    expectedContent: section.content, ...target,
  }
}
