// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FocusTrap } from './focus-trap'

afterEach(cleanup)

describe('FocusTrap', () => {
  it('moves focus into the dialog, wraps Tab, closes on Escape and restores focus', async () => {
    const user = userEvent.setup()
    const onEscape = vi.fn()
    render(
      <>
        <button type="button">Otvori</button>
        <FocusTrap onEscape={onEscape}>
          <button type="button">Prvi</button>
          <button type="button">Drugi</button>
        </FocusTrap>
      </>,
    )

    const opener = screen.getByRole('button', { name: 'Otvori' })
    opener.focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Prvi' }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Drugi' }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Prvi' }))
    await user.keyboard('{Escape}')
    expect(onEscape).toHaveBeenCalledOnce()
  })
})
