import { describe, expect, it, vi } from 'vitest'

import { logAiEvent, safeAiEvent, safeErrorCode } from './ai-events'

describe('AI event telemetry', () => {
  it('keeps operational billing metadata and drops prompt/output content', () => {
    const event = safeAiEvent({
      eventName: 'billing_settled',
      requestId: 'request-1',
      billingRequestId: 'billing-1',
      userId: 'user-1',
      projectId: 'project-1',
      model: 'claude-sonnet-5',
      inputTokens: 100,
      outputTokens: 20,
      charged: 200,
      billingState: 'settled',
      prompt: 'ne smije u log',
      manuscriptText: 'ne smije u log',
    })

    expect(event).toMatchObject({
      eventName: 'billing_settled',
      billingRequestId: 'billing-1',
      model: 'claude-sonnet-5',
      inputTokens: 100,
      outputTokens: 20,
      charged: 200,
      billingState: 'settled',
    })
    expect(event).not.toHaveProperty('prompt')
    expect(event).not.toHaveProperty('manuscriptText')
  })

  it('uses error logging only for an explicit safe error event', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      logAiEvent({
        eventName: 'billing_pending_reconciliation',
        requestId: 'request-1',
        userId: 'user-1',
        projectId: 'project-1',
        errorCode: 'rpc_unavailable',
      }, 'error')

      expect(error).toHaveBeenCalledTimes(1)
      expect(info).not.toHaveBeenCalled()
      expect(String(error.mock.calls[0][0])).toContain('rpc_unavailable')
    } finally {
      error.mockRestore()
      info.mockRestore()
    }
  })

  it('derives a bounded error code without exposing an error message', () => {
    expect(safeErrorCode({ code: 'PGRST204', message: 'private database detail' })).toBe('PGRST204')
    expect(safeErrorCode(new Error('private provider detail'))).toBe('Error')
    expect(safeErrorCode({ message: 'private detail' })).toBe('unknown_error')
    expect(safeErrorCode({ code: 'bad code with spaces' })).toBe('bad_code_with_spaces')
  })
})
