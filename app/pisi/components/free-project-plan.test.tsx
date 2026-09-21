// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { createCompletionScan } from '../../../lib/project/completion-scan'
import { FreeProjectPlan } from './free-project-plan'

afterEach(() => cleanup())

describe('FreeProjectPlan', () => {
  it('keeps the project identity in the registration redirect', () => {
    render(
      <FreeProjectPlan
        projectId="project-123"
        title="Rad o javnoj upravi"
        scan={createCompletionScan({
          startMode: 'new',
          currentState: 'topic',
          title: 'Rad o javnoj upravi',
          importedText: '',
          mentor: '',
          deadline: '',
          materials: [],
        })}
        onContinue={() => undefined}
      />,
    )

    const link = screen.getByRole('link', { name: /spremi plan na ra/i })
    expect(new URL(link.getAttribute('href') || '', 'https://katedra.local').searchParams.get('redirect'))
      .toBe('/pisi?projectId=project-123')
  })
})
