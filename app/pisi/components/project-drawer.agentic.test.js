import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('passes verified agentic results from the project drawer back to the manuscript', () => {
  const drawerSource = readFileSync(resolve(process.cwd(), 'app/pisi/components/project-drawer.tsx'), 'utf8')
  const workspaceSource = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-client.tsx'), 'utf8')

  expect(drawerSource).toContain('onAcceptDraft?:')
  expect(drawerSource).toContain('onAcceptDraft={onAcceptDraft}')
  expect(workspaceSource).toContain('onAcceptDraft={acceptAgenticDraft}')
})
