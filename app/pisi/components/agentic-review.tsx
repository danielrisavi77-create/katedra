'use client'

import { documentText, plainTextDocument } from '../../../lib/manuscript/model'
import type { AgenticDraftV1 } from '../../../lib/manuscript/agentic-revisions'
import type { ManuscriptV1, TiptapNode } from '../../../lib/manuscript/types'

export function AgenticReview({ manuscript, draft, onAccept, onEdit, onReject }: { manuscript: ManuscriptV1; draft: AgenticDraftV1; onAccept: (sectionIds?: string[]) => Promise<void>; onEdit: (sectionId: string, content: TiptapNode) => void; onReject: (sectionId: string) => void }) {
  const verifiedIds = draft.sections.filter((revision) => isAcceptable(manuscript, revision)).map((revision) => revision.sectionId)
  return <section className="pis-agentic-review" aria-labelledby="pis-agentic-review-title">
    <header className="pis-agentic-dashboard-heading"><div><p className="pis-kicker">Tvoja potvrda</p><h2 id="pis-agentic-review-title">Pregled rezultata</h2><p>Prihvati samo ono što je prošlo verifikaciju. Sve ostalo možeš urediti, odbaciti ili vratiti u intervenciju.</p></div><span className="pis-agent-run-mode">{verifiedIds.length} spremno</span></header>
    <div className="pis-review-actions"><span>Glavni rukopis se još nije promijenio.</span><button type="button" className="is-primary" disabled={verifiedIds.length === 0} onClick={() => void onAccept()} aria-label="Prihvati sve provjerene">Prihvati sve provjerene</button></div>
    <div className="pis-review-list">{draft.sections.map((revision) => {
      const section = manuscript.sections.find((item) => item.id === revision.sectionId)
      if (!section) return <p key={revision.sectionId} className="pis-agent-message" role="alert">Sekcija nije pronađena u glavnom rukopisu.</p>
      const acceptable = isAcceptable(manuscript, revision)
      return <article key={revision.sectionId} className="pis-review-item" data-status={revision.status}>
        <header><div><p className="pis-kicker">{revision.status}</p><h3>{section.title}</h3></div><span>{acceptable ? 'Verificirano' : 'Ne može još u rukopis'}</span></header>
        <textarea aria-label={`Prijedlog za ${section.title}`} value={documentText(revision.proposedContent)} onChange={(event) => onEdit(section.id, plainTextDocument(event.target.value))} />
        {revision.verificationMessage && <p className="pis-review-verification">{revision.verificationMessage}</p>}
        <div className="pis-review-item-actions"><button type="button" className="is-primary" disabled={!acceptable} onClick={() => void onAccept([section.id])} aria-label={`Prihvati ${section.title}`}>Prihvati</button><button type="button" onClick={() => onReject(section.id)} aria-label={`Odbaci ${section.title}`}>Odbaci</button></div>
      </article>
    })}</div>
  </section>
}

function isAcceptable(manuscript: ManuscriptV1, revision: AgenticDraftV1['sections'][number]) {
  const section = manuscript.sections.find((item) => item.id === revision.sectionId)
  return Boolean(section && revision.status === 'verified' && revision.baseRevision === section.updatedAt)
}
