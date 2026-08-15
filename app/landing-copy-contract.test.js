import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const landingSource = readFileSync(resolve(process.cwd(), 'app/page.jsx'), 'utf8')

describe('landing product copy contract', () => {
  it('uses the canonical topic-to-defense promise', () => {
    expect(landingSource).toContain('Od teme do obrane')
    expect(landingSource).not.toContain('Od teme do Katedre')
  })
})
