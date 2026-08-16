import { describe, expect, it } from 'vitest'

import { validateDocxBuffer } from './validation'

function validBuffer() {
  return Buffer.concat([
    Buffer.from('PK\x03\x04 [Content_Types].xml word/document.xml'),
    centralEntry({ compressedSize: 100, uncompressedSize: 100 }),
  ])
}

function centralEntry({ compressedSize, uncompressedSize, encrypted = false, name = '[Content_Types].xml' }) {
  const header = Buffer.alloc(46)
  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(encrypted ? 1 : 0, 8)
  header.writeUInt32LE(compressedSize, 20)
  header.writeUInt32LE(uncompressedSize, 24)
  header.writeUInt16LE(Buffer.byteLength(name), 28)
  return Buffer.concat([header, Buffer.from(name)])
}

describe('validateDocxBuffer', () => {
  it('accepts a DOCX-shaped ZIP with the required OOXML entries', () => {
    expect(validateDocxBuffer(validBuffer(), { name: 'rad.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toEqual({ ok: true })
  })

  it('rejects a wrong extension, non-ZIP payload, or missing OOXML parts', () => {
    expect(validateDocxBuffer(Buffer.from('not a zip'), { name: 'rad.docx', type: '' })).toMatchObject({ ok: false, status: 415 })
    expect(validateDocxBuffer(validBuffer(), { name: 'rad.pdf', type: 'application/pdf' })).toMatchObject({ ok: false, status: 415 })
    expect(validateDocxBuffer(Buffer.from('PK\x03\x04 only'), { name: 'rad.docx', type: '' })).toMatchObject({ ok: false, status: 415 })
  })

  it('rejects encrypted or highly compressed ZIP entries', () => {
    const encrypted = Buffer.concat([validBuffer(), centralEntry({ compressedSize: 100, uncompressedSize: 100, encrypted: true })])
    expect(validateDocxBuffer(encrypted, { name: 'rad.docx', type: '' })).toMatchObject({ ok: false, status: 422 })

    const bomb = Buffer.concat([validBuffer(), centralEntry({ compressedSize: 10, uncompressedSize: 2_000_000 })])
    expect(validateDocxBuffer(bomb, { name: 'rad.docx', type: '' })).toMatchObject({ ok: false, status: 422 })
  })
})
