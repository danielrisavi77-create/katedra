import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { researchPlanTabVisible } from '../../../lib/research-plan/access'
import { createResearchPlanStore } from '../../../lib/research-plan/storage'
import { createEmptyResearchPlan } from '../../../lib/research-plan/validation'

const databaseName = 'katedra-research-plan-workspace-test'

describe('research plan workspace integration contracts', () => {
  beforeEach(async () => {
    const request = indexedDB.deleteDatabase(databaseName)
    await new Promise<void>((resolve) => {
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  })

  it('loads and saves the local plan by project identity', async () => {
    const store = createResearchPlanStore({ databaseName })
    const plan = createEmptyResearchPlan('project-1')
    await store.save(plan)
    expect(await store.load('project-1')).toEqual(plan)
    store.close()
  })

  it('shows the drawer tab only when both capabilities are allowed', () => {
    expect(researchPlanTabVisible({ researchDesign: { allowed: false }, methodology: { allowed: true } })).toBe(false)
    expect(researchPlanTabVisible({ researchDesign: { allowed: true }, methodology: { allowed: true } })).toBe(true)
  })
})
