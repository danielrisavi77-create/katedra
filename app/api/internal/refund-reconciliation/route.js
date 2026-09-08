import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { reconcilePendingRefunds } from '@/lib/stripe/refund-worker'
import { privateJson } from '@/lib/observability/private-response.js'

export const runtime = 'nodejs'

export async function POST(req) {
  const expected = process.env.KATEDRA_AGENT_WORKER_TOKEN || ''
  const actual = req.headers.get('x-katedra-agent-worker-token') || ''
  if (!expected || !actual || Buffer.byteLength(actual) !== Buffer.byteLength(expected)
    || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return privateJson({ error: 'unauthorized' }, { status: 401 })
  if (process.env.KATEDRA_PROJECT_LOCKS_ENABLED !== 'true') return privateJson({ error: 'reconciliation_not_enabled' }, { status: 503 })
  try {
    const db = createAdminClient()
    const boundedDb = { rpc: (name, params) => db.rpc(name, params).abortSignal(AbortSignal.timeout(10_000)) }
    return privateJson(await reconcilePendingRefunds(boundedDb, getStripe()))
  } catch {
    return privateJson({ error: 'refund_reconciliation_unavailable' }, { status: 503 })
  }
}
