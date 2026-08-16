import { describe, expect, it } from 'vitest'

const baseUrl = process.env.KATEDRA_INTEGRATION_URL
const integration = Boolean(baseUrl)

describe.skipIf(!integration)('checkout staging integration', () => {
  it('rejects an unauthenticated checkout before Stripe', async () => {
    const response = await fetch(`${baseUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ package: 'diplomski', projectId: '11111111-1111-4111-8111-111111111111' }),
    })
    expect(response.status).toBe(401)
  })
})
