import { describe, expect, it } from 'vitest'

import { transitionRunStatus } from './run-actions'

describe('agent run actions', () => {
  it('pauses and resumes only active runs', () => {
    expect(transitionRunStatus('running', 'pause')).toBe('paused')
    expect(transitionRunStatus('paused', 'resume')).toBe('running')
  })

  it('does not resume completed or blocked runs', () => {
    expect(() => transitionRunStatus('completed', 'resume')).toThrow(/completed/i)
    expect(() => transitionRunStatus('blocked', 'resume')).toThrow(/blocked/i)
  })
})
