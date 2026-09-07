import { expect, it, vi } from 'vitest'
import { ensureFreeStarterGrant } from './katedra-free-starter'

it('logs only a bounded error code when the legacy starter grant fails', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await ensureFreeStarterGrant({ rpc: vi.fn().mockResolvedValue({ error: {
      code: '42P01', message: 'PRIVATE_DATABASE_DETAIL', details: 'PRIVATE_ACADEMIC_CONTENT',
    } }) }, 'user-1', 'project-1')
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_')
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ eventName: 'free_starter_grant_failed', errorCode: '42P01', userId: 'user-1', projectId: 'project-1' })
  } finally { log.mockRestore() }
})
