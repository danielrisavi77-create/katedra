import { describe, expect, it } from 'vitest'

import pack from '../../public/katedra-pack.json'
import { academicContextExportWarning, academicHandoffParams } from './presentation'
import { compileAcademicContext, serializeAcademicContext } from './compile-context'
import { createAcademicCatalog } from './load-pack'
import { createCompletionScan } from '../project/completion-scan'
import { buildAiMessages } from '../manuscript/context'
import { applyAcademicRequiredSections, createManuscript } from '../manuscript/model'

describe('Academic Context Compiler acceptance flow', () => {
  it('carries the FPZG diplomski rules through every product boundary', () => {
    const context = compileAcademicContext({
      catalog: createAcademicCatalog(pack),
      unitId: 'fpzg',
      profileId: 'fpzg-politologija-diplomski',
      workType: 'd',
    })
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'd', title: 'Digitalizacija javne uprave' })
    const outlined = applyAcademicRequiredSections(manuscript, context, '2026-08-22T00:00:00.000Z')
    const scan = createCompletionScan({
      startMode: 'new', currentState: 'topic', title: manuscript.title, importedText: '', mentor: '', deadline: '', materials: [], academicContext: context,
    })
    const prompt = String(buildAiMessages({ manuscript: outlined, sectionId: outlined.activeSectionId, action: 'draft', academicContext: context })[0].content)
    const serialized = serializeAcademicContext(context)

    expect(context).toMatchObject({ status: 'verified', wordRange: { min: 10000, max: 12000 }, minimumReferences: 15, minimumBooks: 3, citationStyle: 'FPZG autor–godina' })
    expect(outlined.sections.map((section) => section.title)).toEqual([...context.requiredSections, 'Teorijski okvir', 'Metodologija', 'Analiza i rasprava'])
    expect(scan.strengths.join(' ')).toContain('10.000–12.000')
    expect(scan.missing.join(' ')).toContain('15')
    expect(prompt).toContain('fpzg-politologija-diplomski')
    expect(prompt).toContain('sourcePlan')
    expect(prompt).toContain('methodologyPlan')
    expect(prompt).toContain('aiCapabilities')
    expect(serialized).toContain('fpzg.unizg.hr')
    expect(JSON.parse(serialized).capabilities).toMatchObject({
      facultyCoaching: true,
      paidPass: true,
      webResearch: true,
      aiCapabilities: expect.arrayContaining(['contextual_ai', 'web_research']),
    })
    expect(academicContextExportWarning(context)).toContain('Najmanje 15 izvora')
    expect(academicHandoffParams(context)).toMatchObject({ rulesStatus: 'verified', rulesMinWords: '10000', rulesMinReferences: '15' })
  })

  it('changes academic AI capability guidance between final and graduate work', () => {
    const catalog = createAcademicCatalog(pack)
    const final = compileAcademicContext({ catalog, unitId: 'fpzg', profileId: 'fpzg-politologija-zavrsni', workType: 'z' })
    const graduate = compileAcademicContext({ catalog, unitId: 'fpzg', profileId: 'fpzg-politologija-diplomski', workType: 'd' })

    expect(final.capabilities.aiCapabilities).toEqual(expect.arrayContaining(['contextual_ai', 'methodology_guidance', 'web_research']))
    expect(graduate.capabilities.aiCapabilities).toEqual(expect.arrayContaining(['contextual_ai', 'methodology_guidance', 'web_research']))
    expect(graduate.capabilities.aiCapabilities).toContain('source_guidance')
    expect(graduate.capabilities.aiCapabilities).toContain('research_design_guidance')
    expect(final.capabilities.aiCapabilities).not.toContain('research_design_guidance')
    expect(serializeAcademicContext(final)).not.toEqual(serializeAcademicContext(graduate))
  })
})
