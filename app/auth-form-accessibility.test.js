import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

const pages = ['prijava', 'registracija', 'zaboravljena-lozinka', 'reset-lozinke']

it('associates authentication labels and announces errors', () => {
  for (const page of pages) {
    const source = readFileSync(resolve(process.cwd(), `app/${page}/page.jsx`), 'utf8')
    expect(source, page).toContain('htmlFor=')
    expect(source, page).toContain('role="alert"')
  }
})
