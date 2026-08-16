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

  if (!result || typeof result !== 'object') {
    return { ok: false, error: 'Canonical lock RPC nije vratio valjani odgovor.' }
  }
  if (result.error) return { ok: false, error: result.error.message || 'Zaključavanje projekta nije uspjelo.' }
  if (!result.data) return { ok: false, error: 'Zaključavanje projekta nije vratilo zapis.' }
  if (Array.isArray(result.data) && result.data.length !== 1) {
    return { ok: false, error: 'Canonical lock RPC nije vratio točno jedan zapis.' }
  }

  const row = Array.isArray(result.data) ? result.data[0] : result.data
  const canonical = parseCanonicalProjectLockRow(row)
  if (!canonical) return { ok: false, error: 'Canonical lock odgovor je nepotpun ili neispravan.' }

  if (
    canonical.lock.userId !== input.userId
    || canonical.lock.projectId !== input.projectId
    || canonical.lock.topic !== input.topic
    || normalizeWorkType(canonical.lock.workType) !== normalizeWorkType(input.workType)
    || canonical.lock.productKey !== input.productKey
    || canonical.lock.paymentId !== input.paymentId
  ) {
    return { ok: false, error: 'Canonical lock odgovor ne odgovara naplaćenom projektu.' }
  }

  return { ok: true, lock: canonical.lock, lockId: canonical.lockId }
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

  if (!result || typeof result !== 'object') {
    return { ok: false, error: 'Canonical lock read nije vratio valjani odgovor.' }
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'data') || !Object.prototype.hasOwnProperty.call(result, 'error')) {
    return { ok: false, error: 'Canonical lock read envelope je nepotpun.' }
  }
  if (result.error) return { ok: false, error: result.error.message || 'Čitanje zaključavanja projekta nije uspjelo.' }
  if (result.data === null) return { ok: true, lock: null }
  if (result.data === undefined) return { ok: false, error: 'Canonical lock read nije vratio podatke.' }

  const canonical = parseCanonicalProjectLockRow(result.data)
  if (!canonical) return { ok: false, error: 'Spremljeni canonical lock zapis je nepotpun ili neispravan.' }
  if (canonical.lock.userId !== input.userId || canonical.lock.projectId !== input.projectId) {
    return { ok: false, error: 'Spremljeni canonical lock zapis ne odgovara traženom projektu.' }
  }
  return { ok: true, lock: canonical.lock }
}

function parseCanonicalProjectLockRow(row: unknown): { lock: ProjectLockSnapshot; lockId: string } | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null

  const record = row as Record<string, unknown>
  const lockId = readNonEmptyText(record.lock_id ?? record.lockId)
  const userId = readNonEmptyText(record.user_id ?? record.userId)
  const projectId = readNonEmptyText(record.project_id ?? record.projectId)
  const topic = readNonEmptyText(record.topic)
  const workType = readNonEmptyText(record.work_type ?? record.workType)
  const productKey = readNonEmptyText(record.product_key ?? record.productKey)
  const paymentId = readNonEmptyText(record.payment_id ?? record.paymentId)
  const lockedAt = readNonEmptyText(record.locked_at ?? record.lockedAt)

  if (!lockId || !userId || !projectId || !topic || !workType || !productKey || !paymentId || !lockedAt) return null
  if (record.status != null && record.status !== 'locked') return null
  if (!isLockedWorkType(workType) || normalizeWorkType(productKey) !== normalizeWorkType(workType)) return null

  return {
    lock: {
      userId,
      projectId,
      topic,
      workType: workType as LockedWorkType,
      productKey,
      paymentId,
      lockedAt,
      status: 'locked',
    },
    lockId,
  }
}

function isLockedWorkType(value: string): value is LockedWorkType {
  return value === 'seminarski' || value === 'zavrsni' || value === 'diplomski'
}

function readNonEmptyText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function lockedProjectError(): { ok: false; status: 409; error: string } {
  return {
    ok: false,
    status: 409,
    error: 'Tema je zaključana nakon naplate. Za novu temu potreban je novi projekt i Pass.',
  }
}
