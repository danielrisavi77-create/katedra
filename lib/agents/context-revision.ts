import type { ManuscriptV1 } from '../manuscript/types'

export interface ContextRevisionInput {
  runId: string
  projectId: string
  manuscript: ManuscriptV1
  materialIds?: string[]
}

export interface ContextRevisionResult {
  contextRevision: string
  attachedMaterialIds: string[]
}

export function createContextRevision({ manuscript, materialIds }: { manuscript: ManuscriptV1; materialIds: string[]; now?: string }): string {
  const normalizedMaterials = [...new Set(materialIds.map((id) => id.trim()).filter(Boolean))].sort()
  return hash(JSON.stringify({ projectId: manuscript.projectId, updatedAt: manuscript.updatedAt, materialIds: normalizedMaterials }))
}

function hash(input: string): string {
  let value = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0).toString(36)
}
