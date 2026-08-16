import { describe, expect, it } from 'vitest'

import { createMaterialAsset, createMaterialProvider, MAX_MATERIAL_TTL_MS } from './provider'

describe('material provider', () => {
  it('creates an expiring project-scoped material manifest', async () => {
    const provider = createMaterialProvider({ now: () => 1_000 })
    const asset = await provider.extract({
      projectId: 'project-1',
      id: 'material-1',
      name: 'biljeske.txt',
      kind: 'notes',
      mimeType: 'text/plain',
      buffer: Buffer.from('tekst'),
    })

    expect(asset).toMatchObject({ id: 'material-1', projectId: 'project-1', extractionStatus: 'extracted', extractedText: 'tekst' })
    expect(Date.parse(asset.expiresAt)).toBe(1_000 + Math.min(MAX_MATERIAL_TTL_MS, 72 * 60 * 60 * 1000))
  })

  it('caps a requested TTL at seven days', () => {
    const asset = createMaterialAsset({
      id: 'material-1', projectId: 'project-1', name: 'x.txt', kind: 'notes', mimeType: 'text/plain',
    }, 0, 99 * 24 * 60 * 60 * 1000)

    expect(Date.parse(asset.expiresAt)).toBe(MAX_MATERIAL_TTL_MS)
  })
})
