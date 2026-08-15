// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createManuscript } from '../../../lib/manuscript/model'
import { ProjectDrawer } from './project-drawer'

vi.mock('./paid-project-setup', () => ({
  PaidProjectSetup: ({ onAcceptDraft }: { onAcceptDraft?: unknown }) => (
    <div data-testid="paid-project-setup" data-has-accept={String(Boolean(onAcceptDraft))} />
  ),
}))

afterEach(() => cleanup())

describe('ProjectDrawer agentic entry point', () => {
  it('opens the requested local history and defense surfaces', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })
    const props = {
      open: true,
      manuscript,
      legacyChecks: {},
      mentorTasks: [],
      lektaSummary: { score: null, checkedAt: '', fixedTotal: 0, issues: [] },
      passActive: true,
      onClose: vi.fn(),
      onMetaChange: vi.fn(),
      onAddSource: vi.fn(),
      onRemoveSource: vi.fn(),
      onAddMentorTask: vi.fn(),
      onToggleMentorTask: vi.fn(),
      onBackup: vi.fn(),
      onRestore: vi.fn(),
      onImportText: vi.fn(),
    }
    const view = render(<ProjectDrawer {...props} requestedTab="history" />)

    expect(screen.getByRole('heading', { name: 'Lokalna povijest projekta' })).toBeTruthy()

    view.rerender(<ProjectDrawer {...props} requestedTab="defense" />)
    expect(screen.getByText('Priprema obrane')).toBeTruthy()
  })

  it('passes the manuscript accept callback into the agentic setup', async () => {
    const user = userEvent.setup()
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })

    render(
      <ProjectDrawer
        open
        manuscript={manuscript}
        legacyChecks={{}}
        mentorTasks={[]}
        lektaSummary={{ score: null, checkedAt: '', fixedTotal: 0, issues: [] }}
        passActive
        onClose={vi.fn()}
        onMetaChange={vi.fn()}
        onAddSource={vi.fn()}
        onRemoveSource={vi.fn()}
        onAddMentorTask={vi.fn()}
        onToggleMentorTask={vi.fn()}
        onBackup={vi.fn()}
        onRestore={vi.fn()}
        onImportText={vi.fn()}
        onAcceptDraft={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Agenti' }))
    expect(screen.getByTestId('paid-project-setup').getAttribute('data-has-accept')).toBe('true')
  })
})
