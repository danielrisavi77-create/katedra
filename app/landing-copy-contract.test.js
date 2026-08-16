import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const landingSource = readFileSync(resolve(process.cwd(), 'app/page.jsx'), 'utf8')

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
})
