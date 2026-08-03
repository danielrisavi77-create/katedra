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
      dangerouslySetInnerHTML={{ __html: KATEDRA_BODY_HTML }}
    />
  )
}
