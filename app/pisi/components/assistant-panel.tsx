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

const HELPERS: Array<{ title: string; description: string; action?: ManuscriptAiAction; instruction?: string }> = [
  { title: 'Sljedeći najbolji korak', description: 'Jedna jasna radnja za nastavak rada.', action: 'next', instruction: 'Odredi jedan najvažniji sljedeći korak za ovu sekciju.' },
  { title: 'Usporedi izmjene', description: 'Pripremi pregled onoga što bi trebalo promijeniti.', action: 'review', instruction: 'Pripremi pregled izmjena i objasni što bi trebalo poboljšati u ovoj sekciji.' },
  { title: 'Poveži tvrdnju s izvorom', description: 'Pronađi tvrdnje koje trebaju dokaz.', action: 'review', instruction: 'Izdvoji glavnu tvrdnju ove sekcije i predloži kako je povezati s provjerenim izvorom.' },
  { title: 'Analiziraj materijale', description: 'Poveži dodane materijale s aktivnim poglavljem.', action: 'review', instruction: 'Analiziraj dostupni kontekst za ovu sekciju i reci što iz njega treba iskoristiti.' },
  { title: 'Pretvori medij u bilješke', description: 'Izvuci korisne ideje iz dodanog materijala.', action: 'improve', instruction: 'Pretvori relevantan dodani materijal u kratke bilješke za ovu sekciju.' },
  { title: 'Provjeri zdravlje poglavlja', description: 'Provjeri logiku, strukturu i izvore.', action: 'review', instruction: 'Napravi brzi health check ove sekcije: logika, struktura, izvori i prijelaz.' },
  { title: 'Mentorska pitanja', description: 'Vodi me pitanjima umjesto gotovim tekstom.', action: 'coach', instruction: 'Postavi mi tri mentorska pitanja koja će mi pomoći dovršiti ovu sekciju.' },
  { title: 'Što Katedra zna', description: 'Sažmi kontekst koji trenutno koristiš.', action: 'next', instruction: 'Sažmi što trenutno znaš o ovoj sekciji i koje pretpostavke koristiš.' },
  { title: 'Povijest revizija', description: 'Pripremi što treba usporediti s prethodnom verzijom.', action: 'review', instruction: 'Predloži kako usporediti ovu verziju s prethodnom i koje promjene treba posebno provjeriti.' },
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
  onToggleFocus,
  initialTab = 'context',
  showProposal = true,
  showPrompt = true,
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
  onToggleFocus?: () => void
  initialTab?: 'context' | 'helpers'
  showProposal?: boolean
  showPrompt?: boolean
}) {
  const [instruction, setInstruction] = useState('')
  const [tab, setTab] = useState<'context' | 'helpers'>(initialTab)

  return (
    <section className="pis-assistant" aria-label="Urednik sekcije" data-context-surface="assistant">
      <div className="pis-panel-heading pis-assistant-heading">
        <p>Katedra · kontekst</p>
        <h2>{selectionText ? 'Radim s označenim tekstom' : sectionTitle}</h2>
        <span className="pis-ai-disclosure">Prijedlog nije dio rukopisa dok ga ti ne potvrdiš. Ti potvrđuješ svaku izmjenu.</span>
      </div>

      <div className="pis-panel-tabs" role="tablist" aria-label="Katedra alati">
        <button type="button" role="tab" aria-selected={tab === 'context'} onClick={() => setTab('context')}>Kontekst</button>
        <button type="button" role="tab" aria-selected={tab === 'helpers'} onClick={() => setTab('helpers')}>Pomagala</button>
      </div>

      {tab === 'context' && <>
        {selectionText && <blockquote className="pis-selection-preview">„{selectionText.slice(0, 180)}{selectionText.length > 180 ? '…' : ''}”</blockquote>}
        {!proposal && <div className="pis-action-list">
          {ACTIONS.map((action) => <button type="button" key={action.id} disabled={busy || (['expand', 'shorten'].includes(action.id) && !selectionText)} onClick={() => onRun(action.id)}><b>{action.label}</b><small>{action.hint}</small><span>→</span></button>)}
        </div>}
        {showProposal && proposal && <Proposal proposal={proposal} onAccept={onAccept} onInsert={onInsert} onReject={onReject} onEdit={onEdit} />}
        {error && <div className="pis-assistant-error" role="alert">{error}</div>}
        {showPrompt && <form className="pis-custom-prompt" onSubmit={(event) => { event.preventDefault(); if (instruction.trim()) { onRun('improve', instruction.trim()); setInstruction('') } }}>
          <label htmlFor="pis-custom-instruction">Pitaj Katedru o ovoj sekciji</label>
          <div><textarea id="pis-custom-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="npr. Je li prijelaz između ova dva argumenta dovoljno jasan?" /><button type="submit" disabled={busy || !instruction.trim()}>↑</button></div>
        </form>}
      </>}

      {tab === 'helpers' && <div className="pis-helper-list">
        <p className="pis-helper-intro">Pomagala za aktivnu sekciju. Rezultat se vraća u chat iznad rukopisa gdje ga možeš pregledati.</p>
        {HELPERS.map((helper, index) => <button type="button" key={helper.title} onClick={() => helper.action ? onRun(helper.action, helper.instruction) : onToggleFocus?.()}><span>{String(index + 1).padStart(2, '0')}</span><strong>{helper.title}</strong><small>{helper.description}</small><em aria-hidden="true">→</em></button>)}
        {onToggleFocus && <button type="button" onClick={onToggleFocus}><span>10</span><strong>Fokus način rada</strong><small>Sakrij pomoćne stupce i ostavi samo rukopis.</small><em aria-hidden="true">→</em></button>}
      </div>}
    </section>
  )
}

function Proposal({ proposal, onAccept, onInsert, onReject, onEdit }: { proposal: AiProposalV1; onAccept: () => void; onInsert: () => void; onReject: () => void; onEdit: (text: string) => void }) {
  return <section className={`pis-proposal is-${proposal.status}`} aria-live="polite">
    <div className="pis-proposal-label"><span>Prijedlog</span><b>{proposal.status === 'streaming' ? 'Katedra piše…' : proposal.status === 'stale' ? 'Tekst se u međuvremenu promijenio' : 'Čeka tvoju odluku'}</b></div>
    <textarea aria-label="Tekst AI prijedloga" value={proposal.proposedText} onChange={(event) => onEdit(event.target.value)} readOnly={proposal.status === 'streaming'} />
    {proposal.status === 'stale' ? <><p className="pis-proposal-warning">Prijedlog više ne odgovara trenutnoj verziji rukopisa. Odbaci ga i pokreni novu provjeru.</p><div className="pis-proposal-actions"><button type="button" onClick={onReject}>Odbaci</button></div></> : proposal.status !== 'streaming' && <div className="pis-proposal-actions"><button type="button" className="is-primary" onClick={onAccept}>Prihvati</button><button type="button" onClick={onInsert}>Umetni ispod</button><button type="button" onClick={onReject}>Odbaci</button></div>}
  </section>
}
