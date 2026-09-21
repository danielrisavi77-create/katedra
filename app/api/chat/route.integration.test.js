import { describe, expect, it } from 'vitest'

const baseUrl = process.env.KATEDRA_INTEGRATION_URL

describe.skipIf(!baseUrl)('chat staging integration', () => {
  it('rejects an unauthenticated request before project lookup or provider access', async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: '11111111-1111-4111-8111-111111111111', messages: [{ role: 'user', content: 'test' }] }),
    })
    expect(response.status).toBe(401)
  })
})
