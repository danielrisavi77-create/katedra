'use client'

import { useState } from 'react'

import type { ManuscriptAiAction } from '../../../lib/manuscript/context'
import type { AiProposalV1 } from '../../../lib/manuscript/types'

const ACTIONS: Array<{ id: ManuscriptAiAction; label: string; hint: string }> = [
  { id: 'draft', label: 'Napiši nacrt sekcije', hint: 'Po outlineu i izvorima' },
  { id: 'expand', label: 'Razradi moj odlomak', hint: 'Za označeni tekst' },
  { id: 'shorten', label: 'Skrati označeno', hint: 'Bez gubitka tvrdnji' },
  { id: 'improve', label: 'Poboljšaj argument', hint: 'Jasnoća i akademski ton' },
  { id: 'review', label: 'Provjeri logiku i izvore', hint: 'Sadržajna recenzija' },
  { id: 'mentor', label: 'Objasni mentorov komentar', hint: 'Pretvori ga u zadatak' },
  { id: 'coach', label: 'Postavi mi pitanja', hint: 'Sokratsko vođenje' },
  { id: 'next', label: 'Pripremi sljedeći korak', hint: 'Jedna jasna radnja' },
]

export function AssistantPanel({
  sectionTitle,
  selectionText,
  proposal,
  error,
  busy,
  onRun,
  onAccept,
  onInsert,
  onReject,
  onEdit,
}: {
  sectionTitle: string
  selectionText?: string
  proposal: AiProposalV1 | null
  error?: string
  busy: boolean
  onRun: (action: ManuscriptAiAction, instruction?: string) => void
  onAccept: () => void
  onInsert: () => void
  onReject: () => void
  onEdit: (text: string) => void
}) {
  const [instruction, setInstruction] = useState('')

  return (
    <div className="pis-assistant">
      <div className="pis-panel-heading pis-assistant-heading">
        <p>Katedra · AI urednik</p>
        <h2>{selectionText ? 'Radim s označenim tekstom' : sectionTitle}</h2>
        <span className="pis-ai-disclosure">AI može pogriješiti · ti potvrđuješ svaku izmjenu</span>
      </div>

      {selectionText && <blockquote className="pis-selection-preview">„{selectionText.slice(0, 180)}{selectionText.length > 180 ? '…' : ''}”</blockquote>}

      {!proposal && (
        <div className="pis-action-list">
          {ACTIONS.map((action) => (
            <button type="button" key={action.id} disabled={busy || (['expand', 'shorten'].includes(action.id) && !selectionText)} onClick={() => onRun(action.id)}>
              <b>{action.label}</b><small>{action.hint}</small><span>→</span>
            </button>
          ))}
        </div>
      )}

      {proposal && (
        <section className={`pis-proposal is-${proposal.status}`} aria-live="polite">
          <div className="pis-proposal-label"><span>Prijedlog</span><b>{proposal.status === 'streaming' ? 'Katedra piše…' : proposal.status === 'stale' ? 'Tekst se u međuvremenu promijenio' : 'Čeka tvoju odluku'}</b></div>
          <textarea aria-label="Tekst AI prijedloga" value={proposal.proposedText} onChange={(event) => onEdit(event.target.value)} readOnly={proposal.status === 'streaming'} />
          {proposal.status === 'stale' ? (
            <p className="pis-proposal-warning">Prijedlog više ne odgovara trenutnoj verziji rukopisa. Odbaci ga i pokreni novu provjeru.</p>
          ) : proposal.status !== 'streaming' && (
            <div className="pis-proposal-actions">
              <button type="button" className="is-primary" onClick={onAccept}>Prihvati</button>
              <button type="button" onClick={onInsert}>Umetni ispod</button>
              <button type="button" onClick={onReject}>Odbaci</button>
            </div>
          )}
        </section>
      )}

      {error && <div className="pis-assistant-error" role="alert">{error}</div>}

      <form className="pis-custom-prompt" onSubmit={(event) => { event.preventDefault(); if (instruction.trim()) { onRun('improve', instruction.trim()); setInstruction('') } }}>
        <label htmlFor="pis-custom-instruction">Pitaj Katedru o ovoj sekciji</label>
        <div><textarea id="pis-custom-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="npr. Je li prijelaz između ova dva argumenta dovoljno jasan?" /><button type="submit" disabled={busy || !instruction.trim()}>↑</button></div>
      </form>
    </div>
  )
}
