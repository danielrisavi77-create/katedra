import { describe, expect, it, vi } from 'vitest'

import { logOperationalEvent, safeOperationalEvent } from './operational-events'

describe('operational event telemetry', () => {
  it('keeps only bounded operational fields and converts errors to codes', () => {
    const event = safeOperationalEvent({
      eventName: 'material_upload_failed',
      requestId: 'request-1',
      userId: 'user-1',
      projectId: 'project-1',
      error: { code: 'PGRST204', message: 'private SQL detail' },
      filename: 'should-not-be-logged.docx',
      manuscript: 'should-not-be-logged',
    })

    expect(event).toMatchObject({
      eventName: 'material_upload_failed',
      requestId: 'request-1',
      userId: 'user-1',
      projectId: 'project-1',
      errorCode: 'PGRST204',
    })
    expect(event).not.toHaveProperty('error')
    expect(event).not.toHaveProperty('filename')
    expect(event).not.toHaveProperty('manuscript')
    expect(JSON.stringify(event)).not.toContain('private SQL detail')
  })

  it('logs a safe JSON line without exposing an error message', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      logOperationalEvent({
        eventName: 'checkout_failed',
        requestId: 'request-1',
        userId: 'user-1',
        error: new Error('private Stripe response'),
      }, 'error')

      expect(error).toHaveBeenCalledTimes(1)
      const line = String(error.mock.calls[0][0])
      expect(line).toContain('"errorCode":"Error"')
      expect(line).not.toContain('private Stripe response')
    } finally {
      error.mockRestore()
    }
  })
})
