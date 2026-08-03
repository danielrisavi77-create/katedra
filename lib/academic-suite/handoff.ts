import type { LektaResult } from './contracts'
import { prepareManifestForIncomingLektaResult } from './reconciliation'

const BOOTSTRAP_DIAGNOSTIC_SLOT = 'katedra.lekta-bootstrap.v0.1'

function diagnostic(stage: string, detail?: string): void {
  if (typeof sessionStorage === 'undefined') return
  try { sessionStorage.setItem(BOOTSTRAP_DIAGNOSTIC_SLOT, JSON.stringify({ stage, detail: detail || '' })) } catch {}
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, ch => ch.charCodeAt(0))
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Decode a fragment value without relying on the legacy escape/decodeURIComponent
 * UTF-8 trick. URL fragments may arrive percent-encoded or already decoded,
 * depending on how the browser/navigation constructed the URL, so try both.
 */
function decodeUtf8Base64(value: string): unknown {
  const candidates = [value]
  try {
    const decoded = decodeURIComponent(value)
    if (decoded !== value) candidates.unshift(decoded)
  } catch {}

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      const json = new TextDecoder().decode(base64ToBytes(candidate))
      return JSON.parse(json)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('Unreadable Lekta handoff')
}

function encodeUtf8Base64(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return encodeURIComponent(bytesToBase64(bytes))
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
 * Existing legacy #lekta= links are left untouched. Shared v0.1 links first
 * reconcile the previous stable finding set, then are rewritten to the legacy
 * internal shape so the current engine can consume them without a large edit.
 */
export function normalizeLektaHandoffHashForLegacyEngine(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash || ''
  if (!hash.startsWith('#lekta=')) {
    diagnostic('no-lekta-hash', hash.slice(0, 40))
    return false
  }

  diagnostic('hash-detected', hash.slice(0, 32))
  try {
    const decoded = decodeUtf8Base64(hash.slice('#lekta='.length))
    diagnostic('decoded', String((decoded as any)?.schemaVersion || 'no-schema'))
    if (!isSharedLektaResult(decoded)) {
      diagnostic('legacy-or-invalid', JSON.stringify({
        schemaVersion: (decoded as any)?.schemaVersion,
        analysisId: typeof (decoded as any)?.analysisId,
        rulesetId: typeof (decoded as any)?.rulesetId,
        score: typeof (decoded as any)?.score,
        issues: Array.isArray((decoded as any)?.issues),
      }))
      return false
    }

    prepareManifestForIncomingLektaResult(decoded)
    diagnostic('reconciled', decoded.analysisId)

    const legacy = sharedLektaResultToLegacyPayload(decoded)
    window.location.hash = `#lekta=${encodeUtf8Base64(legacy)}`
    diagnostic('normalized', decoded.analysisId)
    return true
  } catch (error) {
    diagnostic('error', error instanceof Error ? error.message : String(error))
    // Let the existing engine show its established unreadable-link message.
    return false
  }
}
