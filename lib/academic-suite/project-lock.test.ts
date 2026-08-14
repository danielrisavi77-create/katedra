import { describe, expect, it, vi } from 'vitest'

import {
  createProjectLockSnapshot,
  readProjectLock,
  lockPaidProject,
  validateLockedProjectMutation,
  type ProjectLockInput,
} from './project-lock'

const baseInput: ProjectLockInput = {
  userId: 'user-1',
  projectId: 'project-1',
  topic: 'Digitalizacija javne uprave',
  workType: 'zavrsni',
  productKey: 'zavrsni',
  paymentId: 'cs_test_123',
  lockedAt: '2026-08-14T10:00:00.000Z',
}

describe('project lock', () => {
  it('creates a complete immutable snapshot for a paid project', () => {
    expect(createProjectLockSnapshot(baseInput)).toEqual({
      ...baseInput,
      status: 'locked',
    })
  })

  it('rejects topic changes after payment', () => {
    const lock = createProjectLockSnapshot(baseInput)

    expect(validateLockedProjectMutation(lock, { topic: 'Nova tema' })).toEqual({
      ok: false,
      status: 409,
      error: 'Tema je zaključana nakon naplate. Za novu temu potreban je novi projekt i Pass.',
    })
  })

  it('rejects work type and project identity changes after payment', () => {
    const lock = createProjectLockSnapshot(baseInput)

    expect(validateLockedProjectMutation(lock, { workType: 'diplomski' })).toMatchObject({ ok: false, status: 409 })
    expect(validateLockedProjectMutation(lock, { projectId: 'other-project' })).toMatchObject({ ok: false, status: 409 })
  })

  it('accepts the legacy UI code for the locked work type', () => {
    const lock = createProjectLockSnapshot(baseInput)

    expect(validateLockedProjectMutation(lock, { workType: 'z' })).toEqual({ ok: true })
  })

  it('allows mutable project metadata to be updated', () => {
    const lock = createProjectLockSnapshot(baseInput)

    expect(validateLockedProjectMutation(lock, { deadline: '2026-12-01', mentor: 'Dr. Ime Prezime' })).toEqual({ ok: true })
  })

  it('writes the paid lock through the canonical Lekta RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        lock_id: 'lock-1',
        user_id: baseInput.userId,
        project_id: baseInput.projectId,
        topic: baseInput.topic,
        work_type: baseInput.workType,
        product_key: baseInput.productKey,
        payment_id: baseInput.paymentId,
        locked_at: baseInput.lockedAt,
      }],
      error: null,
    })
    const db = { rpc }

    await expect(lockPaidProject(db, baseInput)).resolves.toMatchObject({
      ok: true,
      lock: { projectId: 'project-1', paymentId: 'cs_test_123', status: 'locked' },
      lockId: 'lock-1',
    })
    expect(rpc).toHaveBeenCalledWith('lock_paid_project', {
      p_user_id: baseInput.userId,
      p_project_id: baseInput.projectId,
      p_topic: baseInput.topic,
      p_work_type: baseInput.workType,
      p_product_key: baseInput.productKey,
      p_payment_id: baseInput.paymentId,
      p_locked_at: baseInput.lockedAt,
    })
  })

  it('fails closed when the canonical RPC returns an incomplete lock response', async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: { lock_id: 'lock-1' }, error: null }) }
    await expect(lockPaidProject(db, baseInput)).resolves.toMatchObject({
      ok: false,
    })
  })

  it('fails closed when the canonical RPC returns a non-object lock response', async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: 'lock-1', error: null }) }
    await expect(lockPaidProject(db, baseInput)).resolves.toMatchObject({ ok: false })
  })

  it('fails closed when the RPC adapter returns no response envelope', async () => {
    const db = { rpc: vi.fn().mockResolvedValue(undefined) }
    await expect(lockPaidProject(db, baseInput)).resolves.toMatchObject({ ok: false })
  })

  it('fails closed when the canonical RPC response belongs to another project', async () => {
    const db = {
      rpc: vi.fn().mockResolvedValue({
        data: { ...baseInput, lock_id: 'lock-1', project_id: 'other-project' },
        error: null,
      }),
    }
    await expect(lockPaidProject(db, baseInput)).resolves.toMatchObject({ ok: false })
  })

  it('reads the lock for the exact owned project', async () => {
    const db = {
      from(table: string) {
        expect(table).toBe('katedra_project_locks')
        const query = {
          select() { return query },
          eq() { return query },
          async maybeSingle() {
            return {
              data: {
                lock_id: 'lock-1',
                user_id: baseInput.userId,
                project_id: baseInput.projectId,
                topic: baseInput.topic,
                work_type: baseInput.workType,
                product_key: baseInput.productKey,
                payment_id: baseInput.paymentId,
                locked_at: baseInput.lockedAt,
              },
              error: null,
            }
          },
        }
        return query
      },
    }

    await expect(readProjectLock(db, { userId: 'user-1', projectId: 'project-1' })).resolves.toMatchObject({
      ok: true,
      lock: { projectId: 'project-1', status: 'locked' },
    })
  })

  it('returns an unavailable result instead of treating a storage error as unlocked', async () => {
    const db = {
      from() {
        throw new Error('lock table unavailable')
      },
    }

    await expect(readProjectLock(db, { userId: 'user-1', projectId: 'project-1' })).resolves.toMatchObject({
      ok: false,
    })
  })

  it('fails closed when the stored lock row is malformed', async () => {
    const db = {
      from() {
        const query = {
          select() { return query },
          eq() { return query },
          async maybeSingle() {
            return { data: { lock_id: 'lock-1', project_id: 'project-1' }, error: null }
          },
        }
        return query
      },
    }

    await expect(readProjectLock(db, { userId: 'user-1', projectId: 'project-1' })).resolves.toMatchObject({ ok: false })
  })

  it('fails closed when the lock read adapter returns no response envelope', async () => {
    const db = {
      from() {
        const query = {
          select() { return query },
          eq() { return query },
          async maybeSingle() { return undefined },
        }
        return query
      },
    }

    await expect(readProjectLock(db, { userId: 'user-1', projectId: 'project-1' })).resolves.toMatchObject({ ok: false })
  })

  it.each([[], {}])('fails closed for an invalid lock read envelope: %s', async (response) => {
    const db = {
      from() {
        const query = {
          select() { return query },
          eq() { return query },
          async maybeSingle() { return response },
        }
        return query
      },
    }

    await expect(readProjectLock(db, { userId: 'user-1', projectId: 'project-1' })).resolves.toMatchObject({ ok: false })
  })
})
