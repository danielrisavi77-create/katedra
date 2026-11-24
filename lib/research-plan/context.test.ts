import { describe, expect, it } from 'vitest'

import { createEmptyResearchPlan } from './validation'
import { serializeResearchPlanContext } from './context'

describe('research plan AI context', () => {
  it('serializes only bounded design and methodology fields', () => {
    const plan = createEmptyResearchPlan('project-1')
    plan.status = 'approved'
    plan.design.problem = 'Problem'
    plan.methodology.analysis = 'Tematska analiza'
    plan.design.hypotheses = Array.from({ length: 12 }, (_, index) => ({ id: String(index), value: `H${index}`, updatedAt: plan.updatedAt }))

    const context = serializeResearchPlanContext(plan)

    expect(context).toEqual(expect.objectContaining({ status: 'approved', design: expect.objectContaining({ problem: 'Problem', hypotheses: expect.any(Array) }), methodology: expect.objectContaining({ analysis: 'Tematska analiza' }) }))
    expect(context?.design.hypotheses).toHaveLength(10)
    expect(JSON.stringify(context)).not.toContain('project-1')
    expect(JSON.stringify(context)).not.toContain('schemaVersion')
  })

  it('does not create context when no plan exists', () => {
    expect(serializeResearchPlanContext(null)).toBeNull()
  })
})
