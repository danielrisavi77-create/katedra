import type { LektaResult } from './contracts'

function decodeUtf8Base64(value: string): unknown {
  const binary = atob(decodeURIComponent(value))
  const escaped = Array.from(binary, ch => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')
  return JSON.parse(decodeURIComponent(escaped))
}

function encodeUtf8Base64(value: unknown): string {
  const json = JSON.stringify(value)
  const encoded = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  )
  return encodeURIComponent(btoa(encoded))
}

function isSharedLektaResult(value: any): value is LektaResult {
  return Boolean(
    value &&
    value.schemaVersion === '0.1' &&
    typeof value.analysisId === 'string' &&
    typeof value.rulesetId === 'string' &&
    typeof value.score === 'number' &&
    Array.isArray(value.issues),
  )
}

/**
 * Converts shared `LektaResult v0.1` into the payload expected by today's
 * vanilla `lkParseHash/lkNorm` implementation. This is a temporary compatibility
 * seam; the shared payload remains the source contract.
 */
export function sharedLektaResultToLegacyPayload(result: LektaResult) {
  return {
    v: 1,
    schemaVersion: result.schemaVersion,
    analysisId: result.analysisId,
    projectId: result.projectId || '',
    profileId: result.profileId || '',
    rulesetVersion: result.rulesetId,
    score: result.score,
    checkedAt: result.analyzedAt,
    issues: result.issues.map(issue => ({
      issueId: issue.issueKey,
      checkId: issue.checkId || '',
      ruleId: issue.ruleId || '',
      severity: issue.severity,
      category: issue.category,
      fixable: issue.fixable,
      fixerId: issue.fixerId || '',
      label: issue.summary,
      status: issue.status,
    })),
  }
}

/**
 * Runs before `initKatedraEngine()`.
 *
 * Existing legacy #lekta= links are left untouched. Shared v0.1 links are
 * rewritten in-place to the legacy internal shape so the current engine can
 * consume them without a large risky edit.
 */
export function normalizeLektaHandoffHashForLegacyEngine(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash || ''
  if (!hash.startsWith('#lekta=')) return false

  try {
    const raw = hash.slice('#lekta='.length)
    const decoded = decodeUtf8Base64(raw)
    if (!isSharedLektaResult(decoded)) return false

    const legacy = sharedLektaResultToLegacyPayload(decoded)
    window.location.hash = `#lekta=${encodeUtf8Base64(legacy)}`
    return true
  } catch {
    // Let the existing engine show its established unreadable-link message.
    return false
  }
}
