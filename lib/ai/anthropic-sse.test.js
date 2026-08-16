import { describe, expect, it } from 'vitest'

import { createAnthropicUsageParser } from './anthropic-sse'

function bytes(value) {
  return new TextEncoder().encode(value)
}

describe('createAnthropicUsageParser', () => {
  it('keeps partial SSE JSON between network chunks and records usage', () => {
    const parser = createAnthropicUsageParser()
    const line = 'data: {"type":"message_start","message":{"usage":{"input_tokens":123}}}\n'
    const split = line.indexOf('123') + 1

    parser.push(bytes(line.slice(0, split)))
    parser.push(bytes(line.slice(split)))
    parser.finish()

    expect(parser.usage()).toEqual({ inputTokens: 123, outputTokens: 0 })
  })

  it('handles CRLF, final lines without a newline, and keeps the highest usage', () => {
    const parser = createAnthropicUsageParser()
    parser.push(bytes(
      'data: {"type":"message_delta","usage":{"output_tokens":4}}\r\n' +
      'data: {"type":"message_delta","usage":{"output_tokens":9}}\r\n',
    ))
    parser.push(bytes('data: {"type":"message_start","message":{"usage":{"input_tokens":7}}}'))
    parser.finish()

    expect(parser.usage()).toEqual({ inputTokens: 7, outputTokens: 9 })
  })

  it('ignores comments and the Anthropic stream terminator', () => {
    const parser = createAnthropicUsageParser()
    parser.push(bytes(': keep-alive\n\n'))
    parser.push(bytes('data: [DONE]\n\n'))
    parser.finish()

    expect(parser.usage()).toEqual({ inputTokens: 0, outputTokens: 0 })
  })
})
