import { describe, expect, it } from 'vitest'

import { authorizeProjectAiRequest } from './project-access'

describe('authorizeProjectAiRequest', () => {
  it('allows a project with an active Pass without consulting the wallet RPC', async () => {
    const db = { rpc: async () => { throw new Error('should not call') } }
    await expect(authorizeProjectAiRequest(db, { userId: 'user-1', projectId: 'project-1', hasPass: true })).resolves.toEqual({ allowed: true, source: 'pass' })
  })

  it('requires the project-scoped server decision for a project without a Pass', async () => {
    const calls = []
    const db = {
      async rpc(name, params) {
        calls.push([name, params])
        return { data: { status: 'allowed', balance: 4_500 }, error: null }
      },
    }
    await expect(authorizeProjectAiRequest(db, { userId: 'user-1', projectId: 'project-1', hasPass: false })).resolves.toEqual({ allowed: true, source: 'project_grant', balance: 4_500 })
    expect(calls).toEqual([['katedra_authorize_project_ai', { p_user: 'user-1', p_project_id: 'project-1' }]])
  })

  it('fails closed when the project authorization RPC is unavailable', async () => {
    const result = await authorizeProjectAiRequest({ rpc: async () => ({ data: null, error: { message: 'missing function' } }) }, { userId: 'user-1', projectId: 'project-1', hasPass: false })
    expect(result).toEqual({ allowed: false, reason: 'unavailable' })
  })

  it('preserves the server denial reason', async () => {
    const result = await authorizeProjectAiRequest({ rpc: async () => ({ data: { status: 'no_grant', balance: 0 }, error: null }) }, { userId: 'user-1', projectId: 'project-1', hasPass: false })
    expect(result).toEqual({ allowed: false, reason: 'no_grant', balance: 0 })
  })
})
