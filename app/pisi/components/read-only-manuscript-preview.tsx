'use client'

import { documentText } from '../../../lib/manuscript/model'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'

export function ReadOnlyManuscriptPreview({ manuscript }: { manuscript: ManuscriptV1 }) {
  return (
    <section className="pis-readonly-preview" aria-label="Read-only pregled">
      <header className="pis-readonly-preview-heading">
        <div><p className="pis-kicker">Dokument</p><h3>{manuscript.title || 'Rad bez naslova'}</h3></div>
        <span>Read-only pregled</span>
      </header>
      <article className="pis-readonly-paper">
        {manuscript.sections.map((section) => (
          <section key={section.id} className="pis-readonly-section">
            <div className="pis-readonly-section-meta"><span>{String(section.order + 1).padStart(2, '0')}</span><em>{section.status}</em></div>
            <h4>{section.title}</h4>
            <div className="pis-readonly-content">{documentText(section.content) || <span className="is-empty">Sekcija još nema tekst.</span>}</div>
          </section>
        ))}
      </article>
      <p className="pis-readonly-note">Ovaj pregled prikazuje checkpoint rukopisa. Agenti ne mogu prepisati tvoj glavni lokalni rukopis bez tvog prihvaćanja.</p>
    </section>
  )
}
