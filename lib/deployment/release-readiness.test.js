import { describe, expect, it } from 'vitest'

import { evaluateReleaseReadiness } from './release-readiness.mjs'
import { REQUIRED_PRODUCTION_ENV } from './preflight.mjs'
import { REQUIRED_AGENTIC_STAGING_ENV } from './agentic-preflight.mjs'

const configured = {
  ...Object.fromEntries(REQUIRED_PRODUCTION_ENV.map(key => [key, 'configured'])),
  ...Object.fromEntries(REQUIRED_AGENTIC_STAGING_ENV.map(key => [key, 'configured'])),
  NEXT_PUBLIC_APP_URL: 'https://staging.katedra.example',
  WITHDRAWAL_FROM_EMAIL: 'support@katedra.example',
  KATEDRA_WORKER_APP_URL: 'https://worker.katedra.example',
  KATEDRA_AGENT_RUNS_ENABLED: 'true',
  KATEDRA_PROJECT_LOCKS_ENABLED: 'true',
  KATEDRA_BILLING_RPC_CONTRACT: 'v2',
  KATEDRA_RATE_LIMIT_STORE: 'supabase',
  KATEDRA_RELEASE_COMMIT_SHA: 'a'.repeat(40),
}

const evidence = {
  canonicalContract: {
    verified: true,
    verifiedAt: '2026-08-16T10:00:00.000Z',
    environment: 'staging',
    reference: 'lekta-migration-0085/sql-audit-2026-08-16',
    commitSha: 'a'.repeat(40),
    deploymentUrl: 'https://staging.katedra.example',
  },
  authenticatedStagingE2E: {
    verified: true,
    verifiedAt: '2026-08-16T10:05:00.000Z',
    environment: 'staging',
    reference: 'github-actions-run-123',
    commitSha: 'a'.repeat(40),
    deploymentUrl: 'https://staging.katedra.example',
    workflowRunUrl: 'https://github.com/example/katedra/actions/runs/123',
  },
  dependencyAudit: {
    verified: true,
    verifiedAt: '2026-08-16T10:10:00.000Z',
    environment: 'release',
    reference: 'npm-audit-report-2026-08-16',
    commitSha: 'a'.repeat(40),
    reportUrl: 'https://github.com/example/katedra/actions/runs/124',
  },
}

describe('evaluateReleaseReadiness', () => {
  it('passes only when configuration and external evidence are both complete', () => {
    const result = evaluateReleaseReadiness(configured, evidence)

    expect(result.ok).toBe(true)
    expect(result.external).toEqual([])
  })

  it('keeps release readiness blocked when canonical evidence is absent', () => {
    const result = evaluateReleaseReadiness(configured, null)

    expect(result.ok).toBe(false)
    expect(result.external).toEqual(expect.arrayContaining([
      'canonical_contract_evidence',
      'authenticated_staging_e2e_evidence',
      'dependency_audit_evidence',
    ]))
  })

  it('rejects stale, unverified or incomplete evidence without exposing values', () => {
    const result = evaluateReleaseReadiness(configured, {
      ...evidence,
      canonicalContract: { verified: false, reference: 'secret-like-value' },
      authenticatedStagingE2E: { ...evidence.authenticatedStagingE2E, verifiedAt: 'not-a-date' },
      dependencyAudit: { ...evidence.dependencyAudit, reference: '' },
    })

    expect(result.ok).toBe(false)
    expect(result.external).toEqual(expect.arrayContaining([
      'canonical_contract_evidence',
      'authenticated_staging_e2e_evidence',
      'dependency_audit_evidence',
    ]))
    expect(JSON.stringify(result)).not.toContain('secret-like-value')
  })

  it('rejects evidence that is not anchored to the current release commit', () => {
    const result = evaluateReleaseReadiness(configured, {
      ...evidence,
      authenticatedStagingE2E: { ...evidence.authenticatedStagingE2E, commitSha: 'b'.repeat(40) },
    })

    expect(result.ok).toBe(false)
    expect(result.external).toContain('authenticated_staging_e2e_evidence')
  })
})
