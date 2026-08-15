'use client'

import { AgenticDashboard } from './agentic-dashboard'
import type { AgenticDraftV1 } from '../../../lib/manuscript/agentic-revisions'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'

export function AgentRunPanel({ runId, projectId, manuscript, onReset, onIntervention, onAcceptDraft }: { runId: string; projectId: string; manuscript: ManuscriptV1; onReset?: () => void; onIntervention?: () => void; onAcceptDraft?: (draft: AgenticDraftV1, sectionIds?: string[]) => Promise<void> }) {
  return <AgenticDashboard key={`${projectId}:${runId}`} runId={runId} projectId={projectId} manuscript={manuscript} onReset={onReset} onIntervention={onIntervention} onAcceptDraft={onAcceptDraft} />
}
