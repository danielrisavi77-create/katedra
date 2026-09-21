import type { VerificationStatus } from './contracts'

export type RetryDecision =
  | { action: 'retry'; nextAttempt: 2 | 3 }
  | { action: 'blocked' | 'complete' | 'failed'; nextAttempt: 1 | 2 | 3 }

export function nextRetryDecision(attempt: number, status: VerificationStatus): RetryDecision {
  const current = Math.max(1, Math.min(3, Math.trunc(attempt))) as 1 | 2 | 3
  if (status === 'verified') return { action: 'complete', nextAttempt: current }
  if (status === 'failed') return { action: 'failed', nextAttempt: current }
  if (current < 3) return { action: 'retry', nextAttempt: (current + 1) as 2 | 3 }
  return { action: 'blocked', nextAttempt: current }
}
