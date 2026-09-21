import { evaluateProductionEnvironment } from '../lib/deployment/preflight.mjs'

const result = evaluateProductionEnvironment(process.env)

if (!result.ok) {
  console.error('Production preflight failed.')
  if (result.missing.length) console.error(`Missing variables: ${result.missing.join(', ')}`)
  if (result.invalid.length) console.error(`Invalid variables: ${result.invalid.join(', ')}`)
  process.exitCode = 1
} else {
  console.log('Production preflight passed. Secret values were not printed.')
}
