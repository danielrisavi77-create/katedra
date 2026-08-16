import type { ManuscriptV1 } from './types'

export interface ManuscriptBranchV2 {
  id: string
  label: string
  source: 'user' | 'agent'
  runId?: string
  createdAt: string
  manuscript: ManuscriptV1
}

export interface ManuscriptV2 extends Omit<ManuscriptV1, 'schemaVersion'> {
  schemaVersion: 2
  revisionId: string
  parentRevisionId?: string
  activeRunId?: string
  branches: ManuscriptBranchV2[]
}

export function createManuscriptV2(manuscript: ManuscriptV1, options: { revisionId?: string; parentRevisionId?: string; activeRunId?: string } = {}): ManuscriptV2 {
  return {
    ...manuscript,
    schemaVersion: 2,
    revisionId: options.revisionId || revisionId(),
    parentRevisionId: options.parentRevisionId,
    activeRunId: options.activeRunId,
    branches: [],
  }
}

export function createManuscriptBranch(manuscript: ManuscriptV1, input: { label: string; source: ManuscriptBranchV2['source']; runId?: string }): ManuscriptBranchV2 {
  return {
    id: revisionId(),
    label: input.label.trim().slice(0, 200) || 'Lokalna verzija',
    source: input.source,
    runId: input.runId,
    createdAt: new Date().toISOString(),
    manuscript: { ...manuscript, schemaVersion: 1 },
  }
}

export function addManuscriptBranch(manuscript: ManuscriptV2, branch: ManuscriptBranchV2): ManuscriptV2 {
  return { ...manuscript, branches: [...manuscript.branches, branch].slice(-20), updatedAt: new Date().toISOString() }
}

export function revisionId(): string {
  return globalThis.crypto?.randomUUID?.() || `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
