import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { passModulesForWorkType } from '../lib/product/v1-modules'

const landingSource = readFileSync(resolve(process.cwd(), 'app/page.jsx'), 'utf8')
const legalSources = ['app/privatnost/page.jsx', 'app/uvjeti/page.jsx'].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'))

describe('landing product copy contract', () => {
  it('uses the V1 topic-to-manuscript promise', () => {
    expect(landingSource).toContain('Od teme do rukopisa')
    expect(landingSource).not.toContain('Od teme do obrane')
    expect(landingSource).not.toContain('Od teme do Katedre')
  })

  it('shows a concrete but clearly illustrative product proof', () => {
    expect(landingSource).toContain('Kako izgleda jedan projekt')
    expect(landingSource).toContain('Ilustrativni projekt')
    expect(landingSource).toContain('Projektni plan')
    expect(landingSource).toContain('Rukopis po sekcijama')
    expect(landingSource).toContain('Izvori i AI zapis')
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

  it('does not sell future research or defense modules as part of paid V1', () => {
    expect(landingSource).toContain("passModulesForWorkType('s')")
    expect(landingSource).toContain("passModulesForWorkType('z')")
    expect(landingSource).toContain("passModulesForWorkType('d')")
    expect(passModulesForWorkType('d').map(({ label }) => label)).toEqual(expect.arrayContaining([
      'Projekt i Completion Plan',
      'Rukopis po sekcijama',
      'Lekta handoff',
    ]))
    expect(landingSource).not.toContain('Istraživački dizajn i literatura')
    expect(landingSource).not.toContain('Priprema obrane')
    expect(landingSource).not.toContain('više revizija')
  })

  it('keeps legal pages independent from the paid V1 module promise', () => {
    for (const source of legalSources) expect(source).not.toContain('Priprema obrane')
  })
})
