import { describe, expect, it } from 'vitest'

import { buildAiMessages, capabilityForAction } from './context'
import { createManuscript } from './model'
import type { AcademicContext } from '../academic-context/types'

describe('AI manuscript context', () => {
  it('includes the active section and outline but excludes unrelated section bodies', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })
    manuscript.sections[0].content = paragraph('Tekst aktivnog uvoda.')
    manuscript.sections[1].content = paragraph('Privatni tekst drugog poglavlja.')

    const messages = buildAiMessages({
      manuscript,
      sectionId: manuscript.sections[0].id,
      action: 'improve',
      instruction: 'Poboljšaj argument.',
    })
    const prompt = String(messages[0].content)

    expect(prompt).toContain('Tekst aktivnog uvoda.')
    expect(prompt).toContain('Teorijski okvir')
    expect(prompt).not.toContain('Privatni tekst drugog poglavlja.')
  })

  it('uses only the selected text when a selection is supplied', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 's' })
    manuscript.sections[0].content = paragraph('Cijeli odlomak ne treba ići u kontekst.')

    const messages = buildAiMessages({
      manuscript,
      sectionId: manuscript.sections[0].id,
      action: 'shorten',
      selectionText: 'Samo označena rečenica.',
    })
    const prompt = String(messages[0].content)

    expect(prompt).toContain('Samo označena rečenica.')
    expect(prompt).not.toContain('Cijeli odlomak ne treba ići u kontekst.')
  })

  it('includes only explicitly attached material context in the prompt', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })

    const messages = buildAiMessages({
      manuscript,
      sectionId: manuscript.sections[0].id,
      action: 'review',
      materialContext: [{
        name: 'upute-mentora.pdf',
        text: 'Mentor traži jasnije istraživačko pitanje.',
        warnings: [],
      }],
    })
    const prompt = String(messages[0].content)

    expect(prompt).toContain('PRILOŽENI MATERIJALI:')
    expect(prompt).toContain('upute-mentora.pdf')
    expect(prompt).toContain('Mentor traži jasnije istraživačko pitanje.')
  })

  it('declares a bounded capability for every editor action', () => {
    expect(capabilityForAction('draft')).toBe('generate_large_sections')
    expect(capabilityForAction('improve')).toBe('generate_large_sections')
    expect(capabilityForAction('review')).toBe('contextual_ai')
    expect(capabilityForAction('coach')).toBe('contextual_ai')
    expect(capabilityForAction('next')).toBe('contextual_ai')
    expect(capabilityForAction('question')).toBe('contextual_ai')
    expect(capabilityForAction('shorten')).toBe('paraphrase_for_submission')
  })

  it('includes only the selected academic context in the AI prompt', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'd' })
    const academicContext: AcademicContext = {
      unitId: 'fpzg', profileId: 'fpzg-politologija-diplomski', institutionName: 'FPZG', institutionLabel: 'Sveučilište u Zagrebu', profileLabel: 'FPZG diplomski', workType: 'd', status: 'verified', verifiedAt: '2026-06-28',
      wordRange: { min: 10000, max: 12000 }, minimumReferences: 15, minimumBooks: 3, citationStyle: 'FPZG autor–godina', requiredSections: ['Uvod', 'Metodologija'], manualChecks: ['Provjeri metodologiju.'], facts: ['Najmanje 3 knjige.'], submissionFacts: ['Priloži izjavu.'], sources: [{ title: 'Službene upute', url: 'https://fpzg.example/upute' }],
      aiPolicy: { mode: 'full', claims: ['Profil verificiran.'] }, capabilities: { facultyCoaching: true, paidPass: true, webResearch: true, autonomousRun: true },
    }
    const messages = buildAiMessages({ manuscript, sectionId: manuscript.sections[0].id, action: 'draft', academicContext })
    const prompt = String(messages[0].content)

    expect(prompt).toContain('ACADEMIC CONTEXT:')
    expect(prompt).toContain('sourcePlan')
    expect(prompt).toContain('methodologyPlan')
    expect(prompt).toContain('fpzg-politologija-diplomski')
    expect(prompt).toContain('10000')
    expect(prompt).toContain('Službene upute')
    expect(prompt).not.toContain('submissionFacts')
  })
})

function paragraph(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}
