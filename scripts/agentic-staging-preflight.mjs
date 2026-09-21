import { evaluateAgenticStagingEnvironment } from '../lib/deployment/agentic-preflight.mjs'

const result = evaluateAgenticStagingEnvironment(process.env)

if (!result.ok) {
  console.error('Agentic staging preflight failed.')
  if (result.missing.length) console.error(`Missing variables: ${result.missing.join(', ')}`)
  if (result.invalid.length) console.error(`Invalid variables: ${result.invalid.join(', ')}`)
  process.exitCode = 1
} else {
  console.log('Agentic staging preflight passed. Secret values were not printed.')
}
