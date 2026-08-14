'use client'

import type { ReactNode } from 'react'

import { countDocumentWords } from '../../../lib/manuscript/model'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'
import type { SyncStatus } from '../../../lib/manuscript/sync-status'
import { MobileWorkspaceNav } from './mobile-workspace-nav'
import { WorkspaceNavigation, type SaveStatus } from './workspace-navigation'

export type MobileView = 'outline' | 'editor' | 'assistant'
export type WorkspaceView = 'preparation' | 'dashboard' | 'intervention' | 'review' | 'writing'
export type { SaveStatus } from './workspace-navigation'

export function WorkspaceShell({
  manuscript,
  saveStatus,
  syncStatus = 'local_only',
  activeMobileView,
  onMobileViewChange,
  onExport,
  onOpenTools,
  account,
  outline,
  editor,
  assistant,
  view = 'writing',
  projectLocked = false,
  activeAgentLabel,
  agenticContent,
  onOpenAgents,
  onCloseAgents,
}: {
  manuscript: ManuscriptV1
  saveStatus: SaveStatus
  syncStatus?: SyncStatus
  activeMobileView: MobileView
  onMobileViewChange: (view: MobileView) => void
  onExport: () => void
  onOpenTools?: () => void
  account?: ReactNode
  outline: ReactNode
  editor: ReactNode
  assistant: ReactNode
  view?: WorkspaceView
  onViewChange?: (view: WorkspaceView) => void
  projectLocked?: boolean
  activeAgentLabel?: string
  agenticContent?: ReactNode
  onOpenAgents?: () => void
  onCloseAgents?: () => void
}) {
  const totalWords = manuscript.sections.reduce((sum, section) => sum + countDocumentWords(section.content), 0)

  return (
    <div className="pis-workspace" data-testid="pis-workspace-root" data-workspace-view={view} data-project-locked={projectLocked ? 'true' : 'false'}>
      <WorkspaceNavigation
        projectTitle={manuscript.title}
        saveStatus={saveStatus}
        syncStatus={syncStatus}
        totalWords={totalWords}
        account={account}
        onOpenTools={onOpenTools}
        onExport={onExport}
        view={view}
        projectLocked={projectLocked}
        activeAgentLabel={activeAgentLabel}
        onOpenAgents={onOpenAgents}
        onCloseAgents={onCloseAgents}
      />

      {view !== 'writing' && agenticContent
        ? <main className="pis-agentic-main" aria-label="Agentički workspace">{agenticContent}</main>
        : <div className="pis-columns" data-mobile-view={activeMobileView}>
          <nav className="pis-outline-column" aria-label="Struktura rada">{outline}</nav>
          <main className="pis-editor-column">{editor}</main>
          <aside className="pis-assistant-column" aria-label="Katedra urednik">{assistant}</aside>
        </div>}

      <MobileWorkspaceNav activeMobileView={activeMobileView} onMobileViewChange={onMobileViewChange} />
    </div>
  )
}
