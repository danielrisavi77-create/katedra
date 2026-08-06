import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('keeps Completion workflow reads behind the workflow module', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/state/route.js'), 'utf8')

  expect(source).toContain(
    "import { loadOwnedWorkflow, WorkflowPersistenceError } from '@/lib/academic-suite/workflow/repository'",
  )
  expect(source).toContain(
    "import { resolveWorkflowForLegacySelection } from '@/lib/academic-suite/workflow/resolver'",
  )
  expect(source).toContain('const candidateProjectId = cleanCanonicalProjectId(row?.project_id)')
  expect(source).toContain('loadOwnedWorkflow(supabase, {')
  expect(source).toContain('resolveWorkflowForLegacySelection(candidateProjectId, loadResult)')
  expect(source).not.toContain(".from('completion_project_state')")
  expect(source).not.toContain(".from('completion_tasks')")
})

it('keeps legacy opaque project IDs out of canonical UUID queries', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/state/route.js'), 'utf8')

  expect(source).toContain('function cleanCanonicalProjectId(value)')
  expect(source).toContain('[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}')
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
