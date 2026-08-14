'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'

import { ThemeToggle } from '../../theme-toggle'
import type { SyncStatus } from '../../../lib/manuscript/sync-status'
import type { WorkspaceView } from './workspace-shell'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle: 'Lokalni rukopis',
  saving: 'Spremanje…',
  saved: 'Spremljeno na ovom uređaju',
  error: 'Spremanje nije uspjelo',
}

const SYNC_LABELS: Record<SyncStatus, string> = {
  local_only: 'Samo na ovom uređaju',
  syncing: 'Sinkronizacija metapodataka…',
  synced: 'Metapodaci sinkronizirani',
  failed: 'Sinkronizacija nije uspjela',
}

const WORKSPACE_VIEW_LABELS: Record<WorkspaceView, string> = {
  preparation: 'Priprema rada',
  dashboard: 'Autonomni tijek',
  intervention: 'Intervencija',
  review: 'Pregled rezultata',
  writing: 'Radni prostor',
}

function WorkspaceBrand({ projectTitle }: { projectTitle: string }) {
  return (
    <Link className="pis-brand" href="/" aria-label="Katedra početna">
      <span className="pis-brand-mark" aria-hidden="true">K</span>
      <span>
        <b>Katedra</b>
        <small>{projectTitle || 'Rad bez naslova'}</small>
      </span>
    </Link>
  )
}

function WorkspaceOverflowMenu({ account, onOpenTools, onExport }: Pick<WorkspaceNavigationProps, 'account' | 'onOpenTools' | 'onExport'>) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
    }
  }, [open])

  return (
    <div className="pis-mobile-overflow" ref={wrapperRef}>
      <button
        type="button"
        className="pis-overflow-trigger"
        aria-label="Dodatne radnje"
        aria-expanded={open}
        aria-controls="pis-mobile-overflow-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">•••</span>
      </button>
      {open && (
        <div className="pis-overflow-menu" id="pis-mobile-overflow-menu" role="menu" aria-label="Dodatne radnje">
          <div className="pis-overflow-account">{account}</div>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenTools?.() }}>Projekt</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onExport() }}>Izvezi DOCX <span aria-hidden="true">↓</span></button>
        </div>
      )}
    </div>
  )
}

function WorkspaceActions({ saveStatus, syncStatus, totalWords, account, onOpenTools, onExport, view, projectLocked, activeAgentLabel }: Pick<WorkspaceNavigationProps, 'saveStatus' | 'syncStatus' | 'totalWords' | 'account' | 'onOpenTools' | 'onExport' | 'view' | 'projectLocked' | 'activeAgentLabel'>) {
  return (
    <div className="pis-topbar-actions">
      <div className="pis-save-state" data-state={saveStatus} role="status" aria-live="polite" title={SAVE_LABELS[saveStatus]}>
        <i aria-hidden="true" />
        <span className="pis-save-label">{SAVE_LABELS[saveStatus]}</span>
      </div>
      <div className="pis-sync-state" data-state={syncStatus} aria-label={SYNC_LABELS[syncStatus]} title="Tekst rukopisa ostaje na ovom uređaju">
        <i aria-hidden="true" />
        <span className="pis-sync-label">{SYNC_LABELS[syncStatus]}</span>
      </div>
      <span className="pis-word-total">{totalWords.toLocaleString('hr-HR')} riječi</span>
      <div className="pis-phase-state" aria-label="Trenutna faza rada">
        <b>{WORKSPACE_VIEW_LABELS[view || 'writing']}</b>
        {projectLocked && <span>Projekt zaključan</span>}
        {activeAgentLabel && <small>{activeAgentLabel}</small>}
      </div>
      <div className="pis-desktop-account">{account}</div>
      <ThemeToggle />
      <button type="button" className="pis-toolbar-button" onClick={onOpenTools}>Projekt</button>
      <button type="button" className="pis-export-button" onClick={onExport}>Izvezi DOCX <span aria-hidden="true">↓</span></button>
      <WorkspaceOverflowMenu account={account} onOpenTools={onOpenTools} onExport={onExport} />
    </div>
  )
}

export type WorkspaceNavigationProps = {
  projectTitle: string
  saveStatus: SaveStatus
  syncStatus: SyncStatus
  totalWords: number
  account?: ReactNode
  onOpenTools?: () => void
  onExport: () => void
  view?: WorkspaceView
  projectLocked?: boolean
  activeAgentLabel?: string
}

export function WorkspaceNavigation({ projectTitle, saveStatus, syncStatus, totalWords, account, onOpenTools, onExport, view, projectLocked, activeAgentLabel }: WorkspaceNavigationProps) {
  return (
    <header className="pis-topbar">
      <WorkspaceBrand projectTitle={projectTitle} />
      <WorkspaceActions saveStatus={saveStatus} syncStatus={syncStatus} totalWords={totalWords} account={account} onOpenTools={onOpenTools} onExport={onExport} view={view} projectLocked={projectLocked} activeAgentLabel={activeAgentLabel} />
    </header>
  )
}
