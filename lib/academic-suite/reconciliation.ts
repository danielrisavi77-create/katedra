import type { KatedraIssueWorkflowStatus, LektaResult } from './contracts'

const MANIFEST_STORAGE_SLOT = 'rp_manifest'

export interface LegacyManifestIssue {
  id: string
  ruleId?: string
  checkId?: string
  severity?: string
  category?: string
  fixable?: boolean
  fixerId?: string
  label?: string
  status?: KatedraIssueWorkflowStatus
}

export interface FindingIdentitySidecar {
  checkId?: string
  ruleId?: string
}

export interface VerifiedFixedRecord {
  issueId: string
  ruleId?: string
  checkId?: string
  label?: string
  status: 'VERIFIED_FIXED'
  verifiedAt: string
  analysisId: string
}

export interface LegacyManifest {
  v?: number
  projectId?: string
  lektaIssues?: LegacyManifestIssue[]
  lektaFixedTotal?: number
  lektaIdentityIndex?: Record<string, FindingIdentitySidecar>
  lektaResolutionHistory?: VerifiedFixedRecord[]
  [key: string]: unknown
}

export function mergeLektaResultIntoManifest(manifest: LegacyManifest, result: LektaResult): LegacyManifest {
  if (manifest.projectId && result.projectId && manifest.projectId !== result.projectId) {
    throw new Error('Lekta rezultat pripada drugom projektu.')
  }

  const previousIdentity = manifest.lektaIdentityIndex || {}
  const { verifiedFixed } = reconcileRecheck(manifest.lektaIssues || [], result)
  const enrichedFixed = verifiedFixed.map(item => ({
    ...item,
    checkId: item.checkId || previousIdentity[item.issueId]?.checkId || undefined,
    ruleId: item.ruleId || previousIdentity[item.issueId]?.ruleId || undefined,
  }))
  const existingHistory = Array.isArray(manifest.lektaResolutionHistory) ? manifest.lektaResolutionHistory : []
  const seen = new Set(existingHistory.map(item => `${item.analysisId}:${item.issueId}`))
  const additions = enrichedFixed.filter(item => !seen.has(`${item.analysisId}:${item.issueId}`))

  return {
    ...manifest,
    profileId: result.profileId || manifest.profileId,
    lektaAnalysisId: result.analysisId,
    lektaRulesetId: result.rulesetId,
    lektaScore: result.score,
    lektaCheckedAt: result.analyzedAt,
    lektaIssues: result.issues.map(issue => ({
      id: issue.issueKey,
      ruleId: issue.ruleId || undefined,
      checkId: issue.checkId || undefined,
      severity: issue.severity,
      category: issue.category,
      fixable: issue.fixable,
      fixerId: issue.fixerId || undefined,
      label: issue.summary,
      status: issue.status,
    })),
    lektaIdentityIndex: Object.fromEntries(result.issues.map(issue => [
      issue.issueKey,
      { checkId: issue.checkId || undefined, ruleId: issue.ruleId || undefined },
    ])),
    lektaResolutionHistory: [...existingHistory, ...additions].slice(-250),
    lektaFixedTotal: Number(manifest.lektaFixedTotal || 0) + additions.length,
  }
}

function readManifest(): LegacyManifest | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const parsed = JSON.parse(localStorage.getItem(MANIFEST_STORAGE_SLOT) || 'null')
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeManifest(manifest: LegacyManifest): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(MANIFEST_STORAGE_SLOT, JSON.stringify(manifest)) } catch {}
}

export function isStableFindingId(id: string): boolean {
  return id.startsWith('rule:') || id.startsWith('check:')
}

/**
 * Pure reconciliation used before the legacy engine consumes a new Lekta result.
 * Only a user-changed/recheck-required finding with the NEW stable identity is
 * eligible for VERIFIED_FIXED. Legacy hashes are intentionally excluded so the
 * identity migration can never manufacture false confirmations.
 */
export function reconcileRecheck(
  previous: LegacyManifestIssue[] = [],
  incoming: LektaResult,
): { enginePrevious: LegacyManifestIssue[]; verifiedFixed: VerifiedFixedRecord[] } {
  const incomingIds = new Set(incoming.issues.map(issue => issue.issueKey))
  const verificationCandidates = previous.filter(issue =>
    isStableFindingId(String(issue.id || '')) &&
    (issue.status === 'USER_CHANGED' || issue.status === 'RECHECK_REQUIRED'),
  )

  const verifiedFixed = verificationCandidates
    .filter(issue => !incomingIds.has(issue.id))
    .map(issue => ({
      issueId: issue.id,
      ruleId: issue.ruleId || undefined,
      checkId: issue.checkId || undefined,
      label: issue.label || undefined,
      status: 'VERIFIED_FIXED' as const,
      verifiedAt: incoming.analyzedAt,
      analysisId: incoming.analysisId,
    }))

  // The legacy engine computes its "fixed" count as prevIds - newIds. Feeding
  // only valid verification candidates makes that existing calculation correct.
  return { enginePrevious: verificationCandidates, verifiedFixed }
}

/**
 * Called BEFORE initKatedraEngine(). It narrows the legacy engine's comparison
 * set to genuine verification candidates and appends an auditable local history.
 */
export function prepareManifestForIncomingLektaResult(result: LektaResult): number {
  const manifest = readManifest()
  if (!manifest) return 0
  try {
    const previousHistoryCount = manifest.lektaResolutionHistory?.length || 0
    const merged = mergeLektaResultIntoManifest(manifest, result)
    writeManifest(merged)
    return Math.max(0, (merged.lektaResolutionHistory?.length || 0) - previousHistoryCount)
  } catch {
    return 0
  }
}

/** USER_CHANGED means "I edited it"; opening a new Lekta check advances it to RECHECK_REQUIRED. */
export function markUserChangesRecheckRequired(): number {
  const manifest = readManifest()
  if (!manifest || !Array.isArray(manifest.lektaIssues)) return 0
  let changed = 0
  manifest.lektaIssues = manifest.lektaIssues.map(issue => {
    if (issue.status !== 'USER_CHANGED') return issue
    changed += 1
    return { ...issue, status: 'RECHECK_REQUIRED' }
  })
  if (changed) writeManifest(manifest)
  return changed
}

/**
 * Installs a capture-phase click listener after the legacy engine boots. Any
 * outbound Lekta URL carrying THIS projectId becomes the explicit transition
 * USER_CHANGED -> RECHECK_REQUIRED immediately before navigation.
 */
export function installLektaRecheckLifecycle(): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {}

  const handler = (event: Event) => {
    const target = event.target as Element | null
    const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!anchor) return
    const manifest = readManifest()
    const projectId = String(manifest?.projectId || '')
    if (!projectId) return

    try {
      const url = new URL(anchor.href, window.location.href)
      const looksLikeLekta = url.hostname.toLowerCase().includes('lekta') ||
        (url.searchParams.has('unit') && (url.searchParams.has('work') || url.searchParams.has('workType')))
      if (!looksLikeLekta || url.searchParams.get('project') !== projectId) return
      markUserChangesRecheckRequired()
    } catch {}
  }

  document.addEventListener('click', handler, true)
  return () => document.removeEventListener('click', handler, true)
}
