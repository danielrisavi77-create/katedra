// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useManuscriptState } from './use-manuscript-state'
import { createManuscript } from '../../../lib/manuscript/model'
import { loadServerProjectSnapshot } from '../../../lib/manuscript/server-hydration'

it('invalidates pending hydration before React commits a queued manuscript update', async () => {
  const { result } = renderHook(() => useManuscriptState())
  const initial = createManuscript({ projectId: 'project-1', workType: 's', now: '2026-09-07T12:00:00Z' })
  act(() => result.current[1](initial))
  const revision = result.current[2].current
  let resolve!: (response: Response) => void
  const pending = loadServerProjectSnapshot(initial,
    () => result.current[2].current === revision ? initial : null,
    () => new Promise<Response>(done => { resolve = done }),
  )
  await act(async () => {
    result.current[1](current => current ? { ...current, title: 'Local title' } : current)
    expect(result.current[0]).toBe(initial)
    expect(result.current[2].current).toBeGreaterThan(revision)
    resolve(Response.json({ topic: 'Server title', workType: 's' }))
    expect(await pending).toBeNull()
  })
  expect(result.current[0]?.title).toBe('Local title')
})
