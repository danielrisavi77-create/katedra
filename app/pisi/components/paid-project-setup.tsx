'use client'

import { useState } from 'react'

import { AgentRunPanel } from './agent-run-panel'
import { AgenticPreparation } from './agentic-preparation'
import { AgenticIntervention } from './agentic-intervention'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'

export function PaidProjectSetup({ projectId, passActive, sectionIds, manuscript }: { projectId: string; passActive: boolean; sectionIds: string[]; manuscript: ManuscriptV1 }) {
  const [runId, setRunId] = useState('')
  const [intervention, setIntervention] = useState(false)

  if (runId && intervention) return <AgenticIntervention runId={runId} projectId={projectId} manuscript={manuscript} reason="Verifikator je zatražio dodatni kontekst prije nastavka." onResumed={() => setIntervention(false)} />
  if (runId) return <AgentRunPanel runId={runId} projectId={projectId} manuscript={manuscript} onReset={() => setRunId('')} onIntervention={() => setIntervention(true)} />
  return <AgenticPreparation projectId={projectId} passActive={passActive} sectionIds={sectionIds} manuscript={manuscript} onRunCreated={setRunId} />
}
