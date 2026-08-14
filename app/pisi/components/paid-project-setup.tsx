'use client'

import { useState } from 'react'

import { AgentRunPanel } from './agent-run-panel'
import { AgenticPreparation } from './agentic-preparation'
import { AgenticIntervention } from './agentic-intervention'
import type { AgenticDraftV1 } from '../../../lib/manuscript/agentic-revisions'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'

export type AgenticWorkspacePhase = 'preparation' | 'dashboard' | 'intervention'

export function PaidProjectSetup({ projectId, passActive, sectionIds, manuscript, onPhaseChange, onAcceptDraft }: { projectId: string; passActive: boolean; sectionIds: string[]; manuscript: ManuscriptV1; onPhaseChange?: (phase: AgenticWorkspacePhase) => void; onAcceptDraft?: (draft: AgenticDraftV1, sectionIds?: string[]) => Promise<void> }) {
  const [runId, setRunId] = useState('')
  const [intervention, setIntervention] = useState(false)

  if (runId && intervention) return <AgenticIntervention runId={runId} projectId={projectId} manuscript={manuscript} reason="Verifikator je zatražio dodatni kontekst prije nastavka." onResumed={() => { setIntervention(false); onPhaseChange?.('dashboard') }} />
  if (runId) return <AgentRunPanel runId={runId} projectId={projectId} manuscript={manuscript} onReset={() => { setRunId(''); onPhaseChange?.('preparation') }} onIntervention={() => { setIntervention(true); onPhaseChange?.('intervention') }} onAcceptDraft={onAcceptDraft} />
  return <AgenticPreparation projectId={projectId} passActive={passActive} sectionIds={sectionIds} manuscript={manuscript} onRunCreated={(nextRunId) => { setRunId(nextRunId); onPhaseChange?.('dashboard') }} />
}
