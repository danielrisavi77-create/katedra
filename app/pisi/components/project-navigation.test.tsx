// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProjectNavigation } from './project-navigation'

afterEach(cleanup)

describe('ProjectNavigation', () => {
  it('renders student-goal navigation with one active item', () => {
    render(<ProjectNavigation activeItem="writing" workType="z" onNavigate={vi.fn()} />)

    const navigation = screen.getByRole('navigation', { name: 'Projekt' })
    expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Pisanje' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('button', { name: 'Generator' })).toBeNull()
  })

  it('hides defense for seminarski work', () => {
    render(<ProjectNavigation activeItem="home" workType="s" onNavigate={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Obrana' })).toBeNull()
  })
})
