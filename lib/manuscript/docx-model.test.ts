import { describe, expect, it } from 'vitest'

import { manuscriptToExportModel } from './docx-model'
import { createManuscript } from './model'

describe('DOCX export model', () => {
  it('preserves section order and supported inline styles', () => {
    const manuscript = createManuscript({
      projectId: 'project-1',
      title: 'Digitalizacija javne uprave',
      workType: 'z',
      now: '2026-08-13T12:00:00.000Z',
    })
    manuscript.meta = { institution: 'FPZG', mentor: 'Ana Horvat' }
    manuscript.sections[0].content = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Važna ', marks: [{ type: 'bold' }] },
          { type: 'text', text: 'tvrdnja', marks: [{ type: 'italic' }] },
        ],
      }],
    }

    const model = manuscriptToExportModel(manuscript)

    expect(model.title).toBe('Digitalizacija javne uprave')
    expect(model.meta).toEqual(['FPZG', 'Mentor: Ana Horvat'])
    expect(model.sections[0].title).toBe('Uvod')
    expect(model.sections[0].blocks[0].runs).toEqual([
      { text: 'Važna ', bold: true, italic: false },
      { text: 'tvrdnja', bold: false, italic: true },
    ])
  })

  it('drops unsafe links before DOCX export', () => {
    const manuscript = createManuscript({ projectId: 'project-1', title: 'Rad', workType: 's', now: '2026-08-13T12:00:00.000Z' })
    manuscript.sections[0].content = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Poveznica',
          marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
        }],
      }],
    }

    expect(manuscriptToExportModel(manuscript).sections[0].blocks[0].runs[0]).toEqual({
      text: 'Poveznica',
      bold: false,
      italic: false,
    })
  })
})
