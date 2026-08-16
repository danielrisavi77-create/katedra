// Lekta × Katedra shared ecosystem contracts v0.1
//
// MIRROR of the canonical cross-product contract maintained in Lekta at
// src/integration/academic-suite-contracts.ts while the apps remain separate repos.
// Breaking semantic changes require a contract version bump and synchronized update.

export const ACADEMIC_SUITE_CONTRACT_VERSION = '0.1' as const;

export type AcademicSuiteContractVersion = typeof ACADEMIC_SUITE_CONTRACT_VERSION;

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * Canonical account identity. Email is deliberately not part of the identity
 * contract because it is mutable metadata.
 */
export interface SharedUserRef {
  userId: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Academic work taxonomy
// ---------------------------------------------------------------------------

/** Semantic transport/persistence vocabulary shared by both products. */
export type AcademicWorkType =
  | 'seminar'
  | 'final'
  | 'graduate'
  | 'specialist'
  | 'doctoral'
  | 'article'
  | 'project';

/** Legacy Katedra UI/storage code. Never use this in new cross-product payloads. */
export type LegacyKatedraWorkType = 's' | 'z' | 'd';

export const KATEDRA_LEGACY_WORK_TYPE_TO_CANONICAL = {
  s: 'seminar',
  z: 'final',
  d: 'graduate',
} as const satisfies Record<LegacyKatedraWorkType, AcademicWorkType>;

export function fromLegacyKatedraWorkType(value: LegacyKatedraWorkType): AcademicWorkType {
  return KATEDRA_LEGACY_WORK_TYPE_TO_CANONICAL[value];
}

/**
 * Reverse mapping exists only for the legacy Katedra v1 UI. `null` means the
 * canonical type is valid ecosystem-wide but not supported by that legacy UI.
 */
export function toLegacyKatedraWorkType(value: AcademicWorkType): LegacyKatedraWorkType | null {
  if (value === 'seminar') return 's';
  if (value === 'final') return 'z';
  if (value === 'graduate') return 'd';
  return null;
}

export function isAcademicWorkType(value: unknown): value is AcademicWorkType {
  return (
    value === 'seminar' ||
    value === 'final' ||
    value === 'graduate' ||
    value === 'specialist' ||
    value === 'doctoral' ||
    value === 'article' ||
    value === 'project'
  );
}

export type ProjectStage =
  | 'topic'
  | 'research'
  | 'plan'
  | 'writing'
  | 'mentor-review'
  | 'katedra-review'
  | 'lekta-preflight'
  | 'revision'
  | 'submission'
  | 'defense'
  | 'completed';

// ---------------------------------------------------------------------------
// One academic work = one canonical ecosystem project
// ---------------------------------------------------------------------------

export interface ProjectManifest {
  schemaVersion: AcademicSuiteContractVersion;

  /**
   * Canonical opaque ecosystem project ID. New server-backed projects should
   * use a UUID. Consumers must never infer meaning from its formatting.
   */
  projectId: string;

  /**
   * Temporary migration alias for Katedra's current client-generated `k...`
   * project ID. Do not use as the long-term cross-product identity.
   */
  legacyClientProjectId?: string;

  /** Optional because Katedra supports guest-first project creation. */
  ownerUserId?: string;

  title?: string;
  topic?: string;
  institutionId?: string;
  unitId: string;
  programId?: string;
  profileId?: string;
  workType: AcademicWorkType;
  academicYear?: string;
  mentorName?: string;
  deadline?: string; // ISO date (YYYY-MM-DD)
  stage: ProjectStage;
  rulesetId?: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// ---------------------------------------------------------------------------
// Academic Core projection
// ---------------------------------------------------------------------------

export type SharedProfileStatus = 'verified' | 'partial' | 'research' | 'generic';

/**
 * A stable reference to the exact academic rules projection selected by the
 * project. Rich authoring/provenance data remains owned by Lekta.
 */
export interface AcademicRuleSetRef {
  schemaVersion: AcademicSuiteContractVersion;
  rulesetId: string;
  profileId: string;
  institutionId?: string;
  unitId: string;
  programId?: string;
  workType: AcademicWorkType;
  academicYear?: string;
  profileStatus: SharedProfileStatus;
  verifiedAt?: string;
  ruleAuthority?: string;
  sourceVersion?: string;
}

/** Read-only coach projection of one Lekta-authored rule for Katedra. */
export interface SharedAcademicRule {
  ruleId: string;
  checkId?: string | null;
  category?: string;
  label?: string;
  value: unknown;
  authority?: string;
  sourceId?: string | null;
  sourcePage?: string | null;
  status?: string;
  lastVerified?: string | null;
  academicYear?: string | null;
  machineCheckable?: boolean;
  autoFixable?: boolean;
  fixerId?: string | null;
}

export interface AcademicRuleSetExport {
  schemaVersion: AcademicSuiteContractVersion;
  sourceProduct: 'lekta';
  sourceVersion: string;
  generatedAt: string;
  ref: AcademicRuleSetRef;
  rules: SharedAcademicRule[];
}

// ---------------------------------------------------------------------------
// Lekta result transport
// ---------------------------------------------------------------------------

/** Canonical Lekta transport severity. */
export type LektaIssueSeverity = 'error' | 'warning' | 'info';

/** Presentation-only vocabulary Katedra may use in its coaching UI. */
export type KatedraDisplaySeverity = 'critical' | 'warning' | 'info';

export function toKatedraDisplaySeverity(severity: LektaIssueSeverity): KatedraDisplaySeverity {
  return severity === 'error' ? 'critical' : severity;
}

/**
 * Normalizes legacy/defensive external values without changing the canonical
 * transport vocabulary. New Lekta payloads should emit only error/warning/info.
 */
export function normalizeLektaIssueSeverity(value: unknown): LektaIssueSeverity {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'error' || normalized === 'critical') return 'error';
  if (normalized === 'warning' || normalized === 'major') return 'warning';
  return 'info';
}

export type IssueResolutionStatus =
  | 'OPEN'
  | 'USER_CHANGED'
  | 'RECHECK_REQUIRED'
  | 'VERIFIED_FIXED';

/** Katedra may additionally let a user defer an item without resolving it. */
export type KatedraIssueWorkflowStatus = IssueResolutionStatus | 'SKIPPED';

export interface LektaIssueLocation {
  section?: string;
  paragraphIndex?: number;
  pageHint?: string;
  elementId?: string;
}

export interface LektaIssueRef {
  /**
   * Stable logical key used to reconcile the same class/location of finding
   * across re-checks. It must not be an array index in new payloads.
   */
  issueKey: string;

  /** Unique occurrence within one analysis, when available. */
  issueInstanceId?: string;

  checkId?: string | null;
  ruleId?: string | null;
  category: string;
  severity: LektaIssueSeverity;
  summary: string;
  detail?: string;
  location?: LektaIssueLocation;
  fixable: boolean;
  fixerId?: string | null;
  status: IssueResolutionStatus;
}

export interface SharedCategoryScore {
  category: string;
  earned: number;
  max: number;
}

export interface LektaResult {
  schemaVersion: AcademicSuiteContractVersion;
  analysisId: string;
  projectId?: string;
  userId?: string;
  rulesetId: string;
  profileId?: string;
  score: number;
  scoreLabel?: string;
  profileStatus?: string;
  categoryScores: SharedCategoryScore[];
  issues: LektaIssueRef[];
  analyzedAt: string;
  documentFingerprint?: string;
  coverageTier?: number;
}

// ---------------------------------------------------------------------------
// Commerce: access rights are separate from Katedra AI-cost accounting
//
// IMPORTANT (verified 2026-08 directly against the Lekta repo): this
// Entitlement/EntitlementScope/PASS_CAPABILITIES shape mirrors
// src/integration/academic-suite-contracts.ts on the Lekta side faithfully
// — but it is a DESIGNED FUTURE CONTRACT, not the live `entitlements` SQL
// table. The actual deployed schema (Lekta supabase/migrations/0001, 0002,
// 0035) still has the pre-Academic-Suite commerce shape: user_id, work_type,
// slots_total, status, order_id, provider, purchase_expires_at, product_id,
// academic_project_id — no scope/capabilities/sourceProductId columns exist
// in the database. Writing an insert shaped like this interface directly
// against `entitlements` will fail (NOT NULL violations on the real
// required columns, unknown-column errors on scope/capabilities). Until a
// coordinated Lekta-side migration actually adds these columns, code that
// grants entitlements (e.g. app/api/webhook/route.js) must target the real
// column list, not this interface. Treat this file as the target shape to
// migrate TOWARD, not as documentation of what exists today.
// ---------------------------------------------------------------------------

export type EntitlementScope =
  | 'lekta-check'
  | 'lekta-fix'
  | 'katedra-pro'
  | 'academic-pass'
  | 'academic-pass-plus';

export type EntitlementStatus = 'active' | 'consumed' | 'expired' | 'revoked' | 'refunded';

export interface Entitlement {
  schemaVersion: AcademicSuiteContractVersion;
  entitlementId: string;
  userId: string;
  projectId?: string;
  scope: EntitlementScope;
  capabilities: string[];
  validFrom: string;
  validUntil?: string;
  usageLimit?: number;
  usageCount?: number;
  status: EntitlementStatus;
  sourceProductId: string;
}

export const PASS_CAPABILITIES = {
  academicPass: [
    'katedra.review.full',
    'katedra.ai-ledger',
    'lekta.report.full',
    'lekta.recheck',
    'lekta.final-preflight',
  ],
  academicPassPlus: [
    'katedra.review.full',
    'katedra.ai-ledger',
    'lekta.report.full',
    'lekta.recheck',
    'lekta.final-preflight',
    'lekta.fix',
  ],
} as const;

// ---------------------------------------------------------------------------
// Katedra-owned workflow metadata
// ---------------------------------------------------------------------------

export interface KatedraProjectState {
  schemaVersion: AcademicSuiteContractVersion;
  projectId: string;
  progressPercent: number;
  completedMilestones: string[];
  activeMilestone?: string;
  lastReviewAt?: string;
  latestLektaAnalysisId?: string;
  updatedAt: string;
}

// Faza 4 MVP: this shape is NOT yet backed by any Supabase table — no code
// writes AIUsageLedgerEntry records anywhere. The current local proxy is
// app/pisi/components/workspace-client.tsx's local process entries, rendered
// as local manuscript activity rather than a shared backend log.
// That proxy is intentionally simpler than this interface: no entryId/userId/
// projectId/aiContribution/userContribution/userApproved, and it lives only
// in localStorage — the same privacy posture as PRODUCT_CONSTITUTION.md's
// mentor-comments rule (see MentorTaskSyncCandidate above). Per-call
// model/token usage IS already recorded server-side today, but as billing
// data (katedra_usage via the katedra_consume RPC, keyed to auth.users.id),
// not as this Katedra-stage-aware ledger shape. Promoting the local proxy to
// a real cross-device AIUsageLedgerEntry table keyed to academic_projects.id
// would need the same Lekta-repo migration process as MentorTaskSyncCandidate
// — it is not implied by this interface existing.
export interface AIUsageLedgerEntry {
  entryId: string;
  projectId: string;
  userId?: string;
  occurredAt: string;
  stage: ProjectStage;
  tool?: string;
  model?: string;
  purpose: string;
  aiContribution: string;
  userContribution?: string;
  userReviewed: boolean;
  userApproved?: boolean;
}

// ---------------------------------------------------------------------------
// Mentor feedback loop — LOCAL-ONLY today (Faza 3 MVP)
// ---------------------------------------------------------------------------
// Mentor comments are typed by the student in Katedra's UI and tracked as
// discrete tasks in the /pisi project drawer, persisted only in localStorage.
// They deliberately do NOT flow through the state sync path/
// /api/state: PRODUCT_CONSTITUTION.md's privacy rule explicitly bans "mentor
// comments" from the shared backend, alongside raw .docx and document body
// text.
//
// This interface is NOT an active contract — no table backs it, and nothing
// reads or writes it today. It exists only as a placeholder for a future,
// separate founder decision: IF cross-device sync of mentor tasks is ever
// approved, only a sanitized record (status/phase/timestamp — never the
// verbatim comment) could be considered, and the authoritative migration
// would still have to be designed cross-product and land in the Lekta repo
// first (CLAUDE.md database authority rule), not as Katedra-side DDL.
export interface MentorTaskSyncCandidate {
  taskId: string;
  projectId: string;
  stage?: ProjectStage;
  status: 'open' | 'done';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Shared analytics semantics
// ---------------------------------------------------------------------------

export type AcademicSuiteApp = 'lekta' | 'katedra';

export type AcademicSuiteEventName =
  | 'project_created'
  | 'katedra_plan_completed'
  | 'draft_marked_ready'
  | 'lekta_check_started'
  | 'lekta_check_completed'
  | 'lekta_result_handoff_to_katedra'
  | 'resolution_plan_started'
  | 'resolution_item_marked_changed'
  | 'lekta_recheck_completed'
  | 'submission_preflight_completed'
  | 'defense_stage_started'
  | 'paywall_shown'
  | 'pass_purchase_started'
  | 'purchase_completed';

export interface SharedAnalyticsEvent<T = Record<string, unknown>> {
  eventName: AcademicSuiteEventName;
  occurredAt: string;
  anonymousId?: string;
  userId?: string;
  projectId?: string;
  app: AcademicSuiteApp;
  properties: T;
}
