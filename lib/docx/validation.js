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

  const centralDirectorySignature = Buffer.from([0x50, 0x4b, 0x01, 0x02])
  let offset = 0
  let entries = 0
  let totalUncompressed = 0
  while ((offset = buffer.indexOf(centralDirectorySignature, offset)) !== -1) {
    if (offset + 46 > buffer.length) return failure('Oštećen DOCX ZIP zapis.', 422)
    entries += 1
    if (entries > MAX_ZIP_ENTRIES) return failure('DOCX sadrži previše ZIP zapisa.', 422)

    const flags = buffer.readUInt16LE(offset + 8)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength
    if (nextOffset > buffer.length) return failure('Oštećen DOCX ZIP zapis.', 422)
    if (flags & 1) return failure('Šifrirani DOCX nije podržan.', 422)
    if (uncompressedSize > MAX_UNCOMPRESSED_BYTES) return failure('DOCX sadrži previše raspakiranih podataka.', 422)
    if (compressedSize === 0 ? uncompressedSize > 0 : uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO) {
      return failure('DOCX ima sumnjiv omjer kompresije.', 422)
    }
    totalUncompressed += uncompressedSize
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) return failure('DOCX sadrži previše raspakiranih podataka.', 422)
    offset = nextOffset
  }

  if (entries === 0) return failure('DOCX nema ZIP centralni direktorij.', 422)
  return { ok: true }
}

export const DOCX_LIMITS = {
  maxBytes: MAX_DOCX_BYTES,
  maxZipEntries: MAX_ZIP_ENTRIES,
  maxUncompressedBytes: MAX_UNCOMPRESSED_BYTES,
}
