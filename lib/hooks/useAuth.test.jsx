// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({ createClient: mocks.createClient }))

import { AuthProvider, useAuth } from './useAuth'

function AuthProbe() {
  const { user, loading } = useAuth()
  return <output>{loading ? 'loading' : user?.email || 'anonymous'}</output>
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AuthProvider', () => {
  it('resolves a persisted session even when the auth listener does not emit INITIAL_SESSION', async () => {
    const user = { id: 'user-1', email: 'daniel@example.com' }
    mocks.createClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    })

    render(<AuthProvider><AuthProbe /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('daniel@example.com')).toBeTruthy())
  })
})
