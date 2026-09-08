import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { callGateVerifier } from '../lib/agents/gate-verifier'
import { buildPlanReview } from '../lib/agents/plan-approval'
import { documentText, plainTextDocument } from '../lib/manuscript/model'
import type { TiptapNode } from '../lib/manuscript/types'
import { validateManuscriptBackup } from '../lib/manuscript/backup-validation'
import type { VerifiedAgentArtifactContext } from '../lib/agents/artifact-chain'
import type { AgentStepRecord } from '../lib/agents/run-state'

const url = process.env.KATEDRA_GATE_E2E_URL || ''
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) throw new Error('Set KATEDRA_GATE_E2E_URL to the local test service; production hosts are refused.')
const fixture = JSON.parse(readFileSync(process.env.KATEDRA_GATE_E2E_FIXTURE || '', 'utf8'))
const now = '2026-09-07T00:00:00.000Z'
const candidate = { ...fixture, schemaVersion: 1, activeSectionId: 's1', createdAt: now, updatedAt: now,
  // Flatten the service's table-rich fixture to the editor node types accepted by this app.
  sections: fixture.sections.map((section: Record<string, unknown>) => ({ ...section, updatedAt: now, content: plainTextDocument(documentText(section.content as TiptapNode)) })),
  sources: fixture.sources.map((source: Record<string, unknown>) => ({ ...source, year: String(source.year) })),
}
const validated = validateManuscriptBackup(candidate, 'project-1')
if (!validated.ok) throw new Error('Service fixture does not satisfy the actual app manuscript contract')
const manuscript = validated.value
const plan = {
  thesis: 'Obvezno glasanje povećava formalnu, ali ne i percipiranu legitimnost izbora.',
  question: 'Kako obvezno glasanje utječe na percipiranu legitimnost?',
  perspectives: [{ label: 'Institucionalna', position: 'odaziv jednak legitimnosti', why: 'Lijphart 1997' }, { label: 'Bihevioralna', position: 'prisila ne mijenja stav', why: 'Birch 2009' }],
  chapters: [{ sectionId: 's1', pages: 2, content: 'kontekst, pitanje, teza, metoda, pregled', sources: ['src-1'] }, { sectionId: 's2', pages: 6, content: 'pojmovi legitimnosti i odaziva', sources: ['src-1'] }, { sectionId: 's9', pages: 2, content: 'odgovor na pitanje, doprinos, ograničenja', sources: ['src-1'] }],
}
const artifacts: VerifiedAgentArtifactContext[] = [{ artifactId: 'planning-1', stepId: 'planning', agent: 'planning', verifier: 'planning_verifier', stepOrder: 3, attempt: 1, citations: [], output: '<!-- PLAN:JSON -->' + JSON.stringify(plan) + '<!-- /PLAN:JSON -->' }]
const step: AgentStepRecord = { id: 'writing-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 's1', order: 4, attempt: 1, status: 'running' }
const input = { runId: 'wire-run', userId: 'wire-user', step, manuscript, artifacts, profile: { name: 'FPZG', citation: 'fpzg' },
  result: { agent: 'writing' as const, output: 'Fixture output', citations: [], provider: 'fixture', usage: { inputTokens: 1, outputTokens: 1 } },
}
const config = { url, token: 'local-approval-fixture', timeoutMs: 120_000 }

it('the real service refuses a structurally complete plan without explicit approval', async () => {
  const response = await callGateVerifier(config, input)
  expect(response.status).toBe('blocked')
  expect(response.issues).toEqual([expect.objectContaining({ code: 'gate_finding', step: 'plan_approval' })])
  expect(response.gate?.koraci).toEqual([])
  expect(response.gateExitCode).toBeUndefined()
})

it('the real service accepts current approval, executes its gate, and still enforces content findings', async () => {
  const review = buildPlanReview(manuscript, artifacts)
  const planApproval = { schemaVersion: 1, runId: input.runId, projectId: manuscript.projectId, planRevision: review.planRevision, approvedBy: input.userId, approvedAt: new Date().toISOString() }
  const response = await callGateVerifier(config, { ...input, planApproval })
  expect(['verified', 'needs_revision', 'blocked']).toContain(response.status)
  expect(response.gate?.faza).toBe('pisanje')
  expect(response.gate?.koraci.some((step) => step.korak === 'argument')).toBe(true)
  expect(response.issues.some((issue) => issue.step === 'plan_approval')).toBe(false)
  expect(typeof response.gateExitCode).toBe('number')
  const changed = await callGateVerifier(config, { ...input, manuscript: { ...manuscript, title: 'Changed topic after approval' }, planApproval })
  expect(changed.status).toBe('blocked')
  expect(changed.issues[0].step).toBe('plan_approval')
})
