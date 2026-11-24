import type { ResearchPlanSnapshotV1, ResearchPlanV1 } from './types'
import { isValidResearchPlanSnapshot, validateResearchPlan } from './validation'

const DB_VERSION = 1
const PLANS_STORE = 'researchPlans'
const SNAPSHOTS_STORE = 'researchPlanSnapshots'
const SNAPSHOT_LIMIT = 20

export function createResearchPlanStore({ databaseName = 'katedra-research-plans' } = {}) {
  let databasePromise: Promise<IDBDatabase> | null = null

  const database = () => {
    if (!databasePromise) databasePromise = openDatabase(databaseName)
    return databasePromise
  }

  return {
    async load(projectId: string): Promise<ResearchPlanV1 | null> {
      const db = await database()
      const value = await requestValue<ResearchPlanV1 | undefined>(db.transaction(PLANS_STORE).objectStore(PLANS_STORE).get(projectId))
      const result = value ? validateResearchPlan(value, projectId) : null
      return result?.ok ? structuredClone(result.value) : null
    },

    async save(plan: ResearchPlanV1): Promise<void> {
      if (!validateResearchPlan(plan, plan.projectId).ok) throw new Error('Istraživački plan nije valjan.')
      const db = await database()
      const transaction = db.transaction(PLANS_STORE, 'readwrite')
      transaction.objectStore(PLANS_STORE).put(structuredClone(plan))
      await waitForTransaction(transaction)
    },

    async snapshot(plan: ResearchPlanV1, reason: string): Promise<ResearchPlanSnapshotV1> {
      const validation = validateResearchPlan(plan, plan.projectId)
      if (!validation.ok) throw new Error('Istraživački plan nije valjan.')
      if (!reason.trim()) throw new Error('Razlog snapshot-a je obavezan.')

      const snapshot: ResearchPlanSnapshotV1 = {
        id: `${plan.projectId}:${plan.updatedAt}:${Math.random().toString(36).slice(2)}`,
        projectId: plan.projectId,
        reason: reason.trim(),
        createdAt: plan.updatedAt,
        plan: structuredClone(plan),
      }
      const db = await database()
      const transaction = db.transaction(SNAPSHOTS_STORE, 'readwrite')
      transaction.objectStore(SNAPSHOTS_STORE).put(snapshot)
      await waitForTransaction(transaction)

      const snapshots = await this.listSnapshots(plan.projectId)
      if (snapshots.length > SNAPSHOT_LIMIT) {
        const cleanup = db.transaction(SNAPSHOTS_STORE, 'readwrite')
        const store = cleanup.objectStore(SNAPSHOTS_STORE)
        snapshots.slice(SNAPSHOT_LIMIT).forEach((entry) => store.delete(entry.id))
        await waitForTransaction(cleanup)
      }
      return structuredClone(snapshot)
    },

    async listSnapshots(projectId: string): Promise<ResearchPlanSnapshotV1[]> {
      const db = await database()
      const values = await requestValue<ResearchPlanSnapshotV1[]>(db.transaction(SNAPSHOTS_STORE).objectStore(SNAPSHOTS_STORE).getAll())
      return values
        .filter((snapshot) => isValidResearchPlanSnapshot(snapshot, projectId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((snapshot) => structuredClone(snapshot))
    },

    async restore(snapshotId: string, projectId: string): Promise<ResearchPlanV1> {
      const db = await database()
      const snapshot = await requestValue<ResearchPlanSnapshotV1 | undefined>(db.transaction(SNAPSHOTS_STORE).objectStore(SNAPSHOTS_STORE).get(snapshotId))
      if (!snapshot || !isValidResearchPlanSnapshot(snapshot, projectId)) throw new Error('Snapshot ne pripada ovom projektu ili nije valjan.')
      return structuredClone(snapshot.plan)
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
      if (!db.objectStoreNames.contains(PLANS_STORE)) db.createObjectStore(PLANS_STORE, { keyPath: 'projectId' })
      if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id' })
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

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transakcija nije uspjela.'))
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transakcija je prekinuta.'))
  })
}
