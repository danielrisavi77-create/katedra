import { describe, expect, it } from 'vitest'

import { createCompletionScan } from './completion-scan'

const base = {
  startMode: 'new' as const,
  currentState: 'topic' as const,
  title: 'Digitalizacija javne uprave',
  importedText: '',
  mentor: '',
  deadline: '',
  materials: [],
}

describe('completion scan', () => {
  it('returns three concrete next actions without using AI', () => {
    const scan = createCompletionScan(base)
    expect(scan.nextActions).toHaveLength(3)
    expect(scan.missing).toContain('dodati mentora ili potvrditi da još nije poznat')
  })

  it('recognizes a draft and records existing strengths', () => {
    const scan = createCompletionScan({ ...base, startMode: 'existing', currentState: 'draft', importedText: 'Postojeći tekst', mentor: 'Ana', deadline: '2026-09-15', materials: ['draft'] })
    expect(scan.stage).toBe('writing')
    expect(scan.hasExistingDraft).toBe(true)
    expect(scan.missing).toEqual([])
    expect(scan.strengths.length).toBeGreaterThanOrEqual(4)
  })
})
