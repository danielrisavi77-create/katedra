import assert from 'node:assert/strict'

const configuredMode = process.env.KATEDRA_AGENT_WORKER_CONTRACT_MODE
const mode = String(configuredMode || '').trim().toLowerCase()

if (configuredMode !== undefined && mode !== 'fixture') {
  console.log('BLOCKED_EXTERNAL: deterministic worker contract is separate from authenticated staging credentials')
  process.exit(1)
}

console.log('NOT_AN_INTEGRATION_TEST: response fixture only; no application worker, HTTP, provider or RPC is executed')
const fixtureDispatcher = createFixtureDispatcher()
const firstTick = await fixtureDispatcher.tick()
assert.equal(firstTick.httpStatus, 200)
assert.equal(firstTick.body.status, 'retrying')
console.log('fixture tick 1: dispatcher=200 step=retrying')

const secondTick = await fixtureDispatcher.tick()
assert.equal(secondTick.httpStatus, 200)
assert.equal(secondTick.body.status, 'completed')
console.log('fixture tick 2: dispatcher=200 run=completed')

assert.equal(fixtureDispatcher.ticks, 2)
console.log('AGENT_WORKER_RESPONSE_FIXTURE_ONLY_PASS')

function createFixtureDispatcher() {
  const responses = [
    { httpStatus: 200, body: { status: 'retrying', stepsProcessed: 1, lastStepId: 'step-1' } },
    { httpStatus: 200, body: { status: 'completed', stepsProcessed: 1, lastStepId: 'step-1' } },
  ]
  let index = 0

  return {
    get ticks() {
      return index
    },
    async tick() {
      const response = responses[index]
      if (!response) throw new Error('Fixture dispatcher received more ticks than expected.')
      index += 1
      return response
    },
  }
}
