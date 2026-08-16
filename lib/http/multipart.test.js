import { describe, expect, it } from 'vitest'

import { readMultipartForm } from './multipart.js'

function multipartRequest(body, boundary, headers = {}) {
  return new Request('http://localhost/api/upload', {
    method: 'POST',
    body: new ReadableStream({
      start(controller) {
        const bytes = new TextEncoder().encode(body)
        for (let index = 0; index < bytes.length; index += 7) {
          controller.enqueue(bytes.slice(index, index + 7))
        }
        controller.close()
      },
    }),
    duplex: 'half',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, ...headers },
  })
}

describe('readMultipartForm', () => {
  it('parses fields and a file from arbitrarily split chunks', async () => {
    const boundary = 'katedra-boundary'
    const body = [
      `--${boundary}\r\nContent-Disposition: form-data; name="projectId"\r\n\r\nproject-1\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nmentor\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="upute.txt"\r\nContent-Type: text/plain\r\n\r\nMentor kaže: napiši tezu.\r\n`,
      `--${boundary}--\r\n`,
    ].join('')

    const result = await readMultipartForm(multipartRequest(body, boundary), {
      maxBytes: 1024,
      maxFileBytes: 256,
      maxFieldBytes: 128,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fields).toMatchObject({ projectId: 'project-1', kind: 'mentor' })
    expect(result.file).toMatchObject({ name: 'upute.txt', type: 'text/plain', size: 27 })
    expect(result.file?.buffer.toString('utf8')).toBe('Mentor kaže: napiši tezu.')
  })

  it('rejects chunked bodies over the total limit before retaining the file', async () => {
    const boundary = 'katedra-boundary'
    const body = [
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="large.txt"\r\nContent-Type: text/plain\r\n\r\n`,
      'x'.repeat(200),
      `\r\n--${boundary}--\r\n`,
    ].join('')

    const result = await readMultipartForm(multipartRequest(body, boundary), {
      maxBytes: 128,
      maxFileBytes: 1024,
      maxFieldBytes: 128,
    })

    expect(result).toEqual({ ok: false, status: 413, error: 'Datoteka je prevelika.' })
  })

  it('rejects a file that exceeds the file limit even when the request fits', async () => {
    const boundary = 'katedra-boundary'
    const body = [
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="large.txt"\r\nContent-Type: text/plain\r\n\r\n`,
      'x'.repeat(20),
      `\r\n--${boundary}--\r\n`,
    ].join('')

    const result = await readMultipartForm(multipartRequest(body, boundary), {
      maxBytes: 1024,
      maxFileBytes: 8,
      maxFieldBytes: 128,
    })

    expect(result).toEqual({ ok: false, status: 413, error: 'Datoteka je prevelika.' })
  })
})
