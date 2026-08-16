export type WorkflowPassStatus = 'idle' | 'checking' | 'active' | 'admin' | 'needed' | 'error'

/**
 * Agent runs are a canonical paid workflow. An admin override can unlock
 * support-only/manual capabilities, but it must never impersonate a Stripe
 * entitlement in the client or create a path around the Lekta contract.
 */
export function hasCanonicalAgenticPass(status: WorkflowPassStatus): boolean {
  return status === 'active'
}
