// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { MaterialPrivacy } from './material-privacy'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const row = { materialId: '11111111-1111-4111-8111-111111111111', manifestId: '22222222-2222-4222-8222-222222222222', createdAt: '2026-09-07T12:00:00Z', expiresAt: '2026-09-10T12:00:00Z', cleanup: 'retained' }
it('opens metadata and withdraws consent without requiring a Pass', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ materials: [row], nextCursor: null }) })
    .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ cleanup: 'pending', deletionRequested: row.materialId }) })
  vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('confirm', () => true)
  render(<MaterialPrivacy projectId="project-1" />)
  expect(fetchMock).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Privremeni materijali i brisanje' }))
  expect(fetchMock).toHaveBeenCalledWith('/api/materials/privacy?projectId=project-1', { cache: 'no-store' })
  await user.click(await screen.findByRole('button', { name: 'Povuci pristanak' }))
  expect(screen.getByRole('status').textContent).toContain('uklanjanje datoteka još traje')
  expect(screen.getByRole('button', { name: 'Provjeri brisanje' })).toBeTruthy()
  expect(screen.getByRole('status').textContent).not.toContain('Materijal je obrisan.')
})
it('clears the old project inventory when switching projects', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ materials: [row] }) }))
  const { rerender } = render(<MaterialPrivacy projectId="project-1" />)
  await user.click(screen.getByRole('button', { name: 'Privremeni materijali i brisanje' }))
  await screen.findByRole('button', { name: 'Povuci pristanak' })
  rerender(<MaterialPrivacy projectId="project-2" />)
  expect(screen.queryByRole('button', { name: 'Povuci pristanak' })).toBeNull()
})
it('explains dependent run withdrawal before confirmation and keeps incomplete cleanup pending', async () => {
  const user = userEvent.setup()
  const confirm = vi.fn().mockReturnValue(true)
  vi.stubGlobal('confirm', confirm)
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ materials: [row] }) })
    .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ cleanup: 'pending', deletionRequested: row.materialId, runConsentRevoked: true }) }))
  render(<MaterialPrivacy projectId="project-1" />)
  await user.click(screen.getByRole('button', { name: 'Privremeni materijali i brisanje' }))
  await user.click(await screen.findByRole('button', { name: 'Povuci pristanak' }))
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('zaustavit će se'))
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Lokalni rukopis ostaje sačuvan.'))
  expect(screen.getByRole('status').textContent).toContain('povezani tijek zaustavljen')
  expect(screen.getByRole('status').textContent).toContain('uklanjanje njegovih privremenih kopija još traje')
})
