'use client'

import { AgenticDashboard } from './agentic-dashboard'
import { useState } from 'react'
import { AgentRunPrivacy } from './agent-run-privacy'
import type { AgenticDraftV1 } from '../../../lib/manuscript/agentic-revisions'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'
import type { AgenticWorkspacePhase } from '../../../lib/manuscript/workspace-view'

export function AgentRunPanel({ runId, projectId, manuscript, requestedPhase, onReset, onIntervention, onAcceptDraft, onOpenSection, onOpenAssistant }: { runId: string; projectId: string; manuscript: ManuscriptV1; requestedPhase?: AgenticWorkspacePhase; onReset?: () => void; onIntervention?: () => void; onAcceptDraft?: (draft: AgenticDraftV1, sectionIds?: string[]) => Promise<boolean>; onOpenSection?: (sectionId: string) => void; onOpenAssistant?: (sectionId?: string) => void }) {
  const [revokedScope, setRevokedScope] = useState('')
  const scope = `${projectId}:${runId}`
  return <>
    <AgentRunPrivacy key={scope} runId={runId} projectId={projectId} onRevoked={() => setRevokedScope(scope)} />
    {revokedScope !== scope
      ? <AgenticDashboard key={scope} runId={runId} projectId={projectId} manuscript={manuscript} requestedPhase={requestedPhase} onReset={onReset} onIntervention={onIntervention} onAcceptDraft={onAcceptDraft} onOpenSection={onOpenSection} onOpenAssistant={onOpenAssistant} />
      : onReset && <button type="button" onClick={onReset}>Novi tijek</button>}
  </>
}
