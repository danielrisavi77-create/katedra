const MATERIAL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function resolveMaterialStorageNames(materialId, listedNames) {
  const normalizedId = String(materialId || '').trim()
  if (!MATERIAL_ID_PATTERN.test(normalizedId)) {
    return { ok: false, status: 400, error: 'Neispravan ID materijala.' }
  }

  const names = Array.isArray(listedNames) ? listedNames.filter((name) => typeof name === 'string') : []
  const manifestName = `${normalizedId}.manifest.json`
  const rawNames = names.filter((name) => name.startsWith(`${normalizedId}-`))
  if (rawNames.length > 1) {
    return { ok: false, status: 503, error: 'Materijal ima neispravan storage zapis.' }
  }

  const matches = [manifestName, ...rawNames].filter((name) => names.includes(name))
  if (!matches.length) return { ok: false, status: 404, error: 'Materijal nije pronađen.' }
  return { ok: true, names: matches }
}
