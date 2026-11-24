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

export type ManuscriptSourceVerificationStatus = 'verified' | 'needs_review' | 'blocked'
export type ManuscriptSourceVerificationMethod = 'crossref' | 'url_fetch'

export interface ManuscriptSourceVerificationV1 {
  status: ManuscriptSourceVerificationStatus
  method: ManuscriptSourceVerificationMethod
  checkedAt: string
  titleMatch?: boolean
  authorMatch?: boolean
  yearMatch?: boolean
  evidenceUrl?: string
  retracted?: boolean
}

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
  verification?: ManuscriptSourceVerificationV1
}

export interface ManuscriptMetaV1 {
  institution?: string
  program?: string
  mentor?: string
  citationStyle?: string
  deadline?: string
  unitId?: string
  profileId?: string
  currentState?: 'no_topic' | 'topic' | 'outline' | 'draft' | 'review' | 'almost_done'
  materials?: string[]
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

export type ManuscriptChangeKind =
  | 'ai_proposal'
  | 'user_change'
  | 'import'
  | 'mentor_review'
  | 'restore'
  | 'agentic'
  | 'unknown'

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
  changeKind?: ManuscriptChangeKind
  sectionIds?: string[]
  after?: ManuscriptV1
}
