import { describe, expect, it } from 'vitest'

import { countChatAttachmentChars, countChatInputChars, validateChatRequest } from './validation'

describe('validateChatRequest', () => {
  it('counts text input without treating base64 attachment bytes as prompt text', () => {
    expect(countChatInputChars([
      { role: 'user', content: 'Bok' },
      { role: 'user', content: [{ type: 'document', source: { type: 'base64', data: 'x'.repeat(100_000) } }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Odgovor' }] },
    ])).toBe(10)
    expect(countChatAttachmentChars([
      { role: 'user', content: [{ type: 'document', source: { type: 'base64', data: 'x'.repeat(100_000) } }] },
    ])).toBe(100_000)
  })

  it('accepts the text and multimodal message shapes used by the client', () => {
    expect(validateChatRequest({
      messages: [
        { role: 'user', content: 'Bok' },
        { role: 'assistant', content: [{ type: 'text', text: 'Pozdrav' }] },
        {
          role: 'user',
          content: [{
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: 'YWJj' },
          }],
        },
      ],
    })).toEqual({ ok: true })
  })

  it('rejects malformed roles and unsupported content blocks', () => {
    expect(validateChatRequest({ messages: [{ role: 'system', content: 'nope' }] })).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(validateChatRequest({ messages: [{ role: 'user', content: [{ type: 'url' }] }] })).toMatchObject({
      ok: false,
      status: 400,
    })
  })

  it('rejects oversized message payloads before they reach Anthropic', () => {
    expect(validateChatRequest({
      messages: [{ role: 'user', content: 'x'.repeat(400_001) }],
    })).toMatchObject({ ok: false, status: 413 })
  })
})
