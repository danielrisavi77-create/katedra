import { describe, expect, it } from 'vitest'

import { buildAiMessages, capabilityForAction } from './context'
import { createManuscript } from './model'

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
  })
})

function paragraph(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}
