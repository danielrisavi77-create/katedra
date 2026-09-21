import { describe, expect, it } from 'vitest'

import { isSafeManuscriptHref } from './links'

describe('manuscript links', () => {
  it('allows ordinary web and mail links', () => {
    expect(isSafeManuscriptHref('https://example.com/source')).toBe(true)
    expect(isSafeManuscriptHref('http://example.com')).toBe(true)
    expect(isSafeManuscriptHref('mailto:mentor@example.com')).toBe(true)
  })

  it('rejects executable, data and relative URLs', () => {
    expect(isSafeManuscriptHref('javascript:alert(1)')).toBe(false)
    expect(isSafeManuscriptHref('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeManuscriptHref('/settings')).toBe(false)
    expect(isSafeManuscriptHref('')).toBe(false)
  })
})
