import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('surfaces the server request reference when an AI request fails', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-client.tsx'), 'utf8')

  expect(source).toContain("response.headers.get('x-request-id')")
  expect(source).toContain('Referenca:')
})

it('invalidates late AI responses before they can cross section boundaries', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-client.tsx'), 'utf8')

  expect(source).toContain('AbortController')
  expect(source).toContain('isCurrentAiRequest')
  expect(source).toContain('canApplyProposal')
  expect(source).toContain('setApplyRequest(null)')
})

it('does not silently lose an AI apply snapshot failure', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-client.tsx'), 'utf8')

  expect(source).toContain('Prijedlog nije moguće spremiti u lokalnu verziju.')
})

it('keeps the current project when an anonymous user opens login from the workspace', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-client.tsx'), 'utf8')

  expect(source).toContain('buildProjectAuthRedirect(manuscript.projectId)')
  expect(source).not.toContain('href="/prijava?redirect=/pisi"')
})
