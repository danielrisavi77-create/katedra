import { describe, expect, it } from 'vitest'

import { mergeLektaResultIntoManifest } from './reconciliation'

describe('Lekta result reconciliation for the React workspace', () => {
  it('stores incoming findings and verifies changed findings that disappeared', () => {
    const merged = mergeLektaResultIntoManifest({
      projectId: 'project-1',
      lektaIssues: [{ id: 'rule:old', checkId: 'margins', status: 'USER_CHANGED' }],
      lektaFixedTotal: 2,
    }, {
      schemaVersion: '0.1',
      analysisId: 'analysis-2',
      projectId: 'project-1',
      rulesetId: 'rules:v1',
      profileId: 'profile-1',
      score: 88,
      categoryScores: [],
      analyzedAt: '2026-08-13T18:00:00.000Z',
      issues: [{
        issueKey: 'rule:new', checkId: 'citations', ruleId: 'new', category: 'citations',
        severity: 'warning', summary: 'Provjeri citat.', fixable: false, status: 'OPEN',
      }],
    })

    expect(merged.lektaScore).toBe(88)
    expect(merged.lektaIssues).toEqual([expect.objectContaining({ id: 'rule:new', label: 'Provjeri citat.' })])
    expect(merged.lektaResolutionHistory).toEqual([expect.objectContaining({ issueId: 'rule:old', status: 'VERIFIED_FIXED' })])
    expect(merged.lektaFixedTotal).toBe(3)
  })

  it('rejects a result for a different project', () => {
    expect(() => mergeLektaResultIntoManifest({ projectId: 'project-1' }, {
      schemaVersion: '0.1', analysisId: 'analysis-1', projectId: 'project-2', rulesetId: 'rules:v1',
      score: 100, categoryScores: [], issues: [], analyzedAt: '2026-08-13T18:00:00.000Z',
    })).toThrow(/projekt/i)
  })
})
