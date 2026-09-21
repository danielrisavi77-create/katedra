'use client'

import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { AiProposalV1 } from '../../../lib/manuscript/types'

export function useProposalExpiry(proposal: AiProposalV1 | null, setProposal: Dispatch<SetStateAction<AiProposalV1 | null>>) {
  const id = proposal?.id
  const accepted = proposal?.status === 'accepted'
  useEffect(() => {
    if (!accepted || !id) return
    const timer = setTimeout(() => {
      setProposal(current => current?.id === id && current.status === 'accepted' ? null : current)
    }, 900)
    return () => clearTimeout(timer)
  }, [accepted, id, setProposal])
  return accepted
}
