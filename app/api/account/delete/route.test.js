import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'app/api/account/delete/route.js'), 'utf8')

describe('account deletion privacy contract', () => {
  it('cleans temporary payloads before deleting the canonical identity', () => {
    expect(source).toContain("import { deleteUserAgentPayloads } from '@/lib/agents/run-payload-deletion'")
    expect(source).toContain('await deleteUserAgentPayloads(admin, { userId: user.id })')
    expect(source).toContain('admin.auth.admin.deleteUser(user.id)')
    expect(source).toContain('account_delete_payload_cleanup_blocked')
  })

  it('fails closed when temporary payload cleanup is unavailable', () => {
    const cleanupStart = source.indexOf('const payloads = await deleteUserAgentPayloads')
    const identityDelete = source.indexOf('admin.auth.admin.deleteUser(user.id)')
    expect(cleanupStart).toBeGreaterThan(-1)
    expect(identityDelete).toBeGreaterThan(cleanupStart)
    expect(source.slice(cleanupStart, identityDelete)).toContain('if (!payloads.ok)')
  })
})
