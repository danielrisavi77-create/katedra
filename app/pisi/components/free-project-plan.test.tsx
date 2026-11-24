// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { createCompletionScan } from '../../../lib/project/completion-scan'
import { FreeProjectPlan } from './free-project-plan'

afterEach(() => cleanup())

describe('FreeProjectPlan', () => {
  it('keeps the project identity in the registration redirect', () => {
    render(
      <FreeProjectPlan
        projectId="project-123"
        title="Rad o javnoj upravi"
        scan={createCompletionScan({
          startMode: 'new',
          currentState: 'topic',
          title: 'Rad o javnoj upravi',
          importedText: '',
          mentor: '',
          deadline: '',
          materials: [],
        })}
        onContinue={() => undefined}
      />,
    )

    const link = screen.getByRole('link', { name: /spremi plan na ra/i })
    expect(new URL(link.getAttribute('href') || '', 'https://katedra.local').searchParams.get('redirect'))
      .toBe('/pisi?projectId=project-123')
  })

  it('shows selected academic rules and their verification status in the scan', () => {
    render(
      <FreeProjectPlan
        projectId="project-123"
        title="Rad o javnoj upravi"
        scan={createCompletionScan({
          startMode: 'new', currentState: 'topic', title: 'Rad o javnoj upravi', importedText: '', mentor: '', deadline: '', materials: [],
          academicContext: {
            unitId: 'fpzg', profileId: 'fpzg-politologija-diplomski', institutionName: 'FPZG', institutionLabel: 'Sveučilište u Zagrebu', profileLabel: 'FPZG diplomski', workType: 'd', status: 'verified', verifiedAt: '2026-06-28',
            wordRange: { min: 10000, max: 12000 }, minimumReferences: 15, minimumBooks: 3, citationStyle: 'FPZG autor–godina', requiredSections: ['Uvod'], manualChecks: [], facts: [], submissionFacts: [], sources: [{ title: 'Službene upute', url: 'https://fpzg.example/upute' }],
            aiPolicy: { mode: 'full', claims: [] }, capabilities: { facultyCoaching: true, paidPass: true, webResearch: true, autonomousRun: true },
          },
        })}
        onContinue={() => undefined}
      />,
    )

    expect(screen.getAllByText(/FPZG diplomski/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('link', { name: /upute/i }).getAttribute('href')).toBe('https://fpzg.example/upute')
    expect(screen.getAllByText(/2026-06-28/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/10\.000–12\.000/)).toBeTruthy()
    expect(screen.getAllByText(/verificirana/).length).toBeGreaterThanOrEqual(1)
  })
})
