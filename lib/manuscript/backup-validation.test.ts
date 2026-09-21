import { describe, expect, it } from 'vitest'

import { validateManuscriptBackup } from './backup-validation'
import type { ManuscriptV1 } from './types'

const PROJECT_ID = 'project-1'
const validBackup: ManuscriptV1 = {
  schemaVersion: 1,
  projectId: PROJECT_ID,
  title: 'Rad',
  workType: 'd',
  activeSectionId: 'section-1',
  sections: [{
    id: 'section-1',
    title: 'Uvod',
    kind: 'frontmatter',
    order: 0,
    status: 'draft',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tekst.' }] }] },
    updatedAt: '2026-08-13T12:00:00.000Z',
  }],
  sources: [{ id: 'source-1', title: 'Izvor', verified: false }],
  meta: { institution: 'FPZG' },
  createdAt: '2026-08-13T12:00:00.000Z',
  updatedAt: '2026-08-13T12:00:00.000Z',
}

describe('validateManuscriptBackup', () => {
  it('accepts and normalizes a valid backup', () => {
    const result = validateManuscriptBackup(validBackup, PROJECT_ID)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.meta).toEqual({ institution: 'FPZG' })
  })

  it('rejects a backup from another project', () => {
    expect(validateManuscriptBackup(validBackup, 'project-2')).toMatchObject({ ok: false, reason: 'project_mismatch' })
  })

  it('rejects invalid section status and malformed content', () => {
    expect(validateManuscriptBackup({ ...validBackup, sections: [{ ...validBackup.sections[0], status: 'done' }] }, PROJECT_ID)).toMatchObject({ ok: false })
    expect(validateManuscriptBackup({ ...validBackup, sections: [{ ...validBackup.sections[0], content: { type: 'html', text: '<script>' } }] }, PROJECT_ID)).toMatchObject({ ok: false })
  })

  it('rejects empty and duplicate section or source ids', () => {
    expect(validateManuscriptBackup({
      ...validBackup,
      sections: [validBackup.sections[0], { ...validBackup.sections[0], id: 'section-1', order: 1 }],
    }, PROJECT_ID)).toMatchObject({ ok: false, reason: 'invalid' })
    expect(validateManuscriptBackup({
      ...validBackup,
      sections: [{ ...validBackup.sections[0], id: '' }],
    }, PROJECT_ID)).toMatchObject({ ok: false })
    expect(validateManuscriptBackup({
      ...validBackup,
      sources: [{ ...validBackup.sources[0] }, { ...validBackup.sources[0], title: 'Drugi izvor' }],
    }, PROJECT_ID)).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('rejects oversized metadata and too many sections', () => {
    expect(validateManuscriptBackup({ ...validBackup, title: 'x'.repeat(501) }, PROJECT_ID)).toMatchObject({ ok: false, reason: 'too_large' })
    expect(validateManuscriptBackup({ ...validBackup, sections: Array.from({ length: 101 }, (_, index) => ({ ...validBackup.sections[0], id: `section-${index}`, order: index })) }, PROJECT_ID)).toMatchObject({ ok: false, reason: 'too_large' })
  })

  it('rejects malformed JSON-like input instead of throwing', () => {
    expect(validateManuscriptBackup(null, PROJECT_ID)).toMatchObject({ ok: false })
    expect(validateManuscriptBackup({ ...validBackup, projectId: 42 }, PROJECT_ID)).toMatchObject({ ok: false })
  })

  it('rejects oversized Tiptap attributes and excessive node depth', () => {
    expect(validateManuscriptBackup({
      ...validBackup,
      sections: [{
        ...validBackup.sections[0],
        content: { type: 'doc', attrs: { payload: 'x'.repeat(10_001) } },
      }],
    }, PROJECT_ID)).toMatchObject({ ok: false })

    let deep: Record<string, unknown> = { type: 'text', text: 'x' }
    for (let index = 0; index < 25; index += 1) deep = { type: 'paragraph', content: [deep] }
    expect(validateManuscriptBackup({
      ...validBackup,
      sections: [{ ...validBackup.sections[0], content: { type: 'doc', content: [deep] } }],
    }, PROJECT_ID)).toMatchObject({ ok: false })
  })

  it('rejects unsafe link marks in a backup', () => {
    expect(validateManuscriptBackup({
      ...validBackup,
      sections: [{
        ...validBackup.sections[0],
        content: {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Opasna poveznica',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            }],
          }],
        },
      }],
    }, PROJECT_ID)).toMatchObject({ ok: false, reason: 'too_large' })
  })
})
