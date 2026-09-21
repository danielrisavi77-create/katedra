import { describe, expect, it } from 'vitest'

import { createTextDeltaParser } from './client-sse'

describe('client SSE parser', () => {
  it('reassembles JSON split across arbitrary chunks and CRLF boundaries', () => {
    const parser = createTextDeltaParser()

    expect(parser.push('data: {"type":"content_block_')).toBe('')
    expect(parser.push('delta","delta":{"text":"Prvi"}}\r\n')).toBe('Prvi')
    expect(parser.push('data: {"type":"content_block_delta","delta":{"text":" drugi"}}\n')).toBe(' drugi')
    expect(parser.flush()).toBe('')
  })

  it('ignores done markers and malformed events', () => {
    const parser = createTextDeltaParser()
    expect(parser.push('data: nope\ndata: [DONE]\n')).toBe('')
  })
})
