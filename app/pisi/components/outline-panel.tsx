'use client'

import { useMemo, useState } from 'react'

import { countDocumentWords, documentText } from '../../../lib/manuscript/model'
import type { ManuscriptSectionStatus, ManuscriptV1 } from '../../../lib/manuscript/types'

const STATUS_LABELS: Record<ManuscriptSectionStatus, string> = {
  empty: 'Prazno',
  draft: 'Nacrt',
  review: 'Pregled',
  approved: 'Odobreno',
}

export function OutlinePanel({
  manuscript,
  onActivate,
  onAdd,
  onMove,
  onRemove,
  onRename,
  onStatus,
}: {
  manuscript: ManuscriptV1
  onActivate: (sectionId: string) => void
  onAdd: () => void
  onMove: (sectionId: string, offset: -1 | 1) => void
  onRemove: (sectionId: string) => void
  onRename: (sectionId: string, title: string) => void
  onStatus: (sectionId: string, status: ManuscriptSectionStatus) => void
}) {
  const [query, setQuery] = useState('')
  const visibleSections = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('hr')
    if (!needle) return manuscript.sections
    return manuscript.sections.filter((section) =>
      `${section.title}\n${documentText(section.content)}`.toLocaleLowerCase('hr').includes(needle),
    )
  }, [manuscript.sections, query])

  return (
    <div className="pis-outline">
      <div className="pis-panel-heading">
        <p>Rukopis</p>
        <h2>Sadržaj rada</h2>
      </div>
      <label className="pis-outline-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Traži u rukopisu" aria-label="Traži u rukopisu" />
      </label>
      <ol className="pis-section-list">
        {visibleSections.map((section) => {
          const active = section.id === manuscript.activeSectionId
          return (
            <li key={section.id} className={active ? 'is-active' : ''}>
              <button type="button" className="pis-section-open" onClick={() => onActivate(section.id)}>
                <span>{String(section.order + 1).padStart(2, '0')}</span>
                <b>{section.title}</b>
                <small>{countDocumentWords(section.content)} riječi · {STATUS_LABELS[section.status]}</small>
              </button>
              {active && (
                <div className="pis-section-controls">
                  <input aria-label="Naziv aktivnog poglavlja" value={section.title} onChange={(event) => onRename(section.id, event.target.value)} />
                  <select aria-label="Status aktivnog poglavlja" value={section.status} onChange={(event) => onStatus(section.id, event.target.value as ManuscriptSectionStatus)}>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <div>
                    <button type="button" onClick={() => onMove(section.id, -1)} aria-label="Pomakni poglavlje gore">↑</button>
                    <button type="button" onClick={() => onMove(section.id, 1)} aria-label="Pomakni poglavlje dolje">↓</button>
                    <button type="button" onClick={() => onRemove(section.id)} aria-label="Ukloni poglavlje">×</button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <button type="button" className="pis-add-section" onClick={onAdd}><span>＋</span> Dodaj poglavlje</button>
      <div className="pis-outline-note">
        <b>Sljedeći korak</b>
        <p>{nextStep(manuscript)}</p>
      </div>
    </div>
  )
}

function nextStep(manuscript: ManuscriptV1): string {
  const firstEmpty = manuscript.sections.find((section) => section.status === 'empty')
  if (firstEmpty) return `Napiši početni nacrt: ${firstEmpty.title}.`
  const review = manuscript.sections.find((section) => section.status === 'draft')
  if (review) return `Pregledaj argument i izvore u sekciji: ${review.title}.`
  return 'Izvezi rad i provjeri DOCX u Lekti.'
}
