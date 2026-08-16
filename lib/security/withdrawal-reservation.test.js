import { afterEach, describe, expect, it, vi } from 'vitest'

import { reserveDistributedWithdrawal } from './withdrawal-reservation'

afterEach(() => vi.restoreAllMocks())

describe('reserveDistributedWithdrawal', () => {
  it('maps a durable reservation to idempotent commit and release handles', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { status: 'reserved' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'committed' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'released' }, error: null })
    const db = { rpc }

    const reservation = await reserveDistributedWithdrawal(db, {
      userId: 'user-1',
      referenceId: 'withdrawal-1',
    })

    expect(reservation).toMatchObject({ allowed: true })
    await reservation.commit('row-1')
    await reservation.commit('row-1')
    expect(rpc).toHaveBeenNthCalledWith(1, 'katedra_reserve_withdrawal', {
      p_user: 'user-1',
      p_reference_id: 'withdrawal-1',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'katedra_commit_withdrawal', {
      p_user: 'user-1',
      p_reference_id: 'withdrawal-1',
      p_request_id: 'row-1',
    })
    await reservation.release()
    await reservation.release()
    expect(rpc).toHaveBeenCalledTimes(3)
    expect(rpc).toHaveBeenNthCalledWith(3, 'katedra_release_withdrawal', {
      p_user: 'user-1',
      p_reference_id: 'withdrawal-1',
    })
  })

  it('fails closed when the durable contract is unavailable', async () => {
    const db = { rpc: vi.fn().mockRejectedValue(new Error('timeout')) }

    await expect(reserveDistributedWithdrawal(db, {
      userId: 'user-1',
      referenceId: 'withdrawal-1',
    })).resolves.toMatchObject({ allowed: false, reason: 'unavailable' })
  })

  it('preserves duplicate and rate decisions from the durable contract', async () => {
    const db = {
      rpc: vi.fn()
        .mockResolvedValueOnce({ data: { status: 'duplicate' }, error: null })
        .mockResolvedValueOnce({ data: [{ status: 'rate' }], error: null }),
    }

    await expect(reserveDistributedWithdrawal(db, { userId: 'user-1', referenceId: 'same' }))
      .resolves.toMatchObject({ allowed: false, reason: 'duplicate' })
    await expect(reserveDistributedWithdrawal(db, { userId: 'user-1', referenceId: 'other' }))
      .resolves.toMatchObject({ allowed: false, reason: 'rate' })
  })

  it('turns synchronous commit and release RPC throws into rejected promises', async () => {
    const db = {
      rpc(name) {
        if (name === 'katedra_reserve_withdrawal') return Promise.resolve({ data: { status: 'reserved' }, error: null })
        throw new Error(`${name} connection failed`)
      },
    }

    const commitReservation = await reserveDistributedWithdrawal(db, { userId: 'user-1', referenceId: 'commit-case' })
    await expect(commitReservation.commit('row-1')).rejects.toThrow('katedra_commit_withdrawal connection failed')

    const releaseReservation = await reserveDistributedWithdrawal(db, { userId: 'user-1', referenceId: 'release-case' })
    await expect(releaseReservation.release()).rejects.toThrow('katedra_release_withdrawal connection failed')
  })

  it('requires canonical release confirmation and allows a retry after a transient response', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { status: 'reserved' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { status: 'released' }, error: null })
    const reservation = await reserveDistributedWithdrawal({ rpc }, { userId: 'user-1', referenceId: 'release-retry' })

    await expect(reservation.release()).rejects.toThrow('release confirmation')
    await expect(reservation.release()).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledTimes(3)
  })
})
