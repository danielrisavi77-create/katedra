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
  /** Fine-grained per-action answers (Audit 5). Optional — see AiCapabilityFact below; falls back to `aiPolicy` via deriveFromStance() when absent for a given capability. */
  aiCapabilities?: Partial<Record<AiCapabilityId, AiCapabilityFact>>
}

export interface ProcessFactPack {
  schemaVersion: '0.1'
  generatedAt: string
  entries: ProcessFact[]
}

// ---------------------------------------------------------------------------
// AI capability matrix (Audit 5) — additive on top of the coarse `aiPolicy`
// above. `aiPolicy` stays useful as a grubi human-authored stance shown by
// lpRender()'s badge; `aiCapabilities` lets a ProcessFact express DIFFERENT
// answers per concrete AI action instead of one blanket stance (e.g. FOI
// allows literature search but gates chapter drafting behind mentor
// approval — a single `aiPolicy: 'restricted'` cannot say that).
//
// A ProcessFact can be entered with only `aiPolicy` (today's shape) and the
// gate still works via deriveFromStance() below — the matrix is additive
// sourcing, not a required migration.
// ---------------------------------------------------------------------------

/** Concrete AI actions Katedra can gate independently per institution. */
export type AiCapabilityId =
  | 'research_discovery'
  | 'brainstorming'
  | 'structure_assist'
  | 'language_editing'
  | 'translation'
  | 'paraphrase_for_submission'
  | 'generate_submission_text'
  | 'generate_large_sections'
  | 'defense_assistance'

export type AiCapabilityStance = 'allowed' | 'conditional' | 'banned' | 'unspecified'

export interface AiCapabilityCondition {
  /** Only unlockable if the student self-reports (and Katedra cannot verify) mentor sign-off. */
  mentorApproval?: boolean
  disclosureRequired?: boolean
  note?: string
}

export interface AiCapabilityFact {
  stance: AiCapabilityStance
  /** Only meaningful when stance === 'conditional'. */
  condition?: AiCapabilityCondition
}

export const AI_CAPABILITY_LABELS: Record<AiCapabilityId, string> = {
  research_discovery: 'Pretraživanje i pregled literature',
  brainstorming: 'Brainstorming ideja',
  structure_assist: 'Pomoć oko strukture rada',
  language_editing: 'Lektura / jezična provjera vlastitog teksta',
  translation: 'Prijevod',
  paraphrase_for_submission: 'Parafraziranje teksta za predaju',
  generate_submission_text: 'Generiranje teksta za predaju',
  generate_large_sections: 'Generiranje poglavlja/dijelova rada',
  defense_assistance: 'Priprema obrane',
}

export const AI_CAPABILITY_STANCE_BADGE: Record<AiCapabilityStance, string> = {
  allowed: '🟢',
  conditional: '🟡',
  banned: '🔴',
  unspecified: '⚪',
}

// A coarse `aiPolicy: 'restricted' | 'banned'` describes generation/
// authorship risk (the thing Audit 5 is actually about), not a blanket ban
// on AI use. None of the launch faculties reviewed (FPZG, FOI, PMF) ban
// literature search or language editing even where they ban drafting — so a
// fact that only sets the coarse `aiPolicy` must not silently derive
// "banned" for those too. Only these capabilities inherit a restrictive
// coarse stance; the rest fall through (deriveFromStance returns null) to
// the next-less-specific fact, and ultimately to DEFAULT_WHEN_UNSPECIFIED.
const GENERATION_CAPABILITIES = new Set<AiCapabilityId>([
  'paraphrase_for_submission',
  'generate_submission_text',
  'generate_large_sections',
])

/** Derives a capability answer from the coarse `aiPolicy` when a ProcessFact has no fine-grained `aiCapabilities` entry for it. */
function deriveFromStance(stance: AiPolicyStance, capability: AiCapabilityId): AiCapabilityFact | null {
  switch (stance) {
    case 'allowed':
      return { stance: 'allowed' }
    case 'disclosure-required':
      return { stance: 'conditional', condition: { disclosureRequired: true } }
    case 'restricted':
      // No unlock path implied by the coarse label alone — operationally
      // treated as blocked until the specific capability is sourced.
      return GENERATION_CAPABILITIES.has(capability) ? { stance: 'conditional' } : null
    case 'banned':
      return GENERATION_CAPABILITIES.has(capability) ? { stance: 'banned' } : null
    case 'unspecified':
    default:
      return null
  }
}

// Default answer when NEITHER a fine-grained capability entry NOR a coarse
// `aiPolicy` exists for the unit at all (no ProcessFact record whatsoever).
// Tiered, not a flat block: drafting/generation capabilities default to
// blocked (an unverified institution must never be assumed to allow AI to
// write submission text), while process/support capabilities default to
// allowed (none of the launch faculties reviewed in Audit 5 — FPZG, FOI,
// PMF — ban literature search, language editing, translation, structuring,
// or defense prep; defaulting those to blocked would make Katedra
// Socratic-only everywhere while public/katedra-process-facts.json is still
// unseeded, which is a worse product default than the risk it avoids).
const DEFAULT_WHEN_UNSPECIFIED: Record<AiCapabilityId, 'allowed' | 'blocked'> = {
  research_discovery: 'allowed',
  brainstorming: 'allowed',
  structure_assist: 'allowed',
  language_editing: 'allowed',
  translation: 'allowed',
  defense_assistance: 'allowed',
  paraphrase_for_submission: 'blocked',
  generate_submission_text: 'blocked',
  generate_large_sections: 'blocked',
}

export interface ResolvedCapability {
  capability: AiCapabilityId
  stance: AiCapabilityStance
  condition?: AiCapabilityCondition
  /** The actual gate decision, after applying the unspecified-default and (NOT) any self-reported mentor-approval unlock — callers layer that on top. */
  effective: 'allowed' | 'blocked'
  sourceFactId?: string
  sourceStatus?: ProcessFactStatus
  sourceVerifiedDate?: string
}

function isPastOrPresentPolicyDate(value: unknown, now: Date): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    && parsed.getTime() <= now.getTime()
}

function hasVerifiedEvidence(fact: ProcessFact, now: Date): boolean {
  if (fact.status !== 'verified' || typeof fact.source?.t !== 'string' || !fact.source.t.trim()) return false
  try {
    const source = new URL(fact.source.u)
    if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password) return false
  } catch { return false }
  return isPastOrPresentPolicyDate(fact.verifiedDate, now)
    && (!fact.effectiveDate || isPastOrPresentPolicyDate(fact.effectiveDate, now))
}

/**
 * Resolves the effective answer for one AI capability against a unit's
 * process facts, most-specific-scope-first (course > program > faculty >
 * university, via processFactsForUnit's existing SCOPE_PRIORITY cascade).
 *
 * `effective: 'blocked'` for a `conditional` stance means "not usable
 * without an explicit unlock" — resolveCapability itself never grants that
 * unlock (this module stays stateless); callers apply a self-reported
 * mentor-approval acknowledgment on top when `condition.mentorApproval` is
 * true, and must never treat any other conditional case as unlockable.
 */
export function resolveCapability(
  pack: ProcessFactPack | null,
  unitId: string,
  capability: AiCapabilityId,
  now: Date = new Date(),
): ResolvedCapability {
  for (const fact of processFactsForUnit(pack, unitId)) {
    const answer = fact.aiCapabilities?.[capability] ?? deriveFromStance(fact.aiPolicy, capability)
    if (!answer) continue
    // A unit ID alone cannot establish the student's program/course. Until
    // that applicability contract is supplied, narrower facts cannot unlock
    // a capability or supply a self-reported mentor-approval escape hatch.
    if (!hasVerifiedEvidence(fact, now) || fact.scope === 'course' || fact.scope === 'program') {
      return { capability, stance: 'unspecified', effective: 'blocked', sourceFactId: fact.id, sourceStatus: 'unverified' }
    }
    return {
      capability,
      stance: answer.stance,
      condition: answer.condition,
      effective: answer.stance === 'allowed' ? 'allowed' : 'blocked',
      sourceFactId: fact.id,
      sourceStatus: fact.status,
      sourceVerifiedDate: fact.verifiedDate,
    }
  }
  return { capability, stance: 'unspecified', effective: DEFAULT_WHEN_UNSPECIFIED[capability] }
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
  if (!pack || !unitId || !Array.isArray(pack.entries)) return []
  return pack.entries
    .filter((f) => f && f.unitId === unitId && !f.supersededBy && Object.hasOwn(SCOPE_PRIORITY, f.scope))
    .sort((a, b) => SCOPE_PRIORITY[a.scope] - SCOPE_PRIORITY[b.scope])
}

/** The single most-specific applicable fact, if any — for compact badge UI. */
export function primaryProcessFactForUnit(pack: ProcessFactPack | null, unitId: string): ProcessFact | null {
  const fact = processFactsForUnit(pack, unitId)[0]
  if (!fact) return null
  return hasVerifiedEvidence(fact, new Date()) ? fact : { ...fact, status: 'unverified' }
}
