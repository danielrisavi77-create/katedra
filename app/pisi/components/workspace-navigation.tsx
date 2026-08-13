'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'

import { ThemeToggle } from '../../theme-toggle'
import type { SyncStatus } from '../../../lib/manuscript/sync-status'

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

function WorkspaceContext({ activeSectionTitle, saveStatus, syncStatus }: Pick<WorkspaceNavigationProps, 'activeSectionTitle' | 'saveStatus' | 'syncStatus'>) {
  return (
    <div className="pis-workspace-nav-context">
      <span className="pis-active-section" title={activeSectionTitle}>{activeSectionTitle}</span>
      <div className="pis-save-state" data-state={saveStatus} role="status" aria-live="polite">
        <i aria-hidden="true" />
        <span>{SAVE_LABELS[saveStatus]}</span>
      </div>
      <div className="pis-sync-state" data-state={syncStatus} title="Tekst rukopisa ostaje na ovom uređaju">
        <i aria-hidden="true" />
        <span>{SYNC_LABELS[syncStatus]}</span>
      </div>
    </div>
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

function WorkspaceActions({ totalWords, account, onOpenTools, onExport }: Pick<WorkspaceNavigationProps, 'totalWords' | 'account' | 'onOpenTools' | 'onExport'>) {
  return (
    <div className="pis-topbar-actions">
      <span className="pis-word-total">{totalWords.toLocaleString('hr-HR')} riječi</span>
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
  activeSectionTitle: string
  saveStatus: SaveStatus
  syncStatus: SyncStatus
  totalWords: number
  account?: ReactNode
  onOpenTools?: () => void
  onExport: () => void
}

export function WorkspaceNavigation({ projectTitle, activeSectionTitle, saveStatus, syncStatus, totalWords, account, onOpenTools, onExport }: WorkspaceNavigationProps) {
  return (
    <header className="pis-topbar">
      <WorkspaceBrand projectTitle={projectTitle} />
      <WorkspaceContext activeSectionTitle={activeSectionTitle} saveStatus={saveStatus} syncStatus={syncStatus} />
      <WorkspaceActions totalWords={totalWords} account={account} onOpenTools={onOpenTools} onExport={onExport} />
    </header>
  )
}
