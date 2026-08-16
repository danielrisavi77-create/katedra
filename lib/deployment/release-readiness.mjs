import { evaluateAgenticStagingEnvironment } from './agentic-preflight.mjs'
import { evaluateProductionEnvironment } from './preflight.mjs'

const EVIDENCE_KEYS = [
  ['canonicalContract', 'canonical_contract_evidence'],
  ['authenticatedStagingE2E', 'authenticated_staging_e2e_evidence'],
  ['dependencyAudit', 'dependency_audit_evidence'],
]
const MAX_EVIDENCE_AGE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * One release-level report for the checks that otherwise live in separate
 * preflight commands. Evidence is an operator-supplied, non-secret report;
 * its values are intentionally never returned by this function.
 */
export function evaluateReleaseReadiness(env = process.env, evidence = null, now = Date.now()) {
  const production = evaluateProductionEnvironment(env)
  const agentic = evaluateAgenticStagingEnvironment(env)
  const external = []
  const expectedCommitSha = env.GITHUB_SHA || env.KATEDRA_RELEASE_COMMIT_SHA

  if (!isCommitSha(expectedCommitSha)) external.push('release_commit_sha')

  for (const [key, label] of EVIDENCE_KEYS) {
    if (!isValidEvidenceRecord(evidence?.[key], { now, expectedCommitSha, key })) external.push(label)
  }

  return {
    ok: production.ok && agentic.ok && external.length === 0,
    production,
    agentic,
    external,
  }
}

function isValidEvidenceRecord(record, { now, expectedCommitSha, key }) {
  if (!record || typeof record !== 'object' || record.verified !== true) return false
  if (typeof record.reference !== 'string' || record.reference.trim().length < 3) return false
  if (!['staging', 'release'].includes(record.environment)) return false
  if (!isCommitSha(record.commitSha) || record.commitSha !== expectedCommitSha) return false
  if (key !== 'dependencyAudit' && !isHttpsUrl(record.deploymentUrl)) return false
  if (key === 'authenticatedStagingE2E' && !isHttpsUrl(record.workflowRunUrl)) return false
  if (key === 'dependencyAudit' && !isHttpsUrl(record.reportUrl)) return false

  const checkedAt = Date.parse(record.verifiedAt)
  if (!Number.isFinite(checkedAt)) return false
  if (checkedAt > now + 5 * 60 * 1000) return false
  return now - checkedAt <= MAX_EVIDENCE_AGE_MS
}

function isCommitSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value)
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export const REQUIRED_RELEASE_EVIDENCE = EVIDENCE_KEYS.map(([, label]) => label)
