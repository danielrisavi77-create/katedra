import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('keeps the retired string-rendered workspace out of the active application', () => {
  expect(existsSync(resolve(process.cwd(), 'app/katedra-engine.js'))).toBe(false)
  expect(existsSync(resolve(process.cwd(), 'app/katedra-body.js'))).toBe(false)
})
