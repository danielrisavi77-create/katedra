import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { createManuscript } from './model'
import { createManuscriptStore } from './storage'

describe('IndexedDB manuscript store', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('katedra-manuscripts-test')
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  })

  it('persists and restores a manuscript by project id', async () => {
    const store = createManuscriptStore({ databaseName: 'katedra-manuscripts-test' })
    const manuscript = createManuscript({
      projectId: 'project-1',
      title: 'Testni rad',
      workType: 's',
      now: '2026-08-13T12:00:00.000Z',
    })

    await store.save(manuscript)

    expect(await store.load('project-1')).toEqual(manuscript)
    store.close()
  })

  it('ignores malformed stored data instead of returning it to the workspace', async () => {
    const store = createManuscriptStore({ databaseName: 'katedra-manuscripts-test' })
    const manuscript = createManuscript({ projectId: 'project-1', workType: 's' })
    await store.save({ ...manuscript, sections: null as never })

    const loaded = await store.load('project-1')
    store.close()
    expect(loaded).toBeNull()
  })

  it('keeps only the newest twenty snapshots per project', async () => {
    const store = createManuscriptStore({ databaseName: 'katedra-manuscripts-test' })
    const manuscript = createManuscript({
      projectId: 'project-1',
      title: 'Testni rad',
      workType: 's',
      now: '2026-08-13T12:00:00.000Z',
    })

    for (let index = 0; index < 22; index += 1) {
      await store.snapshot({
        ...manuscript,
        updatedAt: `2026-08-13T12:00:${String(index).padStart(2, '0')}.000Z`,
      }, `snapshot-${index}`)
    }

    const snapshots = await store.listSnapshots('project-1')
    expect(snapshots).toHaveLength(20)
    expect(snapshots[0].reason).toBe('snapshot-21')
    expect(snapshots.at(-1)?.reason).toBe('snapshot-2')
    store.close()
  })
})
