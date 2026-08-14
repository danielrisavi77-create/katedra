import { describe, expect, it } from 'vitest'

import { validateImportedText, validateTextImport } from './import-validation'

describe('manuscript text import validation', () => {
  it('accepts txt and markdown files within the size limit', () => {
    expect(validateTextImport({ name: 'draft.TXT', size: 20 })).toEqual({ ok: true })
    expect(validateTextImport({ name: 'draft.md', size: 2_000_000 })).toEqual({ ok: true })
  })

  it('rejects unsupported and oversized files', () => {
    expect(validateTextImport({ name: 'draft.docx', size: 20 })).toMatchObject({ ok: false, reason: 'extension' })
    expect(validateTextImport({ name: 'draft.md', size: 2_000_001 })).toMatchObject({ ok: false, reason: 'too_large' })
  })

  it('rejects empty imported text', () => {
    expect(validateImportedText(' \n\t ')).toMatchObject({ ok: false, reason: 'empty' })
    expect(validateImportedText('Tekst')).toEqual({ ok: true })
  })
})
