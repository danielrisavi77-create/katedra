// Parses Anthropic's SSE usage metadata without assuming network chunks equal
// complete SSE lines. The response body may split a UTF-8 sequence or JSON
// event at any byte boundary.
export function createAnthropicUsageParser() {
  const decoder = new TextDecoder()
  let pending = ''
  let inputTokens = 0
  let outputTokens = 0

  function handleLine(line) {
    const normalized = line.replace(/\r$/, '')
    if (!normalized.startsWith('data:')) return

    const data = normalized.slice(5).trimStart()
    if (!data || data === '[DONE]') return

    let event
    try {
      event = JSON.parse(data)
    } catch {
      // A complete but malformed provider event must not make us invent usage.
      // The finalizer will still record the observed zero/partial usage.
      return
    }

    const nextInput = Number(event?.message?.usage?.input_tokens)
    const nextOutput = Number(event?.usage?.output_tokens)
    if (Number.isFinite(nextInput) && nextInput >= 0) inputTokens = Math.max(inputTokens, nextInput)
    if (Number.isFinite(nextOutput) && nextOutput >= 0) outputTokens = Math.max(outputTokens, nextOutput)
  }

  function consumeText(text) {
    if (!text) return
    pending += text
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) handleLine(line)
  }

  return {
    push(chunk) {
      consumeText(decoder.decode(chunk, { stream: true }))
    },
    finish() {
      consumeText(decoder.decode())
      if (pending) handleLine(pending)
      pending = ''
    },
    usage() {
      return { inputTokens, outputTokens }
    },
  }
}
