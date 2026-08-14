import { describe, expect, it } from 'vitest'

import { syncMetadata } from './sync-status'

const input = { projectId: 'project-1', workType: 'd' as const, title: 'Rad', meta: {} }

describe('syncMetadata', () => {
  it('reports a successful metadata sync', async () => {
    const result = await syncMetadata(input, true, async () => new Response(JSON.stringify({ projectId: 'project-1' }), { status: 200 }))
    expect(result).toEqual({ status: 'synced', responseStatus: 200 })
  })

  it('does not treat an HTTP error as a successful sync', async () => {
    const result = await syncMetadata(input, true, async () => new Response('{}', { status: 500 }))
    expect(result).toEqual({ status: 'failed', responseStatus: 500 })
  })

  it('reports network failures while keeping local use available', async () => {
    const result = await syncMetadata(input, true, async () => { throw new Error('offline') })
    expect(result).toEqual({ status: 'failed' })
  })

  it('reports anonymous use as local-only', async () => {
    const result = await syncMetadata(input, false, async () => new Response('{}', { status: 200 }))
    expect(result).toEqual({ status: 'local_only' })
  })

  it('rejects a response for another project', async () => {
    const result = await syncMetadata(input, true, async () => new Response(JSON.stringify({ projectId: 'project-2' }), { status: 200 }))
    expect(result).toEqual({ status: 'failed', responseStatus: 200 })
  })
})
