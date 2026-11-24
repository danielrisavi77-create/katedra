import type { AcademicFreshness } from './freshness'

export type AcademicRuleStatus = 'verified' | 'partial' | 'research' | 'generic'

export type AcademicPackSource = {
  title: string
  url: string
}

export type AcademicUnit = {
  id: string
  name: string
  inst: string
  profiles: string[]
}

export type AcademicProfile = {
  id: string
  unitId: string
  label: string
  workTypes: string[]
  status?: AcademicRuleStatus
  verifiedAt?: string
  wordMin?: number
  wordMax?: number
  pageMin?: number
  pageMax?: number
  minReferences?: number
  minimumReferences?: number
  minimumBooks?: number
  citation?: string
  font?: string
  size?: number
  spacing?: number
  sections?: string[]
  manualChecks?: string[]
  facts?: string[]
  submissionFacts?: string[]
  sources?: AcademicPackSource[]
}

export type AcademicPackMeta = {
  schemaVersion?: string
  contractVersion?: string
  generatedAt?: string
  sourceProduct?: string
  status?: string
}

export type AcademicCatalog = {
  units: AcademicUnit[]
  profiles: AcademicProfile[]
  meta?: AcademicPackMeta
}

export type AcademicContextSource = AcademicPackSource

export type AcademicSourcePlan = {
  minimumReferences?: number
  minimumBooks?: number
  citationStyle?: string
  officialSources: AcademicContextSource[]
  verification: 'verified_sources_required' | 'source_review_required' | 'general_guidance'
  guidance: string[]
}

export type AcademicMethodologyPlan = {
  status: AcademicRuleStatus
  workType: string
  required: boolean
  requiredSections: string[]
  checks: string[]
  guidance: string[]
}

export type AcademicAiCapability =
  | 'contextual_ai'
  | 'section_writing'
  | 'source_guidance'
  | 'methodology_guidance'
  | 'research_design_guidance'
  | 'web_research'
  | 'autonomous_run'

export type AcademicContext = {
  unitId: string
  profileId: string
  institutionName: string
  institutionLabel: string
  profileLabel: string
  workType: string
  status: AcademicRuleStatus
  verifiedAt?: string
  freshness?: AcademicFreshness
  wordRange?: { min?: number; max?: number }
  pageRange?: { min?: number; max?: number }
  minimumReferences?: number
  minimumBooks?: number
  citationStyle?: string
  formatting?: { font?: string; fontSize?: number; lineSpacing?: number }
  requiredSections: string[]
  manualChecks: string[]
  facts: string[]
  submissionFacts: string[]
  sources: AcademicContextSource[]
  /** Present on compiler output; optional for legacy in-memory fixtures. */
  sourcePlan?: AcademicSourcePlan
  /** Present on compiler output; optional for legacy in-memory fixtures. */
  methodologyPlan?: AcademicMethodologyPlan
  aiPolicy: {
    mode: 'full' | 'generic' | 'coaching'
    claims: string[]
  }
  capabilities: {
    facultyCoaching: boolean
    paidPass: boolean
    webResearch: boolean
    autonomousRun: boolean
    /** Academic-context gates, not a substitute for the server entitlement check. */
    aiCapabilities?: AcademicAiCapability[]
  }
}
