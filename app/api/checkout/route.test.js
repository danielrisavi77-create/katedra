import { describe, expect, it } from 'vitest'

import { validateCheckoutConfirmation, validateCheckoutProject } from '../../../lib/stripe/checkout-validation'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

describe('validateCheckoutProject', () => {
  it('accepts a canonical project whose work type matches the package', () => {
    expect(validateCheckoutProject({ projectId: PROJECT_ID, workTypeCanonical: 'graduate' }, 'diplomski')).toEqual({ ok: true })
  })

  it('rejects a legacy project id before Stripe checkout', () => {
    expect(validateCheckoutProject({ projectId: 'klegacy-project', workTypeCanonical: 'graduate' }, 'diplomski')).toMatchObject({
      ok: false,
      status: 409,
    })
  })

  it('rejects a package that does not match the project work type', () => {
    expect(validateCheckoutProject({ projectId: PROJECT_ID, workTypeCanonical: 'seminar' }, 'diplomski')).toMatchObject({
      ok: false,
      status: 400,
    })
  })
})

describe('validateCheckoutConfirmation', () => {
  it('requires explicit lock confirmation and a topic', () => {
    expect(validateCheckoutConfirmation({ topic: 'Tema', lockConfirmation: false })).toMatchObject({ ok: false, status: 400 })
    expect(validateCheckoutConfirmation({ topic: '', lockConfirmation: true })).toMatchObject({ ok: false, status: 400 })
  })

  it('rejects a topic that differs from the canonical project topic', () => {
    expect(validateCheckoutConfirmation({ topic: 'Nova tema', projectTopic: 'Stara tema', lockConfirmation: true })).toMatchObject({
      ok: false,
      status: 409,
    })
  })

  it('accepts a confirmed topic matching the project', () => {
    expect(validateCheckoutConfirmation({ topic: 'Tema', projectTopic: 'Tema', lockConfirmation: true })).toEqual({ ok: true })
  })
})
