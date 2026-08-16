import {
  fromLegacyKatedraWorkType,
  toKatedraDisplaySeverity,
  toLegacyKatedraWorkType,
  type AcademicWorkType,
  type KatedraDisplaySeverity,
  type LektaResult,
  type LegacyKatedraWorkType,
  type ProjectManifest,
} from './contracts';

/** Existing Katedra issue queue shape used by the vanilla engine. */
export interface LegacyKatedraLektaIssue {
  id: string;
  ruleId: string;
  severity: KatedraDisplaySeverity;
  category: string;
  fixable: boolean;
  label: string;
  status: 'OPEN';
}

/**
 * Converts the canonical shared result into the current Katedra coach queue
 * without changing Lekta transport semantics. `error -> critical` is UI-only.
 */
export function toLegacyKatedraIssueQueue(result: LektaResult): LegacyKatedraLektaIssue[] {
  return result.issues.map((issue) => ({
    id: issue.issueKey,
    ruleId: issue.ruleId ?? '',
    severity: toKatedraDisplaySeverity(issue.severity),
    category: issue.category,
    fixable: issue.fixable,
    label: issue.summary,
    status: 'OPEN',
  }));
}

export interface LegacyKatedraManifestInput {
  projectId: string;
  ownerUserId?: string;
  unitId: string;
  profileId?: string;
  workType: LegacyKatedraWorkType;
  topic?: string;
  deadline?: string;
  rulesetId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Bridge from Katedra's current `s/z/d` manifest into the ecosystem contract.
 * Existing `k...` IDs can be carried as `legacyClientProjectId` while a later
 * additive migration introduces the canonical guest-safe project ID.
 */
export function legacyManifestToProjectManifest(input: LegacyKatedraManifestInput): ProjectManifest {
  const looksLegacy = input.projectId.startsWith('k');
  return {
    schemaVersion: '0.1',
    projectId: input.projectId,
    legacyClientProjectId: looksLegacy ? input.projectId : undefined,
    ownerUserId: input.ownerUserId,
    unitId: input.unitId,
    profileId: input.profileId,
    workType: fromLegacyKatedraWorkType(input.workType),
    topic: input.topic,
    deadline: input.deadline,
    stage: 'writing',
    rulesetId: input.rulesetId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

/**
 * Explicit compatibility gate for old Katedra UI. Returning null forces the UI
 * to reject/fallback rather than silently mapping unsupported canonical types.
 */
export function canonicalWorkTypeForLegacyUi(value: AcademicWorkType): LegacyKatedraWorkType | null {
  return toLegacyKatedraWorkType(value);
}
