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

it('does not expose a manual-assistant escape from autonomous workspace', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-client.tsx'), 'utf8')

  expect(source).toContain("onOpenAssistant={effectiveProjectMode === 'autonomous' ? undefined : openAssistantForStep}")
})

it('clears stale Pass state when auth or onboarding context is unavailable', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-client.tsx'), 'utf8')

  expect(source).toContain("if (!syncProjectId || !syncWorkType || !user || showOnboarding || booting) {")
  expect(source).toContain('const passContextReady = Boolean(syncProjectId && syncWorkType && user && !showOnboarding && !booting)')
  expect(source).toContain("const effectivePassStatus = passContextReady ? passStatus : 'idle'")
})

it('waits for metadata sync before checking the project Pass', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-client.tsx'), 'utf8')

  expect(source).toContain("if (syncResult.status !== 'synced') {")
  expect(source).toContain('const balanceProjectId = syncResult.canonicalProjectId || syncProjectId')
})

it('does not present an admin override as a canonical agentic Pass', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-client.tsx'), 'utf8')

  expect(source).toContain('const agenticPassActive = hasCanonicalAgenticPass(effectivePassStatus)')
  expect(source).toContain('passActive={agenticPassActive}')
  expect(source).toContain("const adminAutonomousOverride = effectivePassStatus === 'admin' && projectMode === 'autonomous'")
})
