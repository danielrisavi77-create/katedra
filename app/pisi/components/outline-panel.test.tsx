// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createManuscript } from '../../../lib/manuscript/model'
import { OutlinePanel } from './outline-panel'

afterEach(cleanup)

describe('OutlinePanel', () => {
  it('searches manuscript text as well as section titles', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 's' })
    manuscript.sections[1].content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Jedinstvena analiza digitalizacije.' }] }],
    }

    render(<OutlinePanel manuscript={manuscript} onActivate={vi.fn()} onAdd={vi.fn()} onMove={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onStatus={vi.fn()} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'digitalizacije' } })

    expect(screen.getByText('Razrada')).toBeTruthy()
    expect(screen.queryByText('Uvod')).toBeNull()
  })
})
