import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('sends one stable reference ID for each withdrawal confirmation attempt', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/racun/page.jsx'), 'utf8')

  expect(source).toContain('createWithdrawalReference')
  expect(source).toContain('referenceId')
  expect(source).toContain('JSON.stringify({ reason: reason || undefined, referenceId })')
})

it('exposes withdrawal status and errors to assistive technology', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/racun/page.jsx'), 'utf8')

  expect(source).toContain('role="alert"')
  expect(source).toContain('aria-live="polite"')
  expect(source).toContain('htmlFor="withdrawal-reason"')
})

it('keeps account privacy and deletion confirmation visible without touching local manuscripts', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/racun/page.jsx'), 'utf8')

  expect(source).toContain("fetch('/api/account/delete'")
  expect(source).toContain("confirmation: deleteConfirmation")
  expect(source).toContain("deleteConfirmation !== 'OBRIŠI RAČUN'")
  expect(source).toContain('Rukopis i lokalne verzije ostaju na ovom uređaju')
})

it('presents account identity, projects and Pass scope as separate truthful sections', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/racun/page.jsx'), 'utf8')

  expect(source).toContain('Identitet računa')
  expect(source).toContain('Moji projekti')
  expect(source).toContain('Pass po projektu')
  expect(source).toContain('canonical identity servis')
})

it('allows long project titles to wrap inside the account row', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/racun/page.jsx'), 'utf8')
  const styles = readFileSync(resolve(process.cwd(), 'app/katedra-scoped.css'), 'utf8')

  expect(source).toContain('className="account-project-copy"')
  expect(styles).toContain('.account-project-copy{min-width:0;overflow-wrap:anywhere;flex:1 1 auto}')
})
