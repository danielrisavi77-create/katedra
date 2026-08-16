import { describe, expect, it, vi } from 'vitest'

import { extractMaterial } from './extractors'

describe('material extractors', () => {
  it('extracts UTF-8 text and markdown with a bounded result', async () => {
    await expect(extractMaterial({ name: 'biljeske.txt', mimeType: 'text/plain', buffer: Buffer.from('  Prva bilješka\n\nDrugi odlomak  ') })).resolves.toMatchObject({
      status: 'extracted',
      text: 'Prva bilješka\n\nDrugi odlomak',
      warnings: [],
    })
    await expect(extractMaterial({ name: 'izvor.md', mimeType: 'text/markdown', buffer: Buffer.from('# Naslov') })).resolves.toMatchObject({ status: 'extracted' })
  })

  it('rejects an unsupported extension and an empty document', async () => {
    await expect(extractMaterial({ name: 'rad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') })).resolves.toMatchObject({ status: 'failed' })
    await expect(extractMaterial({ name: 'prazno.txt', mimeType: 'text/plain', buffer: Buffer.from(' \n ') })).resolves.toMatchObject({ status: 'needs_review' })
  })

  it('rejects a file whose MIME type conflicts with its extension', async () => {
    await expect(extractMaterial({ name: 'rad.pdf', mimeType: 'text/plain', buffer: Buffer.from('not a pdf') })).resolves.toMatchObject({ status: 'failed' })
    await expect(extractMaterial({ name: 'biljeske.txt', mimeType: 'application/pdf', buffer: Buffer.from('tekst') })).resolves.toMatchObject({ status: 'failed' })
    await expect(extractMaterial({ name: 'scan.png', mimeType: 'text/plain', buffer: Buffer.from('slika') })).resolves.toMatchObject({ status: 'failed' })
  })

  it('uses the configured OCR provider for image material', async () => {
    const ocr = vi.fn().mockResolvedValue({ text: 'Prepoznati tekst', warnings: [] })

    await expect(extractMaterial({ name: 'scan.png', mimeType: 'image/png', buffer: Buffer.from('image') }, { ocr })).resolves.toMatchObject({
      status: 'extracted',
      text: 'Prepoznati tekst',
    })
    expect(ocr).toHaveBeenCalledOnce()
  })

  it('returns needs_review when OCR cannot confidently read the image', async () => {
    await expect(extractMaterial({ name: 'scan.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('image') }, {
      ocr: async () => ({ text: '', warnings: ['Nizak OCR confidence'] }),
    })).resolves.toMatchObject({ status: 'needs_review', warnings: expect.arrayContaining(['Nizak OCR confidence']) })
  })

  it('does not expose provider exception details to the upload client', async () => {
    const result = await extractMaterial({ name: 'scan.png', mimeType: 'image/png', buffer: Buffer.from('image') }, {
      ocr: async () => { throw new Error('internal provider URL and credential detail') },
    })

    expect(result).toMatchObject({
      status: 'failed',
      warnings: ['Ekstrakcija materijala nije uspjela.'],
    })
    expect(result.warnings.join(' ')).not.toContain('internal provider')
  })
})
