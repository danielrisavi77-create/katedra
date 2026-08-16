import { describe, expect, it } from 'vitest'
import { getSafeAuthRouteRedirect, getSafeInternalRedirect } from './redirect'

describe('getSafeInternalRedirect', () => {
  it('uses the fallback when redirect is missing', () => {
    expect(getSafeInternalRedirect(null)).toBe('/pisi')
  })

  it('keeps a valid internal path with query and hash', () => {
    expect(getSafeInternalRedirect('/pisi?from=login#top')).toBe('/pisi?from=login#top')
  })

  it('accepts the root path', () => {
    expect(getSafeInternalRedirect('/')).toBe('/')
  })

  it.each([
    'https://evil.example/steal-session',
    '//evil.example/steal-session',
    '/\\evil.example/steal-session',
    'javascript:alert(1)',
    42,
  ])('rejects unsafe redirect %s', (value) => {
    expect(getSafeInternalRedirect(value)).toBe('/pisi')
  })
})

describe('getSafeAuthRouteRedirect', () => {
  it('keeps the requested project destination for an already signed-in user', () => {
    expect(getSafeAuthRouteRedirect('/pisi?projectId=project-1')).toBe('/pisi?projectId=project-1')
  })

  it('falls back to the home page when no destination was requested', () => {
    expect(getSafeAuthRouteRedirect(null)).toBe('/')
  })
})
