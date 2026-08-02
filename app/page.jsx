'use client'

import { useEffect } from 'react'
import { initKatedraEngine } from './katedra-engine'
import { KATEDRA_BODY_HTML } from './katedra-body'
import { ensureGuestProjectIdentity } from '@/lib/academic-suite/guest-project'
import { normalizeLektaHandoffHashForLegacyEngine } from '@/lib/academic-suite/handoff'
import './katedra-scoped.css'

export default function KatedraPage() {
  useEffect(() => {
    // Project identity exists before auth. Existing legacy `k...` projects are
    // preserved; new projects receive a canonical UUID before the vanilla
    // engine reads/writes its manifest.
    ensureGuestProjectIdentity()

    // Shared LektaResult v0.1 is the transport contract. The current vanilla
    // engine still consumes its legacy internal shape, so bridge it before init.
    normalizeLektaHandoffHashForLegacyEngine()

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
