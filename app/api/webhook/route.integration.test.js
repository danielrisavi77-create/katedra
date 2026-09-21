import { describe, expect, it } from 'vitest'

const baseUrl = process.env.KATEDRA_INTEGRATION_URL

describe.skipIf(!baseUrl)('Stripe webhook staging integration', () => {
  it('rejects a webhook without a Stripe signature', async () => {
    const response = await fetch(`${baseUrl}/api/webhook`, { method: 'POST', body: '{}' })
    expect(response.status).toBe(400)
  })
})
