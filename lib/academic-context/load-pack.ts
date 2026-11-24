import type { AcademicCatalog, AcademicPackMeta, AcademicPackSource, AcademicProfile, AcademicRuleStatus, AcademicUnit } from './types'

const MAX_UNITS = 500
const MAX_PROFILES = 2_000
const MAX_LIST_ITEMS = 100
const MAX_SOURCES = 50
const MAX_TEXT_LENGTH = 2_000

const ACADEMIC_STATUSES = new Set<AcademicRuleStatus>(['verified', 'partial', 'research', 'generic'])

export function loadAcademicPackFromValue(value: unknown): AcademicCatalog {
  if (!isRecord(value)) return { units: [], profiles: [] }

  return {
    ...(isRecord(value.meta) ? { meta: toMeta(value.meta) } : {}),
    units: Array.isArray(value.units) ? value.units.flatMap(toUnit).slice(0, MAX_UNITS) : [],
    profiles: Array.isArray(value.profiles) ? value.profiles.flatMap(toProfile).slice(0, MAX_PROFILES) : [],
  }
}

export const createAcademicCatalog = loadAcademicPackFromValue

export function loadAcademicPackFromValueOrEmpty(value: unknown): AcademicCatalog {
  try {
    return loadAcademicPackFromValue(value)
  } catch {
    return { units: [], profiles: [] }
  }
}

function toUnit(value: unknown): AcademicUnit[] {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.name)) return []
  return [{
    id: limitText(value.id),
    name: limitText(value.name),
    inst: isNonEmptyString(value.inst) ? limitText(value.inst) : '',
    profiles: toStringList(value.profiles),
  }]
}

function toProfile(value: unknown): AcademicProfile[] {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.unitId) || !isNonEmptyString(value.label)) return []
  return [{
    id: limitText(value.id),
    unitId: limitText(value.unitId),
    label: limitText(value.label),
    workTypes: toStringList(value.workTypes),
    ...(toStatus(value.status) ? { status: toStatus(value.status) } : {}),
    ...(toOptionalText(value.verifiedAt) ? { verifiedAt: toOptionalText(value.verifiedAt) } : {}),
    ...(toPositiveNumber(value.wordMin) !== undefined ? { wordMin: toPositiveNumber(value.wordMin) } : {}),
    ...(toPositiveNumber(value.wordMax) !== undefined ? { wordMax: toPositiveNumber(value.wordMax) } : {}),
    ...(toPositiveNumber(value.pageMin) !== undefined ? { pageMin: toPositiveNumber(value.pageMin) } : {}),
    ...(toPositiveNumber(value.pageMax) !== undefined ? { pageMax: toPositiveNumber(value.pageMax) } : {}),
    ...(firstPositiveNumber(value.minReferences, value.minimumReferences) !== undefined ? {
      minReferences: firstPositiveNumber(value.minReferences, value.minimumReferences),
      minimumReferences: firstPositiveNumber(value.minReferences, value.minimumReferences),
    } : {}),
    ...(firstPositiveNumber(value.minimumBooks, value.minBooks, value.bookMin) !== undefined ? { minimumBooks: firstPositiveNumber(value.minimumBooks, value.minBooks, value.bookMin) } : {}),
    ...(toOptionalText(value.citation) ? { citation: toOptionalText(value.citation) } : {}),
    ...(toOptionalText(value.font) ? { font: toOptionalText(value.font) } : {}),
    ...(toPositiveNumber(value.size) !== undefined ? { size: toPositiveNumber(value.size) } : {}),
    ...(toPositiveNumber(value.spacing) !== undefined ? { spacing: toPositiveNumber(value.spacing) } : {}),
    sections: toStringList(value.sections),
    manualChecks: toStringList(value.manualChecks),
    facts: toStringList(value.facts),
    submissionFacts: toStringList(value.submissionFacts),
    sources: toSources(value.sources),
  }]
}

function toSources(value: unknown): AcademicPackSource[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const title = isNonEmptyString(item.t) ? item.t : item.title
    const url = isNonEmptyString(item.u) ? item.u : item.url
    if (!isNonEmptyString(title) || !isHttpUrl(url)) return []
    return [{ title: limitText(title), url: limitText(url) }]
  }).slice(0, MAX_SOURCES)
}

function toMeta(value: Record<string, unknown>): AcademicPackMeta {
  return {
    ...(toOptionalText(value.schemaVersion) ? { schemaVersion: toOptionalText(value.schemaVersion) } : {}),
    ...(toOptionalText(value.contractVersion) ? { contractVersion: toOptionalText(value.contractVersion) } : {}),
    ...(toOptionalText(value.generatedAt) ? { generatedAt: toOptionalText(value.generatedAt) } : {}),
    ...(toOptionalText(value.sourceProduct) ? { sourceProduct: toOptionalText(value.sourceProduct) } : {}),
    ...(toOptionalText(value.status) ? { status: toOptionalText(value.status) } : {}),
  }
}

function toStatus(value: unknown): AcademicRuleStatus | undefined {
  return typeof value === 'string' && ACADEMIC_STATUSES.has(value as AcademicRuleStatus) ? value as AcademicRuleStatus : undefined
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(isNonEmptyString).map(limitText).slice(0, MAX_LIST_ITEMS)
}

function toOptionalText(value: unknown): string | undefined {
  return isNonEmptyString(value) ? limitText(value) : undefined
}

function toPositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function firstPositiveNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const number = toPositiveNumber(value)
    if (number !== undefined) return number
  }
  return undefined
}

function isHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function limitText(value: string): string {
  return value.trim().slice(0, MAX_TEXT_LENGTH)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim())
}
