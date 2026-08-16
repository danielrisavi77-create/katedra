'use client'

import { useRef, useState } from 'react'

import { documentText, plainTextDocument } from '../../../lib/manuscript/model'
import type { AgenticDraftV1 } from '../../../lib/manuscript/agentic-revisions'
import type { ManuscriptV1, TiptapNode } from '../../../lib/manuscript/types'
import { isSafeManuscriptHref } from '../../../lib/manuscript/links'

export type AgenticReviewEvidence = { id: string; title?: string; authors?: string; url?: string; doi?: string; verified?: boolean; status?: string }
export type AgenticReviewSupport = { citationId: string; quote: string; locator?: string }
export type AgenticReviewClaim = { id: string; text: string; citationIds: string[]; support?: AgenticReviewSupport[] }
export type AgenticReviewRevision = AgenticDraftV1['sections'][number] & { evidence?: AgenticReviewEvidence[]; claims?: AgenticReviewClaim[] }
export type AgenticReviewDraft = Omit<AgenticDraftV1, 'sections'> & { sections: AgenticReviewRevision[] }

export function AgenticReview({ manuscript, draft, onAccept, onEdit, onReject }: { manuscript: ManuscriptV1; draft: AgenticReviewDraft; onAccept: (sectionIds?: string[]) => Promise<boolean>; onEdit: (sectionId: string, content: TiptapNode) => void; onReject: (sectionId: string) => void }) {
  const [acceptedSectionIds, setAcceptedSectionIds] = useState<Set<string>>(() => new Set())
  const verifiedIds = draft.sections.filter((revision) => !acceptedSectionIds.has(revision.sectionId) && isAcceptable(manuscript, revision)).map((revision) => revision.sectionId)
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({})

  const accept = async (sectionIds?: string[]) => {
    const acceptedIds = sectionIds || verifiedIds
    if (acceptedIds.length === 0) return
    const accepted = sectionIds ? await onAccept(sectionIds) : await onAccept()
    if (!accepted) return false
    setAcceptedSectionIds((current) => new Set([...current, ...acceptedIds]))
    return true
  }

  return <section className="pis-agentic-review" aria-labelledby="pis-agentic-review-title">
    <header className="pis-agentic-dashboard-heading"><div><p className="pis-kicker">Tvoja potvrda</p><h2 id="pis-agentic-review-title">Pregled rezultata</h2><p>Pregledaj izvore i prijedloge. Automatska provjera potvrđuje strukturu i dokazni trag, ali ne potvrđuje sama istinitost tvrdnje; glavni rukopis se do tada ne mijenja.</p></div><span className="pis-agent-run-mode">{verifiedIds.length} spremno</span></header>
    <div className="pis-review-actions"><span>Glavni rukopis se još nije promijenio.</span><button type="button" className="is-primary" disabled={verifiedIds.length === 0} onClick={() => void accept()} aria-label="Prihvati sve spremne za pregled">Prihvati sve spremne za pregled</button></div>
    <div className="pis-review-list">{draft.sections.map((revision) => {
      const section = manuscript.sections.find((item) => item.id === revision.sectionId)
      if (!section) return <p key={revision.sectionId} className="pis-agent-message" role="alert">Sekcija nije pronađena u glavnom rukopisu.</p>
      const locallyAccepted = acceptedSectionIds.has(revision.sectionId) || revision.status === 'accepted'
      const acceptable = !locallyAccepted && isAcceptable(manuscript, revision)
      const canReview = !locallyAccepted && !['accepted', 'rejected'].includes(revision.status)
      const evidence = revision.evidence || []
      return <article key={revision.sectionId} className="pis-review-item" data-status={revision.status}>
        <header><div><p className="pis-kicker">{locallyAccepted ? 'Prihvaćeno' : reviewStatus(revision.status)}</p><h3>{section.title}</h3></div><span>{locallyAccepted ? 'Prihvaćeno' : acceptable ? 'Spremno za pregled' : 'Pregledaj rezultat'}</span></header>
        <div className="pis-review-diff" aria-label={`Usporedba s rukopisom za ${section.title}`}>
          <div className="pis-review-diff-heading"><strong>Usporedba s rukopisom</strong><span>{documentText(section.content) === documentText(revision.proposedContent) ? 'Bez promjene' : 'Prijedlog mijenja tekst'}</span></div>
          <div className="pis-review-diff-columns">
            <div className="pis-review-diff-version is-current"><span>Trenutna verzija</span><p>{documentText(section.content) || 'Sekcija još nema tekst.'}</p></div>
            <div className="pis-review-diff-version is-proposed"><span>Novi prijedlog</span><p>{documentText(revision.proposedContent) || 'Prijedlog nema tekst.'}</p></div>
          </div>
        </div>
        <textarea ref={(element) => { textareas.current[section.id] = element }} aria-label={`Prijedlog za ${section.title}`} value={documentText(revision.proposedContent)} onChange={(event) => onEdit(section.id, plainTextDocument(event.target.value))} readOnly={!canReview} />
        <div className="pis-review-evidence" aria-label={`Izvori za ${section.title}`}>
          <strong>Izvori i dokazi</strong>
          {evidence.length > 0 ? <ul>{evidence.map((item) => <li key={item.id}><span>{item.title || item.url || item.doi || 'Neimenovani izvor'}</span>{item.authors && <small>{item.authors}</small>}{item.url && isSafeManuscriptHref(item.url) && <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>}{item.doi && <small>DOI: {item.doi}</small>}<em>{item.verified ? 'Identitet izvora provjeren' : item.status || 'Potrebna provjera'}</em></li>)}</ul> : <p>Nema priloženih izvora za ovaj rezultat.</p>}
        </div>
        {revision.claims && revision.claims.length > 0 && <div className="pis-review-claims" aria-label={`Tvrdnje i dokazni trag za ${section.title}`}>
          <div className="pis-review-claims-heading"><strong>Tvrdnje i dokazni trag</strong><span>{revision.claims.length} tvrdnji</span></div>
          <p className="pis-review-claims-note">Odlomak je trag za ručnu provjeru, nije automatski dokaz istinitosti tvrdnje.</p>
          <ol>{revision.claims.map((claim) => <li key={claim.id}>
            <p className="pis-review-claim-text">{claim.text}</p>
            <small>Izvor: {claim.citationIds.join(', ') || 'nije povezan'}</small>
            {claim.support && claim.support.length > 0 ? <ul className="pis-review-support-list">{claim.support.map((support, index) => <li key={`${support.citationId}-${index}`}><q>{support.quote}</q>{support.locator && <span>{support.locator}</span>}</li>)}</ul> : <em className="pis-review-claim-missing">Nema priloženog odlomka za provjeru.</em>}
          </li>)}</ol>
        </div>}
        {revision.verificationMessage && <p className="pis-review-verification"><strong>{revision.status === 'blocked' ? 'Potrebna provjera · ' : ''}Automatska provjera</strong> {revision.verificationMessage}</p>}
        {canReview && <div className="pis-review-item-actions"><button type="button" onClick={() => textareas.current[section.id]?.focus()} aria-label={`Uredi ${section.title}`}>Uredi</button><button type="button" className="is-primary" disabled={!acceptable} onClick={() => void accept([section.id])} aria-label={`Prihvati ${section.title}`}>Prihvati</button><button type="button" onClick={() => onReject(section.id)} aria-label={`Odbaci ${section.title}`}>Odbaci</button></div>}
      </article>
    })}</div>
  </section>
}

function isAcceptable(manuscript: ManuscriptV1, revision: AgenticDraftV1['sections'][number]) {
  const section = manuscript.sections.find((item) => item.id === revision.sectionId)
  return Boolean(section && revision.status === 'verified' && revision.baseRevision === section.updatedAt)
}

function reviewStatus(status: AgenticDraftV1['sections'][number]['status']): string {
  return ({
    generated: 'Čeka provjeru',
    verified: 'Strukturno provjereno',
    blocked: 'Potrebna provjera',
    stale: 'Zastarjelo',
    accepted: 'Prihvaćeno',
    rejected: 'Odbačeno',
  } as Record<string, string>)[status] || 'Pregled rezultata'
}
