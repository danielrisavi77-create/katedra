'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const LEGAL_SUMMARIES = {
  uvjeti: {
    label: 'Uvjetima korištenja',
    title: 'Sažetak uvjeta korištenja',
    href: '/uvjeti',
    intro: 'Katedra je kopilot za izradu jednog akademskog rada. Ti ostaješ autor, provjeravaš izvore i odgovaraš za poštivanje pravila svog fakulteta.',
    points: [
      'Usluga je namijenjena osobama starijima od 18 godina.',
      'Pass vrijedi za jedan konkretan akademski rad i aktivira se nakon uspješne naplate.',
      'AI odgovori mogu sadržavati pogreške. Prije predaje moraš provjeriti sadržaj, izvore i formalna pravila.',
      'Kod plaćanja možeš izričito zatražiti početak usluge odmah; time se pravo na odustajanje može izgubiti kada je usluga izvršena.',
    ],
    note: 'Ovo je kratki pregled. Za potpune uvjete, iznimke i aktualne pravne napomene otvori cijeli dokument.',
  },
  privatnost: {
    label: 'Politikom privatnosti',
    title: 'Sažetak politike privatnosti',
    href: '/privatnost',
    intro: 'Podatke koristimo samo koliko je potrebno za račun, vođenje rada, naplatu, sigurnost i pružanje AI funkcionalnosti.',
    points: [
      'Račun koristi e-mail adresu; lozinku obrađuje Supabase Auth i Katedra je ne vidi u čitljivom obliku.',
      'Sadržaj koji pošalješ u Piši ovdje i priložene datoteke šalju se AI dobavljaču samo dok se generira odgovor.',
      'Stripe izravno obrađuje podatke kartice; Katedra ne vidi broj kartice.',
      'Imaš prava pristupa, ispravka, brisanja i prenosivosti podataka. Zahtjevi se šalju na privatnost@katedra.hr.',
    ],
    note: 'Ovo je kratki pregled. Puna politika navodi dobavljače, rokove čuvanja, prijenose podataka i sva prava korisnika.',
  },
}

export default function LegalSummaryModal({ type, triggerLabel }) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef(null)
  const summary = LEGAL_SUMMARIES[type]

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!summary) return null

  return (
    <>
      <button
        type="button"
        className="legal-inline-button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {triggerLabel || summary.label}
      </button>

      {open && (
        <div
          className="legal-modal-backdrop"
          data-legal-summary-modal
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <section
            ref={dialogRef}
            className="legal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`legal-summary-title-${type}`}
            aria-describedby={`legal-summary-description-${type}`}
            tabIndex={-1}
          >
            <button type="button" className="legal-modal-close" onClick={() => setOpen(false)} aria-label="Zatvori sažetak">
              ×
            </button>
            <p className="legal-kicker">Katedra · pravni pregled</p>
            <h2 id={`legal-summary-title-${type}`}>{summary.title}</h2>
            <p id={`legal-summary-description-${type}`} className="legal-modal-intro">{summary.intro}</p>
            <ul className="legal-modal-list">
              {summary.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
            <p className="legal-modal-note">{summary.note}</p>
            <div className="legal-modal-actions">
              <Link className="copy-btn" href={summary.href} onClick={() => setOpen(false)}>
                Otvori cijeli dokument
              </Link>
              <button type="button" className="onb-back legal-modal-secondary" onClick={() => setOpen(false)}>
                Zatvori
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
