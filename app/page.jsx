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
      dangerouslySetInnerHTML={{ __html: KATEDRA_BODY_HTML }}
    />
  )
}
