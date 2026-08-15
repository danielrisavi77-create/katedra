import { describe, expect, it } from 'vitest'

import { validateCheckoutConfirmation } from './checkout-validation'

describe('validateCheckoutConfirmation', () => {
  it('fails closed when the canonical stored topic is not a string', () => {
    expect(validateCheckoutConfirmation({
      topic: 'Nova tema',
      projectTopic: { prompt: 'kontaminirani zapis' },
      lockConfirmation: true,
    })).toMatchObject({ ok: false, status: 409 })
  })

  it('rejects oversized or control-character topics', () => {
    expect(validateCheckoutConfirmation({
      topic: 'x'.repeat(501),
      projectTopic: 'Tema',
      lockConfirmation: true,
    })).toMatchObject({ ok: false, status: 400 })

    expect(validateCheckoutConfirmation({
      topic: 'Tema\nsa kontrolnim znakom',
      projectTopic: 'Tema\nsa kontrolnim znakom',
      lockConfirmation: true,
    })).toMatchObject({ ok: false, status: 400 })
  })
})
