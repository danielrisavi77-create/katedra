import { describe, expect, it } from 'vitest'

const baseUrl = process.env.KATEDRA_INTEGRATION_URL

describe.skipIf(!baseUrl)('state staging integration', () => {
  it('rejects an unauthenticated exact-project read', async () => {
    const response = await fetch(`${baseUrl}/api/state?projectId=11111111-1111-4111-8111-111111111111`)
    expect(response.status).toBe(401)
  })
})
