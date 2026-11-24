import { describe, expect, it } from 'vitest'

import { createCompletionScan } from './completion-scan'
import type { AcademicContext } from '../academic-context/types'

const base = {
  startMode: 'new' as const,
  currentState: 'topic' as const,
  title: 'Digitalizacija javne uprave',
  importedText: '',
  mentor: '',
  deadline: '',
  materials: [],
}

const fpzgGraduateContext: AcademicContext = {
  unitId: 'fpzg',
  profileId: 'fpzg-politologija-diplomski',
  institutionName: 'Fakultet političkih znanosti',
  institutionLabel: 'Sveučilište u Zagrebu',
  profileLabel: 'FPZG · diplomska Politologija · diplomski rad',
  workType: 'd',
  status: 'verified',
  verifiedAt: '2026-06-28',
  wordRange: { min: 10000, max: 12000 },
  minimumReferences: 15,
  minimumBooks: 3,
  citationStyle: 'FPZG autor–godina',
  requiredSections: ['Uvod', 'Metodologija', 'Zaključak'],
  manualChecks: ['Provjeri metodološki dio.'],
  facts: [],
  submissionFacts: [],
  sources: [{ title: 'Službene FPZG upute', url: 'https://fpzg.example/upute' }],
  aiPolicy: { mode: 'full', claims: ['Profil je verificiran.'] },
  capabilities: { facultyCoaching: true, paidPass: true, webResearch: true, autonomousRun: true },
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

  it('does not claim an existing draft when the user has not supplied text', () => {
    const scan = createCompletionScan({ ...base, startMode: 'existing', importedText: '' })
    expect(scan.hasExistingDraft).toBe(false)
    expect(scan.strengths).not.toContain('Postojeći tekst može poslužiti kao početna verzija.')
  })

  it('counts pasted draft text as available material without a manual material toggle', () => {
    const scan = createCompletionScan({ ...base, startMode: 'existing', currentState: 'draft', importedText: 'Početni tekst rada.' })
    expect(scan.hasExistingDraft).toBe(true)
    expect(scan.missing).not.toContain('dodati postojeći tekst, upute ili literaturu')
  })

  it('uses the selected academic context for targets, source guidance and next actions', () => {
    const scan = createCompletionScan({ ...base, academicContext: fpzgGraduateContext })

    expect(scan.academicContext).toBe(fpzgGraduateContext)
    expect(scan.strengths.join(' ')).toContain('10.000–12.000')
    expect(scan.missing.join(' ')).toContain('15')
    expect(scan.nextActions.join(' ')).toContain('Metodologija')
    expect(scan.nextActions.join(' ')).toContain('FPZG autor–godina')
  })
})
