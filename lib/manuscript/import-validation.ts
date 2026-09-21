const MAX_TEXT_IMPORT_BYTES = 2_000_000

export type ImportValidationResult =
  | { ok: true }
  | { ok: false; reason: 'extension' | 'too_large' | 'empty' }

export function validateTextImport(file: { name: string; size: number }): ImportValidationResult {
  const name = file.name.toLocaleLowerCase('hr-HR')
  if (!name.endsWith('.txt') && !name.endsWith('.md')) return { ok: false, reason: 'extension' }
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_TEXT_IMPORT_BYTES) return { ok: false, reason: 'too_large' }
  return { ok: true }
}

export function validateImportedText(text: string): ImportValidationResult {
  return text.trim() ? { ok: true } : { ok: false, reason: 'empty' }
}
