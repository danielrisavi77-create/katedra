import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const landingSource = readFileSync(resolve(process.cwd(), 'app/page.jsx'), 'utf8')
const legalSources = ['app/privatnost/page.jsx', 'app/uvjeti/page.jsx'].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'))

describe('landing product copy contract', () => {
  it('uses the canonical topic-to-defense promise', () => {
    expect(landingSource).toContain('Od teme do obrane')
    expect(landingSource).not.toContain('Od teme do Katedre')
  })

  it('shows a concrete but clearly illustrative product proof', () => {
    expect(landingSource).toContain('Kako izgleda jedan projekt')
    expect(landingSource).toContain('Ilustrativni FPZG projekt')
    expect(landingSource).toContain('Istraživanje')
    expect(landingSource).toContain('Plan rada')
    expect(landingSource).toContain('Lekta provjera')
    expect(landingSource).toContain('<ol className="landing-proof-flow"')
  })

  it('does not present example metrics as a promise for every project', () => {
    expect(landingSource).toContain('Primjer tijeka, ne jamstvo rezultata')
  })

  it('explains the product boundary against a generic chat and names Pass scope', () => {
    expect(landingSource).toContain('Zašto nije samo chat?')
    expect(landingSource).toContain('landing-comparison')
    expect(landingSource).toContain('Jedna kupnja, jedan rad')
    expect(landingSource).toContain('days: 120')
    expect(landingSource).toContain('days: 240')
    expect(landingSource).toContain('days: 365')
    expect(landingSource).toContain('landing-pass-term')
    expect(landingSource).toContain('zaštitnim limitima korištenja')
  })

  it('uses the canonical brand promise on legal pages too', () => {
    for (const source of legalSources) {
      expect(source).toContain('Od teme do obrane')
      expect(source).not.toContain('Od teme do Katedre')
    }
  })
})
