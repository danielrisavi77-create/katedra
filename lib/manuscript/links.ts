const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function isSafeManuscriptHref(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const href = value.trim()
  if (!href || href.length > 2_000) return false

  try {
    const url = new URL(href)
    if (!ALLOWED_LINK_PROTOCOLS.has(url.protocol)) return false
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.hostname) return false
    return true
  } catch {
    return false
  }
}
