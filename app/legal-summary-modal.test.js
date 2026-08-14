import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8')

it('defines an accessible legal summary modal and wires it into registration', () => {
  const modalPath = resolve(process.cwd(), 'app/legal-summary-modal.jsx')
  expect(existsSync(modalPath)).toBe(true)

  if (!existsSync(modalPath)) return

  const modal = read('app/legal-summary-modal.jsx')
  const registration = read('app/registracija/page.jsx')

  expect(modal).toContain('role="dialog"')
  expect(modal).toContain('aria-modal="true"')
  expect(modal).toContain('data-legal-summary-modal')
  expect(modal).toContain('Otvori cijeli dokument')
  expect(registration).toContain('LegalSummaryModal')
})

it('keeps full legal pages inside the shared Katedra shell', () => {
  for (const file of ['app/privatnost/page.jsx', 'app/uvjeti/page.jsx']) {
    const source = read(file)
    expect(source).toContain('legal-page')
    expect(source).toContain('legal-brand')
    expect(source).toContain('data-skin="kreda"')
  }
})

it('provides the checkout paywall with the same legal summary entry points', () => {
  const passDialog = read('app/pisi/components/pass-dialog.tsx')

  expect(passDialog).toContain('LegalSummaryModal type="uvjeti"')
  expect(passDialog).toContain('LegalSummaryModal type="privatnost"')
  expect(passDialog).toContain("fetch('/api/checkout'")
})
