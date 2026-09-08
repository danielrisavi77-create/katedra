import { describe, expect, it, vi } from 'vitest'
import { trackedPayloadUpload } from './tracked-upload'
const body = new TextEncoder().encode('private response')
const input = { manifestId: 'manifest-1', kind: 'body' as const, path: 'user/project/run/result.json', body }
function fixture() {
  const events: string[] = []
  const rpc = vi.fn(async (name: string) => { events.push(name); return { data: name === 'begin_agent_payload_upload' ? 'upload' : 'uploaded', error: null } })
  const upload = vi.fn(async () => { events.push('upload'); return { error: null } })
  const download = vi.fn(async () => ({ data: body, error: null }))
  return { events, rpc, upload, download, db: { rpc, storage: { from: () => ({ upload, download }) } } }
}
describe('durable upload tracking', () => {
  it('records start before bytes and completion after Storage acknowledgement', async () => {
    const f = fixture()
    expect(await trackedPayloadUpload(f.db, input)).toBe(true)
    expect(f.events).toEqual(['begin_agent_payload_upload', 'upload', 'finish_agent_payload_upload'])
    expect(JSON.stringify(f.rpc.mock.calls)).not.toContain('private response')
  })
  it('does not repeat a started upload with an uncertain outcome', async () => {
    const f = fixture(); f.rpc.mockResolvedValue({ data: 'uncertain', error: null })
    expect(await trackedPayloadUpload(f.db, input)).toBe(false)
    expect(f.upload).not.toHaveBeenCalled()
  })
  it('does not send bytes after an ambiguous start response', async () => {
    const f = fixture(); f.rpc.mockRejectedValueOnce(new Error('lost acknowledgement'))
    expect(await trackedPayloadUpload(f.db, input)).toBe(false)
    expect(f.upload).not.toHaveBeenCalled()
  })
  it('records uncertainty after a lost Storage response instead of claiming completion', async () => {
    const f = fixture(); f.upload.mockRejectedValueOnce(new Error('connection lost'))
    expect(await trackedPayloadUpload(f.db, input)).toBe(false)
    expect(f.rpc).toHaveBeenLastCalledWith('finish_agent_payload_upload', expect.objectContaining({ p_succeeded: false }))
  })
  it('waits for the upload to finish before recording a late successful result', async () => {
    const f = fixture()
    let finish!: (value: { error: null }) => void
    f.upload.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = trackedPayloadUpload(f.db, input)
    await vi.waitFor(() => expect(f.upload).toHaveBeenCalledOnce())
    expect(f.rpc).toHaveBeenCalledTimes(1)
    finish({ error: null })
    expect(await pending).toBe(true)
    expect(f.rpc).toHaveBeenLastCalledWith('finish_agent_payload_upload', expect.objectContaining({ p_succeeded: true }))
  })
  it('reuses only byte-identical persisted content without another upload', async () => {
    const f = fixture(); f.rpc.mockResolvedValue({ data: 'stored', error: null })
    expect(await trackedPayloadUpload(f.db, input)).toBe(true)
    f.download.mockResolvedValueOnce({ data: new TextEncoder().encode('different'), error: null })
    expect(await trackedPayloadUpload(f.db, input)).toBe(false)
    expect(f.upload).not.toHaveBeenCalled()
  })
})
