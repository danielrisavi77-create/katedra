import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8')

it('keeps public page content inside a single main landmark', () => {
  expect(read('app/page.jsx')).toContain('<main')
  expect(read('app/pisi/components/onboarding-flow.tsx')).toContain('<main className="pis-onboarding"')
  expect(read('app/racun/page.jsx')).toContain('<main className="wrap"')
  expect(read('app/registracija/page.jsx')).toContain('<main className="katedra-page"')
  expect(read('app/privatnost/page.jsx')).toContain('<main className="legal-main"')
  expect(read('app/uvjeti/page.jsx')).toContain('<main className="legal-main"')
})

it('keeps authentication and legal headings semantically ordered', () => {
  expect(read('app/registracija/page.jsx')).toContain('<h1 style={{ margin: \'12px 0 4px\' }}>Registracija</h1>')
  expect(read('app/privatnost/page.jsx')).toContain('<h2>1.')
  expect(read('app/uvjeti/page.jsx')).toContain('<h2>1.')
  expect(read('app/katedra-scoped.css')).toContain('.katedra-page.legal-page .legal-document h2{')
})

it('keeps low-emphasis authentication copy readable and inline links distinguishable', () => {
  const styles = read('app/katedra-scoped.css')
  expect(styles).toContain('.katedra-page .fld .hint{font-size:11.5px;color:var(--mut)')
  expect(styles).toContain('.katedra-page .onb-note{font-size:11.5px;color:var(--mut)')
  expect(styles).toContain('.katedra-page .onb-note a{text-decoration:underline')
  expect(styles).toContain('.katedra-page.legal-page .legal-document a,')
  expect(styles).toContain('text-decoration:underline;text-underline-offset:3px')
  const pisiStyles = read('app/pisi/pisi.css')
  expect(pisiStyles).toContain('--pis-muted: #5a574f')
  expect(pisiStyles).toContain('--pis-faint: #5a574f')
  expect(pisiStyles).toContain('--pis-faint: #c1b9aa')
})
