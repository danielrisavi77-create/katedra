import { readFile } from 'node:fs/promises'

import { evaluateReleaseReadiness, REQUIRED_RELEASE_EVIDENCE } from '../lib/deployment/release-readiness.mjs'

let evidence = null
if (process.env.KATEDRA_RELEASE_EVIDENCE_FILE) {
  try {
    evidence = JSON.parse(await readFile(process.env.KATEDRA_RELEASE_EVIDENCE_FILE, 'utf8'))
  } catch {
    // Keep the report safe and useful without printing a path or file content.
    evidence = null
  }
}

const result = evaluateReleaseReadiness(process.env, evidence)
console.log(`Production configuration: ${result.production.ok ? 'PASS' : 'BLOCKED'}`)
if (result.production.missing.length) console.log(`  Missing: ${result.production.missing.join(', ')}`)
if (result.production.invalid.length) console.log(`  Invalid: ${result.production.invalid.join(', ')}`)
console.log(`Agentic staging configuration: ${result.agentic.ok ? 'PASS' : 'BLOCKED'}`)
if (result.agentic.missing.length) console.log(`  Missing: ${result.agentic.missing.join(', ')}`)
if (result.agentic.invalid.length) console.log(`  Invalid: ${result.agentic.invalid.join(', ')}`)

if (result.external.length) {
  console.log(`External evidence: BLOCKED (${result.external.join(', ')})`)
  console.log(`Provide a fresh JSON evidence file with: ${REQUIRED_RELEASE_EVIDENCE.join(', ')} and a matching release commit SHA.`)
} else {
  console.log('External evidence: PASS')
}

if (!result.ok) {
  console.error('Release readiness failed closed. No production activation is implied.')
  process.exitCode = 1
} else {
  console.log('Release readiness passed. Secret values were not printed.')
}
