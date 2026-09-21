'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'

import type { ManuscriptAiAction, ManuscriptMaterialContext } from '../../../lib/manuscript/context'
import type { AiProposalV1 } from '../../../lib/manuscript/types'

const MATERIAL_ACCEPT = '.docx,.pdf,.txt,.md,image/*'

export function WritingComposer({
  sectionTitle,
  selectionText,
  proposal,
  busy = false,
  onRun,
  onUpload,
  materials,
  onRemoveUpload,
  onAccept,
  onInsert,
  onReject,
  onEdit,
}: {
  sectionTitle: string
  selectionText?: string
  proposal?: AiProposalV1 | null
  busy?: boolean
  onRun: (action: ManuscriptAiAction, instruction?: string) => void
  onUpload?: (file: File) => Promise<{ warnings?: string[] } | void>
  materials?: ManuscriptMaterialContext[]
  onRemoveUpload?: (name: string) => void
  onAccept?: () => void
  onInsert?: () => void
  onReject?: () => void
  onEdit?: (text: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [requestType, setRequestType] = useState<ManuscriptAiAction>('question')
  const [localAttachments, setLocalAttachments] = useState<string[]>([])
  const [localAttachmentWarnings, setLocalAttachmentWarnings] = useState<Record<string, string[]>>({})
  const [removedAttachments, setRemovedAttachments] = useState<string[]>([])
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const effectiveRequestType = !selectionText && (requestType === 'expand' || requestType === 'shorten') ? 'question' : requestType

  const attachments = Array.from(new Set([...(materials || []).map((material) => material.name), ...localAttachments])).filter((name) => !removedAttachments.includes(name))
  const attachmentWarnings = Object.fromEntries([
    ...(materials || []).map((material) => [material.name, material.warnings || []] as const),
    ...Object.entries(localAttachmentWarnings),
  ])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const instruction = prompt.trim()
    if (!instruction || busy) return
    onRun(effectiveRequestType, instruction)
    setPrompt('')
  }

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length || !onUpload) return
    setUploading(true)
    setUploadError('')
    const failed: string[] = []
    try {
      for (const file of files) {
        try {
          const result = await onUpload(file)
          setLocalAttachments((current) => current.includes(file.name) ? current : [...current, file.name])
          setLocalAttachmentWarnings((current) => ({ ...current, [file.name]: result && result.warnings ? result.warnings : [] }))
          setRemovedAttachments((current) => current.filter((name) => name !== file.name))
        } catch {
          failed.push(file.name)
        }
      }
      if (failed.length) {
        setUploadError(`Nije moguće dodati: ${failed.join(', ')}.`)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="pis-writing-composer-area">
      {selectionText && <blockquote className="pis-selection-preview">„{selectionText.slice(0, 180)}{selectionText.length > 180 ? '…' : ''}”</blockquote>}
      <form className="pis-writing-composer" onSubmit={submit}>
        <div className="pis-writing-composer-heading">
          <label htmlFor="pis-writing-prompt">Pitaj Katedru</label>
          <span>Aktivna sekcija: {sectionTitle}</span>
        </div>
        <label className="pis-writing-composer-type">
          <span>Vrsta zahtjeva</span>
          <select aria-label="Vrsta zahtjeva" value={effectiveRequestType} onChange={(event) => setRequestType(event.target.value as ManuscriptAiAction)}>
            <option value="question">Odgovori na pitanje</option>
            <option value="improve">Poboljšaj tekst</option>
            <option value="draft">Napiši nacrt sekcije</option>
            <option value="expand" disabled={!selectionText}>Razradi označeno</option>
            <option value="shorten" disabled={!selectionText}>Skrati označeno</option>
            <option value="review">Pregledaj logiku i izvore</option>
            <option value="mentor">Pretvori mentorov komentar u plan</option>
            <option value="coach">Postavi mi pitanja</option>
            <option value="next">Predloži sljedeći korak</option>
          </select>
        </label>
        <textarea id="pis-writing-prompt" aria-label="Pitaj Katedru" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Napiši pitanje ili naredbu za ovu sekciju…" />
        <div className="pis-writing-composer-footer">
          <div className="pis-writing-composer-tools">
            {onUpload && <label className="pis-chat-upload" title="Dodaj materijal">
              <span aria-hidden="true">+</span>
              <input type="file" multiple accept={MATERIAL_ACCEPT} aria-label="Dodaj materijal u chat" disabled={uploading} onChange={(event) => void upload(event)} />
            </label>}
            {attachments.length > 0 && <ul className="pis-chat-attachments" aria-label="Dodani materijali">
              {attachments.map((name, index) => <li key={`${name}-${index}`}><span title={name}>{name}</span>{attachmentWarnings[name]?.map((warning) => <small key={warning}>{warning}</small>)}<button type="button" aria-label={`Ukloni materijal ${name}`} onClick={() => { setRemovedAttachments((current) => current.includes(name) ? current : [...current, name]); setLocalAttachments((current) => current.filter((entry) => entry !== name)); setLocalAttachmentWarnings((current) => { const next = { ...current }; delete next[name]; return next }); onRemoveUpload?.(name) }}>×</button></li>)}
            </ul>}
            {uploading && <small>Dodajem materijal…</small>}
          </div>
          <button type="submit" className="is-primary" disabled={busy || !prompt.trim()}>Pošalji</button>
        </div>
        {uploadError && <p className="pis-assistant-error" role="alert">{uploadError}</p>}
      </form>

      {proposal && <section className={`pis-proposal is-${proposal.status}`} aria-live="polite">
        <div className="pis-proposal-label"><span>Prijedlog</span><b>{proposal.status === 'streaming' ? 'Katedra piše…' : proposal.status === 'stale' ? 'Tekst se u međuvremenu promijenio' : 'Čeka tvoju odluku'}</b></div>
        <textarea aria-label="Tekst AI prijedloga" value={proposal.proposedText} onChange={(event) => onEdit?.(event.target.value)} readOnly={proposal.status === 'streaming'} />
        {proposal.status === 'stale' ? <>
          <p className="pis-proposal-warning">Prijedlog više ne odgovara trenutnoj verziji rukopisa. Odbaci ga i pokreni novu provjeru.</p>
          <div className="pis-proposal-actions"><button type="button" onClick={onReject}>Odbaci</button></div>
        </> : proposal.status !== 'streaming' && <div className="pis-proposal-actions">
          <button type="button" className="is-primary" onClick={onAccept}>Prihvati</button>
          <button type="button" onClick={onInsert}>Umetni ispod</button>
          <button type="button" onClick={onReject}>Odbaci</button>
        </div>}
      </section>}
    </div>
  )
}
