import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { createEmptyResearchPlan } from './validation'
import { createResearchPlanStore } from './storage'

const databaseName = 'katedra-research-plans-test'

describe('research plan local storage', () => {
  beforeEach(async () => {
    const request = indexedDB.deleteDatabase(databaseName)
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => resolve()
    })
  })

  it('saves and loads a plan by canonical project id', async () => {
    const store = createResearchPlanStore({ databaseName })
    const plan = createEmptyResearchPlan('project-1', '2026-08-22T10:00:00.000Z')

    await store.save(plan)

    expect(await store.load('project-1')).toEqual(plan)
    expect(await store.load('project-2')).toBeNull()
    store.close()
  })

  it('keeps at most 20 snapshots for one project', async () => {
    const store = createResearchPlanStore({ databaseName })
    const plan = createEmptyResearchPlan('project-1', '2026-08-22T10:00:00.000Z')

    for (let index = 0; index < 22; index += 1) {
      await store.snapshot({ ...plan, revision: `${index}`, updatedAt: `2026-08-22T10:${String(index).padStart(2, '0')}:00.000Z` }, `snapshot-${index}`)
    }

    const snapshots = await store.listSnapshots('project-1')
    expect(snapshots).toHaveLength(20)
    expect(snapshots.map((snapshot) => snapshot.reason)).not.toContain('snapshot-0')
    expect(snapshots.map((snapshot) => snapshot.reason)).not.toContain('snapshot-1')
    store.close()
  })

  it('does not restore a snapshot into another project', async () => {
    const store = createResearchPlanStore({ databaseName })
    const plan = createEmptyResearchPlan('project-1', '2026-08-22T10:00:00.000Z')
    await store.snapshot(plan, 'before-edit')
    const snapshot = (await store.listSnapshots('project-1'))[0]

    await expect(store.restore(snapshot.id, 'project-2')).rejects.toThrow('ne pripada ovom projektu')
    store.close()
  })
})
