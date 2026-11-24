import { describe, expect, it } from 'vitest'

import {
  createEmptyResearchPlan,
  transitionResearchPlan,
  validateResearchPlan,
} from './validation'
import type { ResearchPlanV1 } from './types'

describe('research plan validation', () => {
  it('accepts a complete review plan without requiring hypotheses for qualitative work', () => {
    const plan = completePlan({ projectId: 'project-1', status: 'review', hypotheses: [], variables: [] })
    expect(validateResearchPlan(plan, 'project-1')).toEqual({ ok: true, value: plan })
  })

  it('rejects a plan with another project id or missing review fields', () => {
    expect(validateResearchPlan(completePlan({ projectId: 'other', status: 'review' }), 'project-1')).toMatchObject({ ok: false })
    expect(validateResearchPlan(completePlan({ methodology: { analysis: '' }, status: 'review' }), 'project-1')).toMatchObject({ ok: false })
  })

  it('enforces the status state machine and invalidates approved edits', () => {
    const draft = createEmptyResearchPlan('project-1', '2026-08-22T10:00:00.000Z')
    expect(transitionResearchPlan(draft, 'review').ok).toBe(false)
    const review = completePlan({ projectId: 'project-1', status: 'review' })
    expect(transitionResearchPlan(review, 'approved', '2026-08-22T11:00:00.000Z')).toMatchObject({ ok: true, value: { status: 'approved' } })
    const edited = transitionResearchPlan({ ...review, status: 'approved' }, 'draft')
    expect(edited.ok ? edited.value.status : null).toBe('draft')
  })

  it('rejects an empty repeated field and overlong text', () => {
    const plan = completePlan({ hypotheses: [{ id: 'h1', value: ' ', updatedAt: '2026-08-22T10:00:00.000Z' }] })
    expect(validateResearchPlan(plan, 'project-1')).toMatchObject({ ok: false })
    expect(validateResearchPlan(completePlan({ design: { problem: 'x'.repeat(5001) } }), 'project-1')).toMatchObject({ ok: false })
  })
})

function completePlan(overrides: { projectId?: string; status?: ResearchPlanV1['status']; design?: Partial<ResearchPlanV1['design']>; methodology?: Partial<ResearchPlanV1['methodology']>; hypotheses?: ResearchPlanV1['design']['hypotheses']; variables?: ResearchPlanV1['design']['variables'] } = {}): ResearchPlanV1 {
  const base = createEmptyResearchPlan(overrides.projectId || 'project-1', '2026-08-22T10:00:00.000Z')
  return {
    ...base,
    status: overrides.status || 'review',
    design: { ...base.design, problem: 'Definiran problem', goal: 'Jasan cilj', researchQuestion: 'Istraživačko pitanje', expectedContribution: 'Očekivani doprinos', ...overrides.design, ...(overrides.hypotheses ? { hypotheses: overrides.hypotheses } : {}), ...(overrides.variables ? { variables: overrides.variables } : {}) },
    methodology: { ...base.methodology, design: 'Kvalitativni dizajn', sample: 'Namjerni uzorak', operationalization: 'Operacionalizacija pojmova', instrument: 'Polustrukturirani intervju', analysis: 'Tematska analiza', limitations: 'Ograničenja uzorka', ethics: 'Informirani pristanak', ...overrides.methodology },
  }
}
