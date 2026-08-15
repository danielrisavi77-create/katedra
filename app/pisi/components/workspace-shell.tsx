'use client'

import type { ReactNode } from 'react'

import { countDocumentWords } from '../../../lib/manuscript/model'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'
import type { SyncStatus } from '../../../lib/manuscript/sync-status'
import { MobileWorkspaceNav } from './mobile-workspace-nav'
import { ProjectNavigation, type ProjectNavItem } from './project-navigation'
import { WorkspaceNavigation, type SaveStatus } from './workspace-navigation'

export type MobileView = 'overview' | 'editor' | 'assistant'
export type WorkspaceView = 'home' | 'preparation' | 'dashboard' | 'intervention' | 'review' | 'writing'
export type { SaveStatus } from './workspace-navigation'

export function normalizeMobileView(value: unknown): MobileView {
  if (value === 'outline' || value === 'overview') return 'overview'
  if (value === 'assistant') return 'assistant'
  return 'editor'
}

export function normalizeWorkspaceResumeState({
  projectHome,
  mobileView,
}: {
  projectHome: boolean
  mobileView: unknown
}): { projectHome: boolean; mobileView: MobileView } {
  return {
    projectHome,
    mobileView: projectHome ? 'overview' : normalizeMobileView(mobileView),
  }
}

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
  projectHome,
  view = 'writing',
  projectLocked = false,
  agenticContent,
  activeNavItem,
  onNavigate,
  workType,
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
  projectHome?: ReactNode
  view?: WorkspaceView
  onViewChange?: (view: WorkspaceView) => void
  projectLocked?: boolean
  activeAgentLabel?: string
  agenticContent?: ReactNode
  onOpenAgents?: () => void
  onCloseAgents?: () => void
  onOpenWriting?: () => void
  activeNavItem?: ProjectNavItem
  onNavigate?: (item: ProjectNavItem) => void
  workType?: 's' | 'z' | 'd'
}) {
  const totalWords = manuscript.sections.reduce((sum, section) => sum + countDocumentWords(section.content), 0)
  const effectiveMobileView = normalizeWorkspaceResumeState({ projectHome: view === 'home', mobileView: activeMobileView }).mobileView

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
      />

      <div className="pis-workspace-frame">
        {activeNavItem && onNavigate && workType && <ProjectNavigation activeItem={activeNavItem} onNavigate={onNavigate} workType={workType} />}
        <div className="pis-workspace-content">
      {view === 'home' && projectHome
        ? <main className="pis-project-home-main" aria-label="Projektna početna">{projectHome}</main>
        : view !== 'writing' && agenticContent
        ? <main className="pis-agentic-main" aria-label="Agentički workspace">{agenticContent}</main>
        : <div className="pis-writing-frame" data-testid="pis-writing-frame">
          <div className="pis-columns" data-mobile-view={effectiveMobileView}>
            <nav className="pis-outline-column" aria-label="Struktura rada">{outline}</nav>
            <main className="pis-editor-column">{editor}</main>
            <aside className="pis-assistant-column" aria-label="Katedra urednik">{assistant}</aside>
          </div>
        </div>}
        </div>
      </div>

      <MobileWorkspaceNav activeMobileView={effectiveMobileView} onMobileViewChange={onMobileViewChange} />
    </div>
  )
}
