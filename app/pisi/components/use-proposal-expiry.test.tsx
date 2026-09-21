// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useProposalExpiry } from './use-proposal-expiry'
import type { AiProposalV1 } from '../../../lib/manuscript/types'

const accepted: AiProposalV1 = { id: 'old', sectionId: 'intro', action: 'revise', baseRevision: 'base', proposedText: 'Text', status: 'accepted', createdAt: '2026-09-07T12:00:00Z' }
beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.useRealTimers() })

it('does not let an old accepted-flash timer clear a new proposal', () => {
  const setProposal = vi.fn()
  const { result, rerender } = renderHook(({ proposal }) => useProposalExpiry(proposal, setProposal), { initialProps: { proposal: accepted } })
  expect(result.current).toBe(true)
  rerender({ proposal: { ...accepted, id: 'new', status: 'streaming' } })
  act(() => vi.advanceTimersByTime(900))
  expect(result.current).toBe(false)
  expect(setProposal).not.toHaveBeenCalled()
})

it('expires only its own accepted proposal and cancels on unmount', () => {
  const setProposal = vi.fn()
  const { unmount } = renderHook(() => useProposalExpiry(accepted, setProposal))
  act(() => vi.advanceTimersByTime(900))
  const update = setProposal.mock.calls[0][0]
  expect(update(accepted)).toBeNull()
  const newer = { ...accepted, id: 'new' }
  expect(update(newer)).toBe(newer)
  unmount()
  setProposal.mockClear()
  const next = renderHook(() => useProposalExpiry(accepted, setProposal))
  next.unmount()
  act(() => vi.advanceTimersByTime(900))
  expect(setProposal).not.toHaveBeenCalled()
})
