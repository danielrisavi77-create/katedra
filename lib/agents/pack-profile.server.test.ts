import { beforeEach, describe, expect, it, vi } from 'vitest'

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }))
vi.mock('node:fs/promises', () => ({ readFile }))

beforeEach(() => {
  vi.resetModules()
  readFile.mockReset()
})

describe('packProfileHint', () => {
  it('returns null for an unknown profileId', async () => {
    readFile.mockResolvedValue(JSON.stringify({ profiles: [{ id: 'known', unitId: 'unit-1', citation: 'fpzg' }] }))
    const { packProfileHint } = await import('./pack-profile.server')
    await expect(packProfileHint('unknown')).resolves.toBeNull()
  })

  it('returns a known profile hint with string citation and caches the pack', async () => {
    readFile.mockResolvedValue(JSON.stringify({ profiles: [{ id: 'known', unitId: 'unit-1', label: 'FPZG', citation: 'fpzg' }] }))
    const { packProfileHint } = await import('./pack-profile.server')
    const hint = await packProfileHint('known')
    expect(hint).toMatchObject({ label: 'FPZG', citation: 'fpzg' })
    expect(typeof hint?.citation).toBe('string')
    readFile.mockRejectedValue(new Error('File unavailable after first read'))
    await expect(packProfileHint('known')).resolves.toEqual(hint)
  })

  it('returns null without throwing when the pack file is missing', async () => {
    readFile.mockRejectedValue(Object.assign(new Error('File not found'), { code: 'ENOENT' }))
    const { packProfileHint } = await import('./pack-profile.server')
    await expect(packProfileHint('known')).resolves.toBeNull()
  })
})
