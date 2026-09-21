import { validateImportedText, validateTextImport } from './import-validation'
import type { ManuscriptMaterialContext } from './context'

export const COMPOSER_MATERIALS_PREFIX = 'katedra_composer_materials_v1:'
export const COMPOSER_MATERIALS_MAX_ITEMS = 10
export const COMPOSER_MATERIALS_MAX_TOTAL_CHARS = 60_000
export const COMPOSER_MATERIAL_MAX_CHARS = 30_000
const MAX_STORED_JSON_CHARS = 300_000

export type ComposerMaterialV1 = ManuscriptMaterialContext & {
  addedAt: string
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function composerMaterialsStorageKey(projectId: string): string {
  return `${COMPOSER_MATERIALS_PREFIX}${projectId}`
}

export async function readLocalTextMaterial(file: { name: string; size: number; text: () => Promise<string> }): Promise<ComposerMaterialV1> {
  const validation = validateTextImport(file)
  if (validation.ok === false) {
    throw new Error(validation.reason === 'extension'
      ? 'Odaberi .txt ili .md datoteku.'
      : 'Tekstualna datoteka mora biti manja od 2 MB.')
  }

  const text = await file.text()
  if (!validateImportedText(text).ok) throw new Error('Odabrana datoteka nema tekstualni sadržaj.')
  const truncated = text.length > COMPOSER_MATERIAL_MAX_CHARS
  return {
    name: file.name,
    text: truncated ? text.slice(0, COMPOSER_MATERIAL_MAX_CHARS) : text,
    warnings: truncated ? ['Sadržaj je skraćen na 30.000 znakova za razgovor. Izvorna datoteka nije promijenjena.'] : [],
    addedAt: new Date().toISOString(),
  }
}

export function createUnreadableMaterial(file: { name: string; type?: string }): ComposerMaterialV1 {
  const isImage = typeof file.type === 'string' && file.type.startsWith('image/')
  return {
    name: file.name,
    text: undefined,
    warnings: [isImage
      ? 'Slika je dodana kao privitak, ali ovaj tekstualni razgovor još nema aktivnu analizu slika.'
      : 'Datoteka je dodana kao privitak, ali njezin sadržaj još nije dostupan ovom tekstualnom razgovoru.'],
    addedAt: new Date().toISOString(),
  }
}

export function isDocxFile(file: { name: string }): boolean {
  return /\.docx$/i.test(file.name)
}

export function normalizeComposerMaterials(value: unknown): ComposerMaterialV1[] {
  if (!Array.isArray(value)) return []
  const normalized: ComposerMaterialV1[] = []
  let remaining = COMPOSER_MATERIALS_MAX_TOTAL_CHARS
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const candidate = item as Record<string, unknown>
    if (typeof candidate.name !== 'string' || !candidate.name.trim() || candidate.name.length > 300) continue
    const text = typeof candidate.text === 'string' ? candidate.text.slice(0, Math.min(COMPOSER_MATERIAL_MAX_CHARS, remaining)) : undefined
    const warnings = Array.isArray(candidate.warnings)
      ? candidate.warnings.filter((warning): warning is string => typeof warning === 'string' && warning.length <= 500).slice(0, 5)
      : []
    const addedAt = typeof candidate.addedAt === 'string' && candidate.addedAt.length <= 100 ? candidate.addedAt : new Date(0).toISOString()
    normalized.push({ name: candidate.name, text, warnings, addedAt })
    remaining -= text?.length || 0
    if (normalized.length >= COMPOSER_MATERIALS_MAX_ITEMS || remaining <= 0) break
  }
  return normalized
}

export function readStoredComposerMaterials(storage: StorageLike | null | undefined, projectId: string): ComposerMaterialV1[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(composerMaterialsStorageKey(projectId))
    if (!raw || raw.length > MAX_STORED_JSON_CHARS) return []
    return normalizeComposerMaterials(JSON.parse(raw))
  } catch {
    return []
  }
}

export function writeStoredComposerMaterials(storage: StorageLike | null | undefined, projectId: string, materials: unknown): boolean {
  if (!storage) return false
  try {
    const normalized = normalizeComposerMaterials(materials)
    const raw = JSON.stringify(normalized)
    if (raw.length > MAX_STORED_JSON_CHARS) return false
    storage.setItem(composerMaterialsStorageKey(projectId), raw)
    return true
  } catch {
    return false
  }
}
