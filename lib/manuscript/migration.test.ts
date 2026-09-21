import { describe, expect, it } from 'vitest'

import { migrateLegacyProject } from './migration'

describe('legacy project migration', () => {
  it('migrates metadata without inventing document text', () => {
    const manuscript = migrateLegacyProject({
      manifest: {
        projectId: 'klegacy',
        topic: 'Digitalizacija javne uprave',
        workType: 'z',
        unitId: 'fpzg',
        profileId: 'fpzg-final',
        deadline: '2026-09-20',
      },
      legacyState: {
        gen: {
          f_mentor: 'doc. dr. sc. Ana Horvat',
          f_fakultet: 'FPZG',
          f_smjer: 'Politologija',
          f_stil: 'autor-godina',
        },
      },
      now: '2026-08-13T12:00:00.000Z',
    })

    expect(manuscript.projectId).toBe('klegacy')
    expect(manuscript.title).toBe('Digitalizacija javne uprave')
    expect(manuscript.meta).toMatchObject({
      institution: 'FPZG',
      program: 'Politologija',
      mentor: 'doc. dr. sc. Ana Horvat',
      citationStyle: 'autor-godina',
      deadline: '2026-09-20',
      unitId: 'fpzg',
    })
    expect(manuscript.sections.every((section) => countText(section.content) === 0)).toBe(true)
  })

  it('ignores malformed legacy metadata instead of passing objects into the manuscript', () => {
    const manuscript = migrateLegacyProject({
      manifest: {
        projectId: { bad: true } as unknown as string,
        topic: { bad: true } as unknown as string,
        workType: { bad: true } as unknown as string,
        institution: ['bad'] as unknown as string,
        program: { bad: true } as unknown as string,
        deadline: 42 as unknown as string,
      },
      legacyState: {
        gen: {
          f_mentor: { bad: true },
          f_fakultet: ['bad'],
          f_smjer: { bad: true },
          f_stil: 42,
        },
      },
      now: '2026-08-13T12:00:00.000Z',
    })

    expect(typeof manuscript.projectId).toBe('string')
    expect(manuscript.projectId).not.toEqual('[object Object]')
    expect(manuscript.title).toBe('')
    expect(manuscript.workType).toBe('z')
    expect(manuscript.meta).toEqual({})
  })
})

function countText(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  const node = value as { text?: string; content?: unknown[] }
  return (node.text?.length || 0) + (node.content || []).reduce<number>((sum, child) => sum + countText(child), 0)
}
