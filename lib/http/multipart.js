import Busboy from 'busboy'
import { Readable } from 'node:stream'

const DEFAULT_FIELD_BYTES = 16 * 1024
const DEFAULT_FILE_BYTES = 20 * 1024 * 1024
const DEFAULT_BODY_BYTES = DEFAULT_FILE_BYTES + 1 * 1024 * 1024
const MAX_FIELDS = 16
const MAX_FILES = 1

export async function readMultipartForm(request, {
  maxBytes = DEFAULT_BODY_BYTES,
  maxFileBytes = DEFAULT_FILE_BYTES,
  maxFieldBytes = DEFAULT_FIELD_BYTES,
} = {}) {
  const contentType = request.headers.get('content-type') || ''
  if (!/^multipart\/form-data\s*;/i.test(contentType)) return badRequest()

  const bodyLimit = positiveLimit(maxBytes, DEFAULT_BODY_BYTES)
  const fileLimit = positiveLimit(maxFileBytes, DEFAULT_FILE_BYTES)
  const fieldLimit = positiveLimit(maxFieldBytes, DEFAULT_FIELD_BYTES)
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > bodyLimit) return tooLarge()
  if (!request.body) return badRequest()

  let parser
  try {
    parser = Busboy({
      headers: { 'content-type': contentType },
      limits: {
        fieldSize: fieldLimit,
        fields: MAX_FIELDS,
        fileSize: fileLimit,
        files: MAX_FILES,
        parts: MAX_FIELDS + MAX_FILES,
      },
    })
  } catch {
    return badRequest()
  }

  const source = Readable.fromWeb(request.body)
  return new Promise((resolve) => {
    const fields = {}
    let file = null
    let totalBytes = 0
    let failed = false
    let fileTooLarge = false

    const finish = (result) => {
      if (failed) return
      failed = true
      resolve(result)
      if (!source.destroyed) source.destroy()
    }

    source.on('data', (chunk) => {
      totalBytes += chunk?.length || 0
      if (totalBytes > bodyLimit) finish(tooLarge())
    })
    source.on('error', () => finish(badRequest()))
    source.on('aborted', () => finish(badRequest()))

    parser.on('field', (name, value, info) => {
      if (failed) return
      if (info?.valueTruncated) return finish(tooLarge())
      fields[name] = value
    })
    parser.on('file', (name, stream, info) => {
      const chunks = []
      let size = 0
      if (name !== 'file' || file) {
        stream.resume()
        return finish(badRequest())
      }
      file = {
        name: typeof info?.filename === 'string' ? info.filename : '',
        type: typeof info?.mimeType === 'string' ? info.mimeType : '',
        size: 0,
        buffer: null,
      }
      stream.on('data', (chunk) => {
        size += chunk.length
        chunks.push(chunk)
      })
      stream.on('limit', () => {
        fileTooLarge = true
      })
      stream.on('end', () => {
        if (!file) return
        file.size = size
        file.buffer = Buffer.concat(chunks, size)
      })
    })
    parser.on('filesLimit', () => finish(badRequest()))
    parser.on('fieldsLimit', () => finish(badRequest()))
    parser.on('partsLimit', () => finish(badRequest()))
    parser.on('error', () => finish(badRequest()))
    parser.on('finish', () => {
      if (failed) return
      if (fileTooLarge) return finish(tooLarge())
      if (!file?.buffer) return finish(badRequest())
      failed = true
      resolve({ ok: true, fields, file })
    })

    source.pipe(parser)
  })
}

function positiveLimit(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

function tooLarge() {
  return { ok: false, status: 413, error: 'Datoteka je prevelika.' }
}

function badRequest() {
  return { ok: false, status: 400, error: 'Neispravan zahtjev.' }
}
