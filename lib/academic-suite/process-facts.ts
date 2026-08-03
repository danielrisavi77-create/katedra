// Katedra-owned institutional policy/process facts.
//
// NOT a rules base. This module deliberately excludes anything that maps to a
// deterministic .docx check (font, margins, citation mechanics, structure) —
// that category stays exclusively Lekta-authored (see contracts.ts
// `AcademicRuleSetExport`, and PRODUCT_CONSTITUTION.md "Akademska pravila").
//
// This file only ever holds institutional POLICY/PROCEDURE facts that are not
// machine-checkable against a document: AI-usage policy, submission process,
// mentor-approval requirements. Every entry must be sourced and dated the same
// way katedra-pack profiles are — an unsourced claim here is worse than no
// claim at all (see VIZIJA.md/Audit 2: a single wrong "faculty requires X" is
// a trust problem, not a feature gap).

export type ProcessFactScope = 'university' | 'faculty' | 'program' | 'course'

export type AiPolicyStance =
  | 'allowed'
  | 'disclosure-required'
  | 'restricted'
  | 'banned'
  | 'unspecified'

export type ProcessFactStatus = 'verified' | 'partial' | 'unverified'

export interface ProcessFactSource {
  t: string
  u: string
}

export interface ProcessFact {
  id: string
  unitId: string
  scope: ProcessFactScope
  /** Optional narrower target within the unit, e.g. program or course name. */
  scopeLabel?: string
  label: string
  aiPolicy: AiPolicyStance
  note?: string
  source?: ProcessFactSource
  /** ISO date the policy took effect, if known. */
  effectiveDate?: string
  /** ISO date a human last confirmed this against the source. */
  verifiedDate?: string
  status: ProcessFactStatus
  /** id of the ProcessFact that replaces this one, once superseded. */
  supersededBy?: string
}

export interface ProcessFactPack {
  schemaVersion: '0.1'
  generatedAt: string
  entries: ProcessFact[]
}

export const AI_POLICY_LABELS: Record<AiPolicyStance, string> = {
  allowed: 'AI dopušten',
  'disclosure-required': 'AI dopušten uz izjavu/naznaku',
  restricted: 'AI ograničen — provjeri detalje',
  banned: 'AI nije dopušten',
  unspecified: 'Politika nije objavljena',
}

export const PROCESS_FACT_STATUS_BADGE: Record<ProcessFactStatus, string> = {
  verified: '✅',
  partial: '🟡',
  unverified: '⚪',
}

let cache: ProcessFactPack | null = null
let pending: Promise<ProcessFactPack | null> | null = null

export async function loadProcessFacts(): Promise<ProcessFactPack | null> {
  if (cache) return cache
  if (!pending) {
    pending = fetch('/katedra-process-facts.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  }
  cache = await pending
  return cache
}

/** Most-specific-first: course > program > faculty > university. */
const SCOPE_PRIORITY: Record<ProcessFactScope, number> = {
  course: 0,
  program: 1,
  faculty: 2,
  university: 3,
}

export function processFactsForUnit(pack: ProcessFactPack | null, unitId: string): ProcessFact[] {
  if (!pack || !unitId) return []
  return pack.entries
    .filter((f) => f.unitId === unitId && !f.supersededBy)
    .sort((a, b) => SCOPE_PRIORITY[a.scope] - SCOPE_PRIORITY[b.scope])
}

/** The single most-specific applicable fact, if any — for compact badge UI. */
export function primaryProcessFactForUnit(pack: ProcessFactPack | null, unitId: string): ProcessFact | null {
  return processFactsForUnit(pack, unitId)[0] || null
}
