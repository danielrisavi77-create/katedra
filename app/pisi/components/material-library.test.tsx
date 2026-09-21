// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MaterialLibrary } from './material-library'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MaterialLibrary', () => {
  it('lets the user delete a temporary material', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ materials: [
        { id: 'material-1', name: 'upute.pdf', kind: 'mentor', extractionStatus: 'extracted' },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: 'material-1' }) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<MaterialLibrary projectId="project-1" />)

    expect(await screen.findByText('upute.pdf')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Obriši materijal upute.pdf' }))

    expect(fetchMock).toHaveBeenLastCalledWith('/api/materials/material-1?projectId=project-1', { method: 'DELETE' })
    expect(screen.queryByText('upute.pdf')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Materijal je obrisan.')
  })

  it('keeps a material visible when an active run prevents deletion', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ materials: [
        { id: 'material-2', name: 'izvor.txt', kind: 'source', extractionStatus: 'extracted' },
      ] }) })
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'Materijal je vezan uz aktivni tijek.' }) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<MaterialLibrary projectId="project-1" />)

    await user.click(await screen.findByRole('button', { name: 'Obriši materijal izvor.txt' }))

    expect(screen.getByText('izvor.txt')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Materijal je vezan uz aktivni tijek.')
  })
})
