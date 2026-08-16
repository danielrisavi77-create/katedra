import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('keeps chat behind project ownership, bounded input, and observable billing finalization', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/chat/route.js'), 'utf8')

  expect(source).toContain("if (!projectId) return json(400, { error: 'Nedostaje projekt.' })")
  expect(source).toContain('resolveOwnedProject')
  expect(source).toContain('validateChatRequest')
  expect(source).toContain('billing_finalization_failed')
  expect(source).toContain('wallet_lookup_failed')
  expect(source).toContain('KATEDRA_BILLING_RPC_CONTRACT')
  expect(source).toContain('buildBillingConsumeParams')
  expect(source).toContain('reserveDistributedRequest')
  expect(source).toContain('authorizeProjectAiRequest')
  expect(source).toContain('resolveProjectCapability')
  expect(source).toContain('projectCapabilityForChat')
  expect(source).not.toContain(".from('katedra_usage')")
  expect(source).toContain('pending_reconciliation')
  expect(source).toContain('katedra_mark_pending')
  expect(source).toContain('logAiEvent')
  expect(source).toContain('safeErrorCode')
  expect(source).not.toContain('error: error.message')
  expect(source).not.toContain('markerError')
  expect(source).not.toContain("detail })")
})

it('rejects an anonymous chat request before it can reach AI or billing', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/chat/route.js'), 'utf8')

  const authGate = source.indexOf("if (!user) return json(401, { error: 'Prijavi se za korištenje Katedre.' })")
  const bodyRead = source.indexOf('await readJsonBody(req, JSON_BODY_LIMITS.chat)')
  const adminClient = source.indexOf('createAdminClient()')

  expect(authGate).toBeGreaterThan(-1)
  expect(bodyRead).toBeGreaterThan(authGate)
  expect(adminClient).toBeGreaterThan(authGate)
})
