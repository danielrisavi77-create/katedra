'use client'

import { AgenticDashboard } from './agentic-dashboard'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'

export function AgentRunPanel({ runId, projectId, manuscript, onReset, onIntervention }: { runId: string; projectId: string; manuscript: ManuscriptV1; onReset?: () => void; onIntervention?: () => void }) {
  return <AgenticDashboard runId={runId} projectId={projectId} manuscript={manuscript} onReset={onReset} onIntervention={onIntervention} />
}
