import { describe, expect, it } from 'vitest'

import { hasCanonicalAgenticPass } from './workflow-access'

describe('agentic workflow access', () => {
  it('requires a canonical active Pass', () => {
    expect(hasCanonicalAgenticPass('active')).toBe(true)
    expect(hasCanonicalAgenticPass('admin')).toBe(false)
  })

  it('fails closed for missing, checking, expired and error states', () => {
    expect(hasCanonicalAgenticPass('idle')).toBe(false)
    expect(hasCanonicalAgenticPass('checking')).toBe(false)
    expect(hasCanonicalAgenticPass('needed')).toBe(false)
    expect(hasCanonicalAgenticPass('error')).toBe(false)
  })
})
