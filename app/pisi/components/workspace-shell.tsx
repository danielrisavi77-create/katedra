'use client'

import type { ReactNode } from 'react'

import { countDocumentWords } from '../../../lib/manuscript/model'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'
import type { SyncStatus } from '../../../lib/manuscript/sync-status'
import { MobileWorkspaceNav } from './mobile-workspace-nav'
import { WorkspaceNavigation, type SaveStatus } from './workspace-navigation'

export type MobileView = 'outline' | 'editor' | 'assistant'
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
}) {
  const totalWords = manuscript.sections.reduce((sum, section) => sum + countDocumentWords(section.content), 0)

  return (
    <div className="pis-workspace">
      <WorkspaceNavigation
        projectTitle={manuscript.title}
        saveStatus={saveStatus}
        syncStatus={syncStatus}
        totalWords={totalWords}
        account={account}
        onOpenTools={onOpenTools}
        onExport={onExport}
      />

      <div className="pis-columns" data-mobile-view={activeMobileView}>
        <nav className="pis-outline-column" aria-label="Struktura rada">{outline}</nav>
        <main className="pis-editor-column">{editor}</main>
        <aside className="pis-assistant-column" aria-label="Katedra urednik">{assistant}</aside>
      </div>

      <MobileWorkspaceNav activeMobileView={activeMobileView} onMobileViewChange={onMobileViewChange} />
    </div>
  )
}
