import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('keeps Completion workflow reads behind the workflow module', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/state/route.js'), 'utf8')

  expect(source).toContain(
    "import { loadOwnedWorkflow, WorkflowPersistenceError } from '@/lib/academic-suite/workflow/repository'",
  )
  expect(source).toContain(
    "import { canonicalProjectCandidate, resolveWorkflowForLegacySelection } from '@/lib/academic-suite/workflow/resolver'",
  )
  expect(source).toContain('candidateProjectId = canonicalProjectCandidate(row?.project_id)')
  expect(source).toContain('loadOwnedWorkflow(supabase, {')
  expect(source).toContain('resolveWorkflowForLegacySelection(candidateProjectId, loadResult)')
  expect(source).not.toContain(".from('completion_project_state')")
  expect(source).not.toContain(".from('completion_tasks')")
})

it('fails closed on canonical workflow persistence errors', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/state/route.js'), 'utf8')

  expect(source).toContain('workflowError instanceof WorkflowPersistenceError')
  expect(source).toContain("{ error: 'Učitavanje workflowa nije uspjelo.' }, { status: 500 }")
})

it('preserves the legacy PUT boundary while extending only GET workflow output', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/state/route.js'), 'utf8')

  expect(source).toContain('export async function PUT(req)')
  expect(source).toContain(".from('katedra_projects')")
  expect(source).toContain('workflowAuthority')
  expect(source).toContain('workflow: null')
})
