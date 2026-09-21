import { checkZipResourceBounds } from './zip-resource-check'

const MAX_DOCX_BYTES = 20 * 1024 * 1024
const MAX_ZIP_ENTRIES = 1_000
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
const MAX_COMPRESSION_RATIO = 100
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function failure(error, status) {
  return { ok: false, error, status }
}

export function validateDocxBuffer(buffer, metadata = {}) {
  const name = typeof metadata.name === 'string' ? metadata.name : ''
  const type = typeof metadata.type === 'string' ? metadata.type : ''
  if (!/\.docx$/i.test(name) || (type && type !== DOCX_MIME && type !== 'application/zip')) {
    return failure('Datoteka mora biti DOCX.', 415)
  }
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_DOCX_BYTES) {
    return failure('Datoteka je prevelika.', 413)
  }
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) {
    return failure('Datoteka nije valjan ZIP/DOCX.', 415)
  }
  if (!buffer.includes(Buffer.from('[Content_Types].xml')) || !buffer.includes(Buffer.from('word/document.xml'))) {
    return failure('Nedostaju obavezni DOCX dijelovi.', 415)
  }

  const resourceCheck = checkZipResourceBounds(buffer, {
    maxEntries: MAX_ZIP_ENTRIES, maxExpandedBytes: MAX_UNCOMPRESSED_BYTES, maxRatio: MAX_COMPRESSION_RATIO,
  })
  if (!resourceCheck.ok) return failure(resourceCheck.error, 422)
  if (!resourceCheck.names.has('[Content_Types].xml') || !resourceCheck.names.has('word/document.xml')) {
    return failure('Nedostaju obavezni DOCX dijelovi.', 415)
  }
  return { ok: true }
}

export const DOCX_LIMITS = {
  maxBytes: MAX_DOCX_BYTES,
  maxZipEntries: MAX_ZIP_ENTRIES,
  maxUncompressedBytes: MAX_UNCOMPRESSED_BYTES,
}
