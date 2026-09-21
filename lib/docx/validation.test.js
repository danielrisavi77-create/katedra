import { describe, expect, it } from 'vitest'
import { Document, Packer, Paragraph } from 'docx'
import mammoth from 'mammoth'

import { validateDocxBuffer } from './validation'
import { zipFixture } from './zip-fixture'

function validBuffer() {
  return zipFixture()
}

describe('validateDocxBuffer', () => {
  it('rejects forged expanded sizes before the semantic parser can inflate them', () => {
    const forged = zipFixture([
      { name: '[Content_Types].xml', text: '<Types />' },
      { name: 'word/document.xml', text: 'x'.repeat(2_000_000), declaredSize: 10 },
    ])
    expect(validateDocxBuffer(forged, { name: 'rad.docx' })).toMatchObject({ ok: false, status: 422 })
  })

  it('accepts actual stored and deflated ZIP entries', () => {
    expect(validateDocxBuffer(zipFixture(), { name: 'rad.docx' })).toEqual({ ok: true })
    expect(validateDocxBuffer(zipFixture([
      { name: '[Content_Types].xml', text: '<Types />', stored: true },
      { name: 'word/document.xml', text: '<document />', stored: true },
    ]), { name: 'rad.docx' })).toEqual({ ok: true })
  })

  it('does not accept required filenames merely embedded in unrelated payload bytes', () => {
    const forged = zipFixture([{ name: 'unrelated.txt', text: '[Content_Types].xml word/document.xml', stored: true }])
    expect(validateDocxBuffer(forged, { name: 'rad.docx' }).ok).toBe(false)
  })

  it('rejects truncated or inconsistent central directory boundaries', () => {
    const truncated = zipFixture().subarray(0, -22)
    expect(validateDocxBuffer(truncated, { name: 'rad.docx' }).ok).toBe(false)
    const inconsistent = zipFixture()
    inconsistent.writeUInt32LE(0, inconsistent.length - 6)
    expect(validateDocxBuffer(inconsistent, { name: 'rad.docx' }).ok).toBe(false)
  })

  it('accepts a DOCX-shaped ZIP with the required OOXML entries', () => {
    expect(validateDocxBuffer(validBuffer(), { name: 'rad.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toEqual({ ok: true })
  })

  it('rejects a wrong extension, non-ZIP payload, or missing OOXML parts', () => {
    expect(validateDocxBuffer(Buffer.from('not a zip'), { name: 'rad.docx', type: '' })).toMatchObject({ ok: false, status: 415 })
    expect(validateDocxBuffer(validBuffer(), { name: 'rad.pdf', type: 'application/pdf' })).toMatchObject({ ok: false, status: 415 })
    expect(validateDocxBuffer(Buffer.from('PK\x03\x04 only'), { name: 'rad.docx', type: '' })).toMatchObject({ ok: false, status: 415 })
  })

  it('rejects encrypted or highly compressed ZIP entries', () => {
    const encrypted = zipFixture([
      { name: '[Content_Types].xml', text: '<Types />' },
      { name: 'word/document.xml', text: '<document />', encrypted: true },
    ])
    expect(validateDocxBuffer(encrypted, { name: 'rad.docx', type: '' })).toMatchObject({ ok: false, status: 422 })

    const bomb = zipFixture([
      { name: '[Content_Types].xml', text: '<Types />' },
      { name: 'word/document.xml', text: 'x'.repeat(2_000_000) },
    ])
    expect(validateDocxBuffer(bomb, { name: 'rad.docx', type: '' })).toMatchObject({ ok: false, status: 422 })
  })

  it('retains real DOCX semantic extraction after the resource check', async () => {
    const buffer = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Synthetic academic text.')] }] }))
    expect(validateDocxBuffer(buffer, { name: 'rad.docx' })).toEqual({ ok: true })
    expect((await mammoth.extractRawText({ buffer })).value).toContain('Synthetic academic text.')
  })
})
