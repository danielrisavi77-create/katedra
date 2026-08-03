'use client'

import { useEffect } from 'react'
import { initKatedraEngine } from './katedra-engine'
import { KATEDRA_BODY_HTML } from './katedra-body'
import './katedra-scoped.css'

export default function KatedraPage() {
  useEffect(() => {
    initKatedraEngine()
  }, [])

  return (
    <div
      id="katedra-root"
      className="katedra-page"
      // Zadana koža. Stoji već u serverskom HTML-u da nema bljeska stare
      // palete prije nego engine primijeni korisnikov spremljeni izbor.
      data-skin="kreda"
      // Zadani ekran. Faza 0 tvrdo postavlja radnu ploču da se ponašanje ne
      // mijenja; uvodni ekrani preuzimaju zadano tek u fazi 4.
      data-screen="ploca"
      data-chrome="board"
      dangerouslySetInnerHTML={{ __html: KATEDRA_BODY_HTML }}
    />
  )
}
