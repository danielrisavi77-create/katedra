const MAX_MESSAGES = 200
const MAX_TOTAL_CHARS = 400_000
const MAX_TOTAL_BINARY_DATA_CHARS = 28_000_000
const MAX_BLOCKS_PER_MESSAGE = 20
const MAX_BINARY_DATA_CHARS = 28_000_000
const ALLOWED_ROLES = new Set(['user', 'assistant'])
const ALLOWED_BINARY_TYPES = new Set(['document', 'image'])

function invalid(message, status = 400) {
  return { ok: false, status, error: message }
}

function validateContent(content) {
  if (typeof content === 'string') {
    if (!content.trim()) return invalid('Poruka ne smije biti prazna.')
    return { ok: true, chars: content.length }
  }

  if (!Array.isArray(content) || content.length === 0 || content.length > MAX_BLOCKS_PER_MESSAGE) {
    return invalid('Neispravan sadržaj poruke.')
  }

  let chars = 0
  let binaryChars = 0
  for (const block of content) {
    if (block?.type === 'text') {
      if (typeof block.text !== 'string' || !block.text.trim()) return invalid('Neispravan tekstualni blok.')
      chars += block.text.length
      continue
    }

    if (!ALLOWED_BINARY_TYPES.has(block?.type)) return invalid('Nepodržani blok sadržaja.')
    const source = block?.source
    if (source?.type !== 'base64' || typeof source.data !== 'string' || !source.data) {
      return invalid('Neispravan prilog u poruci.')
    }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(source.media_type)) {
      return invalid('Nepodržan tip priloga.')
    }
    if (source.data.length > MAX_BINARY_DATA_CHARS) return invalid('Prilog je prevelik.', 413)
    binaryChars += source.data.length
  }

  return { ok: true, chars, binaryChars }
}

export function countChatInputChars(messages) {
  if (!Array.isArray(messages)) return 0
  return messages.reduce((total, message) => {
    if (typeof message?.content === 'string') return total + message.content.length
    if (!Array.isArray(message?.content)) return total
    return total + message.content.reduce((messageTotal, block) => (
      block?.type === 'text' && typeof block.text === 'string'
        ? messageTotal + block.text.length
        : messageTotal
    ), 0)
  }, 0)
}

export function countChatAttachmentChars(messages) {
  if (!Array.isArray(messages)) return 0
  return messages.reduce((total, message) => {
    if (!Array.isArray(message?.content)) return total
    return total + message.content.reduce((messageTotal, block) => (
      (block?.type === 'document' || block?.type === 'image') && typeof block?.source?.data === 'string'
        ? messageTotal + block.source.data.length
        : messageTotal
    ), 0)
  }, 0)
}

export function validateChatRequest(body) {
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return invalid('Neispravne poruke.')
  }

  let totalChars = 0
  let totalBinaryChars = 0
  for (const message of messages) {
    if (!ALLOWED_ROLES.has(message?.role)) return invalid('Neispravna uloga poruke.')
    const content = validateContent(message.content)
    if (!content.ok) return content
    totalChars += content.chars
    totalBinaryChars += content.binaryChars || 0
    if (totalChars > MAX_TOTAL_CHARS) return invalid('Zahtjev je prevelik.', 413)
    if (totalBinaryChars > MAX_BINARY_DATA_CHARS) return invalid('Prilozi su preveliki.', 413)
  }

  return { ok: true }
}

export const CHAT_LIMITS = {
  maxMessages: MAX_MESSAGES,
  maxTotalChars: MAX_TOTAL_CHARS,
}
