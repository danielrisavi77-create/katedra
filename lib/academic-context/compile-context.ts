import { assessAcademicFreshness, isValidAcademicDate } from './freshness'
import { resolveAcademicProfile } from './resolve-profile'
import { academicVisibilityForStatus } from './visibility'
import { compileAcademicMethodologyPlan, compileAcademicSourcePlan } from './plans'
import type { AcademicAiCapability, AcademicCatalog, AcademicContext, AcademicProfile, AcademicRuleStatus } from './types'

const CITATION_LABELS: Record<string, string> = {
  apa7: 'APA 7',
  chicago: 'Chicago',
  fpzg: 'FPZG autor–godina',
  harvard: 'Harvard autor–godina',
  ieee: 'IEEE',
  vancouver: 'Vancouver',
  'pravo-fusnote': 'Pravo / fusnote',
}

const NUMBER_WORDS: Record<string, number> = {
  jedan: 1, jedna: 1, jedne: 1, dva: 2, dvije: 2, tri: 3, četiri: 4, cetiri: 4,
  pet: 5, šest: 6, sest: 6, sedam: 7, osam: 8, devet: 9, deset: 10,
}

export function compileAcademicContext(input: {
  catalog: AcademicCatalog
  unitId?: string
  profileId?: string
  workType?: string
  institutionName?: string
  program?: string
}): AcademicContext {
  const resolved = resolveAcademicProfile(input.catalog, input)
  if (!resolved.ok) return genericContext(input)

  const profile = resolved.profile
  const verifiedAt = isValidAcademicDate(profile.verifiedAt) ? profile.verifiedAt : undefined
  const status = academicRuleStatusForProfile(profile)
  const visibility = academicVisibilityForStatus(status)
  const freshness = assessAcademicFreshness(verifiedAt)
  const workType = input.workType || profile.workTypes[0] || ''
  const aiCapabilities = academicAiCapabilities(status, workType)
  const claims = status === 'verified'
    ? [`Profil je verificiran${verifiedAt ? ` ${verifiedAt}` : ''}.`, ...(freshness.isStale ? ['Datum provjere je stariji od preporučenog praga; provjeri aktualne upute.'] : [])]
    : [visibility.description]

  const context: AcademicContext = {
    unitId: resolved.unit.id,
    profileId: profile.id,
    institutionName: resolved.unit.name,
    institutionLabel: resolved.unit.inst || resolved.unit.name,
    profileLabel: profile.label,
    workType,
    status,
    ...(verifiedAt ? { verifiedAt } : {}),
    freshness,
    ...rangeFields(profile),
    ...(minimumReferences(profile) !== undefined ? { minimumReferences: minimumReferences(profile) } : {}),
    ...(minimumBooks(profile) !== undefined ? { minimumBooks: minimumBooks(profile) } : {}),
    ...(profile.citation ? { citationStyle: citationLabel(profile.citation) } : {}),
    ...formattingFields(profile),
    requiredSections: unique(profile.sections || []),
    manualChecks: unique(profile.manualChecks || []),
    facts: unique(profile.facts || []),
    submissionFacts: unique(profile.submissionFacts || []),
    sources: (profile.sources || []).map((source) => ({ title: source.title, url: source.url })),
    aiPolicy: { mode: visibility.aiMode, claims },
    capabilities: {
      facultyCoaching: visibility.canClaimFacultyRules,
      paidPass: visibility.canPurchasePass,
      webResearch: aiCapabilities.includes('web_research'),
      autonomousRun: aiCapabilities.includes('autonomous_run'),
      aiCapabilities,
    },
  }
  context.sourcePlan = compileAcademicSourcePlan(context)
  context.methodologyPlan = compileAcademicMethodologyPlan(context)
  return context
}

/**
 * Produces one bounded representation shared by prompts and agent payloads.
 * It intentionally omits raw pack metadata and submission facts that are not
 * needed for content generation.
 */
export function serializeAcademicContext(context: AcademicContext): string {
  return JSON.stringify({
    unitId: context.unitId,
    profileId: context.profileId,
    institutionName: context.institutionName,
    profileLabel: context.profileLabel,
    workType: context.workType,
    status: context.status,
    ...(context.verifiedAt ? { verifiedAt: context.verifiedAt } : {}),
    ...(context.freshness ? { freshness: context.freshness } : {}),
    ...(context.wordRange ? { wordRange: context.wordRange } : {}),
    ...(context.pageRange ? { pageRange: context.pageRange } : {}),
    ...(context.minimumReferences !== undefined ? { minimumReferences: context.minimumReferences } : {}),
    ...(context.minimumBooks !== undefined ? { minimumBooks: context.minimumBooks } : {}),
    ...(context.citationStyle ? { citationStyle: context.citationStyle } : {}),
    ...(context.formatting ? { formatting: context.formatting } : {}),
    requiredSections: context.requiredSections.slice(0, 30),
    manualChecks: context.manualChecks.slice(0, 30),
    facts: context.facts.slice(0, 30),
    officialSources: context.sources.slice(0, 20),
    sourcePlan: context.sourcePlan || compileAcademicSourcePlan(context),
    methodologyPlan: context.methodologyPlan || compileAcademicMethodologyPlan(context),
    aiPolicy: context.aiPolicy,
    capabilities: context.capabilities,
  })
}

function genericContext(input: { unitId?: string; profileId?: string; workType?: string; institutionName?: string; program?: string }): AcademicContext {
  const context: AcademicContext = {
    unitId: '',
    profileId: '',
    institutionName: input.institutionName?.trim() || '',
    institutionLabel: input.institutionName?.trim() || 'Nije povezana ustanova',
    profileLabel: input.program?.trim() || 'Opći akademski profil',
    workType: input.workType || '',
    status: 'generic',
    requiredSections: [],
    manualChecks: [],
    facts: [],
    submissionFacts: [],
    sources: [],
    aiPolicy: { mode: 'generic', claims: ['Fakultetska pravila nisu verificirano povezana s ovim projektom.'] },
    capabilities: { facultyCoaching: false, paidPass: false, webResearch: false, autonomousRun: false },
  }
  context.sourcePlan = compileAcademicSourcePlan(context)
  context.methodologyPlan = compileAcademicMethodologyPlan(context)
  return context
}

function normalizeStatus(status: AcademicRuleStatus | undefined, verifiedAt: string | undefined): AcademicRuleStatus {
  if (status === 'verified' && verifiedAt) return 'verified'
  if (status === 'verified') return 'partial'
  if (status === 'partial' || status === 'research') return status
  return 'generic'
}

export function academicRuleStatusForProfile(profile: Pick<AcademicProfile, 'status' | 'verifiedAt'>): AcademicRuleStatus {
  const verifiedAt = isValidAcademicDate(profile.verifiedAt) ? profile.verifiedAt : undefined
  return normalizeStatus(profile.status, verifiedAt)
}

function rangeFields(profile: AcademicProfile): Pick<AcademicContext, 'wordRange' | 'pageRange'> {
  const result: Pick<AcademicContext, 'wordRange' | 'pageRange'> = {}
  if (profile.wordMin !== undefined || profile.wordMax !== undefined) result.wordRange = { ...(profile.wordMin !== undefined ? { min: profile.wordMin } : {}), ...(profile.wordMax !== undefined ? { max: profile.wordMax } : {}) }
  if (profile.pageMin !== undefined || profile.pageMax !== undefined) result.pageRange = { ...(profile.pageMin !== undefined ? { min: profile.pageMin } : {}), ...(profile.pageMax !== undefined ? { max: profile.pageMax } : {}) }
  return result
}

function formattingFields(profile: AcademicProfile): Pick<AcademicContext, 'formatting'> {
  if (!profile.font && profile.size === undefined && profile.spacing === undefined) return {}
  return { formatting: { ...(profile.font ? { font: profile.font } : {}), ...(profile.size !== undefined ? { fontSize: profile.size } : {}), ...(profile.spacing !== undefined ? { lineSpacing: profile.spacing } : {}) } }
}

function citationLabel(value: string): string {
  return CITATION_LABELS[value.toLowerCase()] || value
}

function minimumReferences(profile: AcademicProfile): number | undefined {
  return profile.minimumReferences ?? profile.minReferences
}

function minimumBooks(profile: AcademicProfile): number | undefined {
  if (profile.minimumBooks !== undefined) return profile.minimumBooks
  const text = [...(profile.facts || []), ...(profile.manualChecks || []), ...(profile.submissionFacts || [])].join(' ')
  const match = text.match(/(?:najmanje|minimalno|minimum|at\s+least)\s+([0-9]+|[a-zčćžšđ]+)\s+(?:znanstvenih\s+)?knjig(?:e|a)?\b/i)
    || text.match(/\b([0-9]+|[a-zčćžšđ]+)\s+(?:znanstvenih\s+)?knjig(?:e|a)?\b/i)
  if (!match) return undefined
  const value = /^\d+$/.test(match[1]) ? Number(match[1]) : NUMBER_WORDS[match[1].toLocaleLowerCase('hr')]
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function academicAiCapabilities(status: AcademicRuleStatus, workType: string): AcademicAiCapability[] {
  if (status !== 'verified') return ['contextual_ai']
  const canonical = workType === 's' || workType === 'seminar' || workType === 'seminarski'
    ? 'seminar'
    : workType === 'z' || workType === 'final' || workType === 'zavrsni'
      ? 'final'
      : 'graduate'
  return [
    'contextual_ai',
    'section_writing',
    'source_guidance',
    ...(canonical === 'seminar' ? [] : ['methodology_guidance', 'web_research'] as AcademicAiCapability[]),
    ...(canonical === 'seminar' ? [] : ['autonomous_run'] as AcademicAiCapability[]),
    ...(canonical === 'graduate' ? ['research_design_guidance'] as AcademicAiCapability[] : []),
  ]
}
