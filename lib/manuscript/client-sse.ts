export function createTextDeltaParser() {
  let pending = ''

  const parseCompleteLines = (flush = false): string => {
    const normalized = pending.replace(/\r\n/g, '\n')
    const lines = normalized.split('\n')
    pending = flush ? '' : lines.pop() || ''
    let text = ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const value = line.slice(5).trim()
      if (!value || value === '[DONE]') continue
      try {
        const event = JSON.parse(value)
        if (event?.type === 'content_block_delta' && typeof event?.delta?.text === 'string') {
          text += event.delta.text
        }
      } catch {
        // Invalid provider events are ignored; a valid text response or the
        // route status remains the user-visible success/error authority.
      }
    }
    return text
  }

  return {
    push(chunk: string): string {
      pending += chunk
      return parseCompleteLines(false)
    },
    flush(): string {
      pending += '\n'
      return parseCompleteLines(true)
    },
  }
}
