import { logOperationalEvent } from '../observability/operational-events'

export async function authorizeProjectAiRequest(db, { userId, projectId, hasPass }) {
  if (hasPass) return { allowed: true, source: 'pass' }

  let result
  try {
    result = await db.rpc('katedra_authorize_project_ai', {
      p_user: userId,
      p_project_id: projectId,
    })
  } catch (error) {
    logOperationalEvent({ eventName: 'project_ai_authorization_failed', userId, projectId, error }, 'error')
    return { allowed: false, reason: 'unavailable' }
  }

  if (result?.error) {
    logOperationalEvent({ eventName: 'project_ai_authorization_failed', userId, projectId, error: result.error }, 'error')
    return { allowed: false, reason: 'unavailable' }
  }

  const decision = Array.isArray(result?.data) ? result.data[0] : result?.data
  if (decision?.status === 'allowed') {
    return {
      allowed: true,
      source: 'project_grant',
      ...(Number.isFinite(Number(decision.balance)) ? { balance: Number(decision.balance) } : {}),
    }
  }

  return {
    allowed: false,
    reason: typeof decision?.status === 'string' ? decision.status : 'unavailable',
    ...(Number.isFinite(Number(decision?.balance)) ? { balance: Number(decision.balance) } : {}),
  }
}
