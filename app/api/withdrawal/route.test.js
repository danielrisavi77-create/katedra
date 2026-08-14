import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('protects withdrawal requests from duplicates and missing production email configuration', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/withdrawal/route.js'), 'utf8')

  expect(source).toContain('reserveDistributedWithdrawal')
  expect(source).toContain('isDistributedWithdrawalConfigured')
  expect(source).toContain('await reservation.release()')
  expect(source).toContain('await reservation.commit(row.id)')
  expect(source).toContain("insertError?.code === '42P01'")
  expect(source).toContain("insertError?.code === 'PGRST205'")
  expect(source).toContain("status: 409")
  expect(source).toContain("status: 503")
  expect(source).not.toContain("process.env.WITHDRAWAL_FROM_EMAIL || 'onboarding@resend.dev'")
})
