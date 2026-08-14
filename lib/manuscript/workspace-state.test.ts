import { describe, expect, it } from 'vitest'

import { deriveWorkspaceMode, type WorkspaceRunSummary } from './workspace-state'

const run = (status: WorkspaceRunSummary['status']): WorkspaceRunSummary => ({
  runId: 'run-1',
  status,
  verifiedSections: 1,
  blockedSections: 0,
  totalSteps: 4,
})

describe('deriveWorkspaceMode', () => {
  it('starts in preparation when there is no manuscript', () => {
    expect(deriveWorkspaceMode({
      hasActiveRun: false,
      run: null,
      hasPendingReview: false,
      hasManuscript: false,
    })).toBe('preparation')
  })

  it('opens the manuscript when there is no active run', () => {
    expect(deriveWorkspaceMode({
      hasActiveRun: false,
      run: null,
      hasPendingReview: false,
      hasManuscript: true,
    })).toBe('writing')
  })

  it('maps pending and running runs to the autonomous dashboard', () => {
    expect(deriveWorkspaceMode({
      hasActiveRun: true,
      run: run('pending'),
      hasPendingReview: false,
      hasManuscript: true,
    })).toBe('running')
    expect(deriveWorkspaceMode({
      hasActiveRun: true,
      run: run('running'),
      hasPendingReview: false,
      hasManuscript: true,
    })).toBe('running')
  })

  it('keeps a paused run in the autonomous dashboard', () => {
    expect(deriveWorkspaceMode({
      hasActiveRun: true,
      run: run('paused'),
      hasPendingReview: false,
      hasManuscript: true,
    })).toBe('running')
  })

  it('maps a blocked run to intervention', () => {
    expect(deriveWorkspaceMode({
      hasActiveRun: true,
      run: { ...run('blocked'), blockedSections: 1 },
      hasPendingReview: true,
      hasManuscript: true,
    })).toBe('intervention')
  })

  it('maps a failed or cancelled run to intervention', () => {
    expect(deriveWorkspaceMode({
      hasActiveRun: true,
      run: run('failed'),
      hasPendingReview: false,
      hasManuscript: true,
    })).toBe('intervention')
    expect(deriveWorkspaceMode({
      hasActiveRun: true,
      run: run('cancelled'),
      hasPendingReview: false,
      hasManuscript: true,
    })).toBe('intervention')
  })

  it('opens review after a completed run with pending revisions', () => {
    expect(deriveWorkspaceMode({
      hasActiveRun: false,
      run: run('completed'),
      hasPendingReview: true,
      hasManuscript: true,
    })).toBe('review')
  })

  it('returns to writing after a completed run with nothing to review', () => {
    expect(deriveWorkspaceMode({
      hasActiveRun: false,
      run: run('completed'),
      hasPendingReview: false,
      hasManuscript: true,
    })).toBe('writing')
  })

  it('fails safe for an unknown server status', () => {
    expect(deriveWorkspaceMode({
      hasActiveRun: true,
      run: { ...run('running'), status: 'unexpected' as WorkspaceRunSummary['status'] },
      hasPendingReview: false,
      hasManuscript: true,
    })).toBe('intervention')
  })
})
