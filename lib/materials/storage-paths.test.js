import { describe, expect, it } from 'vitest'

import { resolveMaterialStorageNames } from './storage-paths.js'

const materialId = '11111111-1111-4111-8111-111111111111'

describe('material storage paths', () => {
  it('requires the complete UUID and ignores a partial prefix', () => {
    expect(resolveMaterialStorageNames(materialId.slice(0, 8), [
      `${materialId}-draft.docx`,
      `${materialId}.manifest.json`,
    ])).toMatchObject({ ok: false, status: 400 })
  })

  it('returns only the exact material manifest and raw object', () => {
    expect(resolveMaterialStorageNames(materialId, [
      `${materialId}-draft.docx`,
      `${materialId}.manifest.json`,
      '22222222-2222-4222-8222-222222222222-other.docx',
    ])).toEqual({
      ok: true,
      names: [`${materialId}.manifest.json`, `${materialId}-draft.docx`],
    })
  })

  it('fails closed when more than one raw object claims the same material', () => {
    expect(resolveMaterialStorageNames(materialId, [
      `${materialId}-a.txt`,
      `${materialId}-b.txt`,
      `${materialId}.manifest.json`,
    ])).toMatchObject({ ok: false, status: 503 })
  })
})
