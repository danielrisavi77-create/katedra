const MANIFEST_KEY = 'rp_manifest'

export interface GuestProjectBootstrapResult {
  projectId: string | null
  created: boolean
  legacy: boolean
}

function uuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'))
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
  }

  // Last-resort compatibility fallback. Consumers treat projectId as opaque;
  // this branch exists only for unusually old browsers without Web Crypto.
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Ensures a project identity exists BEFORE auth.
 *
 * Existing Katedra `k...` manifests are deliberately preserved. We do not
 * silently rewrite their ID because it is already used by localStorage,
 * server sync, and possible Lekta handoffs. New projects use UUIDs immediately.
 */
export function ensureGuestProjectIdentity(): GuestProjectBootstrapResult {
  if (typeof window === 'undefined') return { projectId: null, created: false, legacy: false }

  try {
    const raw = window.localStorage.getItem(MANIFEST_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const existing = typeof parsed?.projectId === 'string' ? parsed.projectId.trim() : ''
      if (existing) {
        return { projectId: existing, created: false, legacy: existing.startsWith('k') }
      }
    }

    const projectId = uuidV4()
    const manifest = {
      v: 1,
      projectId,
      createdAt: Date.now(),
      lektaIssues: [],
      lektaScore: null,
      lektaCheckedAt: '',
      lektaFixedTotal: 0,
    }
    window.localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest))
    return { projectId, created: true, legacy: false }
  } catch {
    // Katedra already supports localStorage failure by keeping runtime state.
    // Do not block the application merely because persistence is unavailable.
    return { projectId: null, created: false, legacy: false }
  }
}
