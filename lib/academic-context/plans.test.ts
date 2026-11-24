import { describe, expect, it } from 'vitest'

import pack from '../../public/katedra-pack.json'
import { compileAcademicContext } from './compile-context'
import { createAcademicCatalog } from './load-pack'

const catalog = createAcademicCatalog(pack)

describe('academic context plans', () => {
  it('compiles a profile-specific source plan from FPZG rules', () => {
    const context = compileAcademicContext({
      catalog,
      unitId: 'fpzg',
      profileId: 'fpzg-politologija-diplomski',
      workType: 'd',
    })

    expect(context.sourcePlan).toMatchObject({
      minimumReferences: 15,
      minimumBooks: 3,
      citationStyle: 'FPZG autor–godina',
      verification: 'verified_sources_required',
    })
    expect(context.sourcePlan!.officialSources).toHaveLength(5)
    expect(context.sourcePlan!.guidance.join(' ')).toContain('15')
  })

  it('compiles a methodology plan without inventing faculty rules', () => {
    const context = compileAcademicContext({
      catalog,
      unitId: 'fpzg',
      profileId: 'fpzg-politologija-diplomski',
      workType: 'd',
    })

    expect(context.methodologyPlan).toMatchObject({ status: 'verified', workType: 'd' })
    expect(context.methodologyPlan!.guidance.join(' ')).toContain('mentor')

    const generic = compileAcademicContext({ catalog, workType: 'd', program: 'Moj smjer' })
    expect(generic.methodologyPlan).toMatchObject({ status: 'generic', required: false })
    expect(generic.methodologyPlan!.guidance.join(' ')).not.toContain('verific')
  })
})
