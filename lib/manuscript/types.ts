export type LegacyWorkType = 's' | 'z' | 'd'

export type TiptapNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  content?: TiptapNode[]
}

export type ManuscriptSectionKind = 'frontmatter' | 'chapter' | 'conclusion' | 'references'
export type ManuscriptSectionStatus = 'empty' | 'draft' | 'review' | 'approved'

export interface ManuscriptSectionV1 {
  id: string
  title: string
  kind: ManuscriptSectionKind
  order: number
  status: ManuscriptSectionStatus
  targetWords?: number
  content: TiptapNode
  updatedAt: string
}

export interface ManuscriptSourceV1 {
  id: string
  title: string
  authors?: string
  year?: string
  urlOrDoi?: string
  notes?: string
  verified: boolean
}

export interface ManuscriptMetaV1 {
  institution?: string
  program?: string
  mentor?: string
  citationStyle?: string
  deadline?: string
  unitId?: string
  profileId?: string
}

export interface ManuscriptV1 {
  schemaVersion: 1
  projectId: string
  title: string
  workType: LegacyWorkType
  activeSectionId: string
  sections: ManuscriptSectionV1[]
  sources: ManuscriptSourceV1[]
  meta: ManuscriptMetaV1
  createdAt: string
  updatedAt: string
}

export type AiProposalStatus = 'streaming' | 'ready' | 'accepted' | 'rejected' | 'stale'

export interface AiProposalV1 {
  id: string
  sectionId: string
  action: string
  baseRevision: string
  selectedFrom?: number
  selectedTo?: number
  proposedText: string
  status: AiProposalStatus
  createdAt: string
}

export interface ManuscriptSnapshotV1 {
  id: string
  projectId: string
  reason: string
  createdAt: string
  manuscript: ManuscriptV1
}
