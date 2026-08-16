import { describe, expect, it } from 'vitest'

import {
  appendPlainText,
  countDocumentWords,
  createManuscript,
  createSection,
  documentText,
  moveSection,
  removeSection,
} from './model'

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
})
