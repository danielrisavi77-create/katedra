const REDIRECT_BASE = 'https://katedra.local'
const DEFAULT_REDIRECT = '/pisi'

export function getSafeAuthRouteRedirect(value) {
  return getSafeInternalRedirect(value, '/')
}

export function getSafeInternalRedirect(value, fallback = DEFAULT_REDIRECT) {
  const safeFallback = typeof fallback === 'string' && fallback.startsWith('/') && !fallback.startsWith('//') && !fallback.startsWith('/\\')
    ? fallback
    : DEFAULT_REDIRECT

  if (typeof value !== 'string') return safeFallback

  const candidate = value.trim()
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return safeFallback
  }

  try {
    const parsed = new URL(candidate, REDIRECT_BASE)
    if (parsed.origin !== REDIRECT_BASE) return safeFallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
  } catch {
    return safeFallback
  }
}
