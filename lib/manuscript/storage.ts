import type { ManuscriptSnapshotV1, ManuscriptV1 } from './types'
import { validateStoredManuscript } from './runtime-validation'

const DB_VERSION = 1
const MANUSCRIPTS = 'manuscripts'
const SNAPSHOTS = 'snapshots'
const SNAPSHOT_LIMIT = 20

export function createManuscriptStore({ databaseName = 'katedra-manuscripts' } = {}) {
  let databasePromise: Promise<IDBDatabase> | null = null

  const database = () => {
    if (!databasePromise) databasePromise = openDatabase(databaseName)
    return databasePromise
  }

  return {
    async load(projectId: string): Promise<ManuscriptV1 | null> {
      return requestValue<ManuscriptV1 | undefined>((await database()).transaction(MANUSCRIPTS).objectStore(MANUSCRIPTS).get(projectId))
        .then((value) => value ? validateStoredManuscript(value, projectId) : null)
    },

    async save(manuscript: ManuscriptV1): Promise<void> {
      const db = await database()
      await transactionDone(db.transaction(MANUSCRIPTS, 'readwrite'), (store) => store.put(manuscript))
    },

    async snapshot(manuscript: ManuscriptV1, reason: string): Promise<void> {
      const db = await database()
      const snapshot: ManuscriptSnapshotV1 = {
        id: `${manuscript.projectId}:${manuscript.updatedAt}:${Math.random().toString(36).slice(2)}`,
        projectId: manuscript.projectId,
        reason,
        createdAt: manuscript.updatedAt,
        manuscript: structuredClone(manuscript),
      }
      await transactionDone(db.transaction(SNAPSHOTS, 'readwrite'), (store) => store.put(snapshot))
      const snapshots = await this.listSnapshots(manuscript.projectId)
      if (snapshots.length > SNAPSHOT_LIMIT) {
        const tx = db.transaction(SNAPSHOTS, 'readwrite')
        const store = tx.objectStore(SNAPSHOTS)
        snapshots.slice(SNAPSHOT_LIMIT).forEach((entry) => store.delete(entry.id))
        await waitForTransaction(tx)
      }
    },

    async listSnapshots(projectId: string): Promise<ManuscriptSnapshotV1[]> {
      const db = await database()
      const all = await requestValue<ManuscriptSnapshotV1[]>(db.transaction(SNAPSHOTS).objectStore(SNAPSHOTS).getAll())
      return all
        .filter((snapshot) => snapshot.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    close(): void {
      if (databasePromise) void databasePromise.then((db) => db.close())
      databasePromise = null
    },
  }
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(MANUSCRIPTS)) db.createObjectStore(MANUSCRIPTS, { keyPath: 'projectId' })
      if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB se ne može otvoriti.'))
  })
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB operacija nije uspjela.'))
  })
}

function transactionDone(transaction: IDBTransaction, action: (store: IDBObjectStore) => void): Promise<void> {
  action(transaction.objectStore(transaction.objectStoreNames[0]))
  return waitForTransaction(transaction)
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transakcija nije uspjela.'))
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transakcija je prekinuta.'))
  })
}
