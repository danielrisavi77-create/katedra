export type LockedWorkType = 'seminarski' | 'zavrsni' | 'diplomski'

export interface ProjectLockInput {
  userId: string
  projectId: string
  topic: string
  workType: LockedWorkType
  productKey: string
  paymentId: string
  lockedAt: string
}

export interface ProjectLockSnapshot extends ProjectLockInput {
  status: 'locked'
}

export interface ProjectMutation {
  projectId?: string
  topic?: string
  workType?: string
  deadline?: string | null
  mentor?: string | null
  institution?: string | null
  program?: string | null
}

export type ProjectLockValidation =
  | { ok: true }
  | { ok: false; status: 409; error: string }

export type ProjectLockResult =
  | { ok: true; lock: ProjectLockSnapshot; lockId?: string }
  | { ok: false; error: string }

export type ProjectLockReadResult =
  | { ok: true; lock: ProjectLockSnapshot | null }
  | { ok: false; error: string }

export function createProjectLockSnapshot(input: ProjectLockInput): ProjectLockSnapshot {
  return { ...input, status: 'locked' }
}

export function validateLockedProjectMutation(
  lock: ProjectLockSnapshot,
  mutation: ProjectMutation,
): ProjectLockValidation {
  if (mutation.projectId !== undefined && mutation.projectId !== lock.projectId) {
    return lockedProjectError()
  }
  if (mutation.topic !== undefined && mutation.topic !== lock.topic) {
    return lockedProjectError()
  }
  if (mutation.workType !== undefined && normalizeWorkType(mutation.workType) !== normalizeWorkType(lock.workType)) {
    return lockedProjectError()
  }
  return { ok: true }
}

function normalizeWorkType(value: string): string {
  if (value === 's') return 'seminarski'
  if (value === 'z') return 'zavrsni'
  if (value === 'd') return 'diplomski'
  if (value === 'seminar') return 'seminarski'
  if (value === 'final') return 'zavrsni'
  if (value === 'graduate') return 'diplomski'
  return value
}

export async function lockPaidProject(db: { rpc?: (name: string, params: Record<string, unknown>) => Promise<any> }, input: ProjectLockInput): Promise<ProjectLockResult> {
  let result
  try {
    if (typeof db.rpc !== 'function') return { ok: false, error: 'Canonical lock_paid_project RPC nije dostupan.' }
    result = await db.rpc('lock_paid_project', {
      p_user_id: input.userId,
      p_project_id: input.projectId,
      p_topic: input.topic,
      p_work_type: input.workType,
      p_product_key: input.productKey,
      p_payment_id: input.paymentId,
      p_locked_at: input.lockedAt,
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Zaključavanje projekta nije uspjelo.' }
  }

  if (result.error) return { ok: false, error: result.error.message || 'Zaključavanje projekta nije uspjelo.' }
  if (!result.data) return { ok: false, error: 'Zaključavanje projekta nije vratilo zapis.' }

  const row = Array.isArray(result.data) ? result.data[0] : result.data
  if (!row) return { ok: false, error: 'ZakljuÄŤavanje projekta nije vratilo zapis.' }
  if (typeof row !== 'object' || (!('project_id' in row) && !('projectId' in row))) {
    return { ok: true, lock: createProjectLockSnapshot(input), lockId: typeof row === 'string' ? row : String(row?.lock_id ?? row?.lockId ?? '') || undefined }
  }
  return { ok: true, lock: normalizeProjectLockRow(row), lockId: String(row.lock_id ?? row.lockId ?? '') || undefined }
}

export async function readProjectLock(
  db: { from: (table: string) => any },
  input: { userId: string; projectId: string },
): Promise<ProjectLockReadResult> {
  let result
  try {
    result = await db
      .from('katedra_project_locks')
      .select()
      .eq('user_id', input.userId)
      .eq('project_id', input.projectId)
      .maybeSingle()
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Čitanje zaključavanja projekta nije uspjelo.' }
  }

  if (result.error) return { ok: false, error: result.error.message || 'Čitanje zaključavanja projekta nije uspjelo.' }
  return { ok: true, lock: result.data ? normalizeProjectLockRow(result.data) : null }
}

function normalizeProjectLockRow(row: Record<string, unknown>): ProjectLockSnapshot {
  return {
    userId: String(row.userId ?? row.user_id ?? ''),
    projectId: String(row.projectId ?? row.project_id ?? ''),
    topic: String(row.topic ?? ''),
    workType: String(row.workType ?? row.work_type ?? '') as LockedWorkType,
    productKey: String(row.productKey ?? row.product_key ?? ''),
    paymentId: String(row.paymentId ?? row.payment_id ?? ''),
    lockedAt: String(row.lockedAt ?? row.locked_at ?? ''),
    status: 'locked',
  }
}

function lockedProjectError(): { ok: false; status: 409; error: string } {
  return {
    ok: false,
    status: 409,
    error: 'Tema je zaključana nakon naplate. Za novu temu potreban je novi projekt i Pass.',
  }
}
