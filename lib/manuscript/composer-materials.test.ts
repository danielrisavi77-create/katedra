import { describe, expect, it } from 'vitest'

import {
  createUnreadableMaterial,
  normalizeComposerMaterials,
  readLocalTextMaterial,
  readStoredComposerMaterials,
  writeStoredComposerMaterials,
} from './composer-materials'

describe('composer materials', () => {
  it('reads a local text material without a network request', async () => {
    const material = await readLocalTextMaterial({ name: 'upute.md', size: 12, text: async () => '# Upute\n\nSažetak' })

    expect(material).toMatchObject({ name: 'upute.md', text: '# Upute\n\nSažetak', warnings: [] })
    expect(material.addedAt).toBeTruthy()
  })

  it('rejects unsupported text imports and empty files', async () => {
    await expect(readLocalTextMaterial({ name: 'upute.pdf', size: 12, text: async () => 'tekst' })).rejects.toThrow('Odaberi .txt ili .md')
    await expect(readLocalTextMaterial({ name: 'prazno.txt', size: 0, text: async () => '  ' })).rejects.toThrow('nema tekstualni sadržaj')
  })

  it('bounds text context while preserving a warning', async () => {
    const material = await readLocalTextMaterial({ name: 'veliko.txt', size: 1_900_000, text: async () => 'a'.repeat(31_000) })

    expect(material.text).toHaveLength(30_000)
    expect(material.warnings).toHaveLength(1)
  })

  it('represents image attachments honestly when vision is unavailable', () => {
    expect(createUnreadableMaterial({ name: 'graf.png', type: 'image/png' }).warnings[0]).toContain('analizu slika')
  })

  it('sanitizes and bounds locally persisted materials', () => {
    const materials = normalizeComposerMaterials([
      { name: 'prvi.txt', text: 'a'.repeat(40_000), warnings: ['ok'], addedAt: 'now' },
      { name: '', text: 'ne smije proći' },
      { name: 'drugi.md', text: 'b'.repeat(40_000), warnings: [42] },
    ])

    expect(materials).toHaveLength(2)
    expect(materials[0].text).toHaveLength(30_000)
    expect(materials[1].text).toHaveLength(30_000)
    expect(materials[1].warnings).toEqual([])
  })

  it('round-trips project-scoped materials through storage', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    const materials = [createUnreadableMaterial({ name: 'slika.png', type: 'image/png' })]

    expect(writeStoredComposerMaterials(storage, 'project-1', materials)).toBe(true)
    expect(readStoredComposerMaterials(storage, 'project-1')).toMatchObject([{ name: 'slika.png' }])
    expect(readStoredComposerMaterials(storage, 'project-2')).toEqual([])
  })
})
