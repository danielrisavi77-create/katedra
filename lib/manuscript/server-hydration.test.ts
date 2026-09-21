import { describe, expect, it, vi } from 'vitest'
import { loadServerProjectSnapshot } from './server-hydration'
import { createManuscript, plainTextDocument } from './model'

describe('server metadata hydration', () => {
  it.each(['edit', 'onboarding', 'project'])('preserves local %s changes while the server response is pending', async (change) => {
    const initial = createManuscript({ projectId: 'project-1', workType: 's', now: '2026-09-07T12:00:00Z' })
    let current = initial
    let finish!: (response: Response) => void
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve }))
    const pending = loadServerProjectSnapshot(initial, () => current, fetcher)
    if (change === 'edit') current = { ...initial, sections: initial.sections.map(section => ({ ...section, content: plainTextDocument('User draft') })) }
    if (change === 'onboarding') current = { ...initial, title: 'User chosen title', workType: 'd' }
    if (change === 'project') current = { ...initial, projectId: 'project-2' }
    finish(Response.json({ topic: 'Server title', workType: 's' }))
    await expect(pending).resolves.toBeNull()
    expect(current).not.toBe(initial)
  })

  it('hydrates only an unchanged initial manuscript and ignores server body text', async () => {
    const initial = createManuscript({ projectId: 'project-1', workType: 's', now: '2026-09-07T12:00:00Z' })
    const fetcher = vi.fn(async () => Response.json({ topic: 'Server title', workType: 's', manuscript: 'untrusted server body' }))
    const result = await loadServerProjectSnapshot(initial, () => initial, fetcher)
    expect(result?.title).toBe('Server title')
    expect(JSON.stringify(result)).not.toContain('untrusted server body')
    expect(fetcher).toHaveBeenCalledWith('/api/state?projectId=project-1', { cache: 'no-store' })
  })
})
