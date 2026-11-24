import { describe, expect, it } from 'vitest'

import {
  appendPlainText,
  applyAcademicRequiredSections,
  countDocumentWords,
  createManuscript,
  createSection,
  documentText,
  moveSection,
  removeSection,
  plainTextDocument,
} from './model'
import type { AcademicContext } from '../academic-context/types'

describe('manuscript model', () => {
  it('creates a graduate manuscript with a stable academic outline', () => {
    const manuscript = createManuscript({
      projectId: 'project-1',
      title: 'Digitalizacija javne uprave',
      workType: 'd',
      now: '2026-08-13T12:00:00.000Z',
    })

    expect(manuscript.sections.map((section) => section.title)).toEqual([
      'Uvod',
      'Teorijski okvir',
      'Metodologija',
      'Analiza i rasprava',
      'Zaključak',
      'Literatura',
    ])
    expect(manuscript.activeSectionId).toBe(manuscript.sections[0].id)
    expect(manuscript.updatedAt).toBe('2026-08-13T12:00:00.000Z')
  })

  it('counts words across nested Tiptap text nodes', () => {
    expect(countDocumentWords({
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Javna uprava' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Ovo je prvi odlomak.' }] },
      ],
    })).toBe(6)
  })

  it('moves sections and reassigns contiguous order values', () => {
    const first = createSection({ title: 'Uvod', order: 0, now: '2026-08-13T12:00:00.000Z' })
    const second = createSection({ title: 'Razrada', order: 1, now: '2026-08-13T12:00:00.000Z' })
    const third = createSection({ title: 'Zaključak', order: 2, now: '2026-08-13T12:00:00.000Z' })

    const moved = moveSection([first, second, third], third.id, 0)

    expect(moved.map((section) => section.title)).toEqual(['Zaključak', 'Uvod', 'Razrada'])
    expect(moved.map((section) => section.order)).toEqual([0, 1, 2])
  })

  it('refuses to remove the last remaining section', () => {
    const only = createSection({ title: 'Uvod', order: 0, now: '2026-08-13T12:00:00.000Z' })
    expect(removeSection([only], only.id)).toEqual([only])
  })

  it('imports plain text as paragraphs without discarding existing content', () => {
    const content = appendPlainText({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Postojeći odlomak.' }] }],
    }, 'Novi odlomak.\n\nJoš jedan odlomak.')

    expect(documentText(content)).toContain('Postojeći odlomak.')
    expect(documentText(content)).toContain('Novi odlomak.')
    expect(content.content).toHaveLength(3)
  })

  it('builds a profile-specific outline while preserving an existing approved section', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'd', now: '2026-08-13T12:00:00.000Z' })
    manuscript.sections[0].status = 'approved'
    manuscript.sections[0].content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Odobren uvod.' }] }] }
    const context = { requiredSections: ['Sažetak', 'Uvod', 'Metodologija', 'Zaključak', 'Literatura'] } as AcademicContext

    const next = applyAcademicRequiredSections(manuscript, context)

    expect(next.sections.map((section) => section.title)).toEqual([...context.requiredSections, 'Teorijski okvir', 'Analiza i rasprava'])
    expect(documentText(next.sections.find((section) => section.title === 'Uvod')?.content)).toContain('Odobren uvod.')
    expect(next.sections.find((section) => section.title === 'Metodologija')?.status).toBe('empty')
  })

  it('merges required academic sections with an existing user outline', () => {
    const manuscript = createManuscript({ projectId: 'project-2', workType: 'd', now: '2026-08-13T12:00:00.000Z' })
    manuscript.sections = [
      { ...manuscript.sections[0], title: 'Teorijski okvir', status: 'draft', content: plainTextDocument('Odobreni teorijski okvir.') },
      createSection({ title: 'Analiza', order: 1 }),
    ]
    const context = { requiredSections: ['Uvod', 'ZakljuÄŤak', 'Literatura'] } as AcademicContext

    const next = applyAcademicRequiredSections(manuscript, context)

    expect(next.sections.map((section) => section.title)).toEqual(['Uvod', 'ZakljuÄŤak', 'Literatura', 'Teorijski okvir', 'Analiza'])
    expect(documentText(next.sections.find((section) => section.title === 'Teorijski okvir')?.content)).toContain('Odobreni teorijski okvir.')
  })
})
