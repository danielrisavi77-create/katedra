'use client'

import { useEffect } from 'react'
import { initKatedraEngine } from './katedra-engine'
import { KATEDRA_BODY_HTML } from './katedra-body'
import { ensureGuestProjectIdentity } from '@/lib/academic-suite/guest-project'
import { normalizeLektaHandoffHashForLegacyEngine } from '@/lib/academic-suite/handoff'
import { installLektaRecheckLifecycle } from '@/lib/academic-suite/reconciliation'
import './katedra-scoped.css'

export default function KatedraPage() {
  useEffect(() => {
    // Project identity exists before auth. Existing legacy `k...` projects are
    // preserved; new projects receive a canonical UUID before the vanilla
    // engine reads/writes its manifest.
    ensureGuestProjectIdentity()

    // Shared LektaResult v0.1 is the transport contract. Reconciliation runs
    // before the current vanilla engine consumes its compatibility payload.
    normalizeLektaHandoffHashForLegacyEngine()

    initKatedraEngine()

    // USER_CHANGED becomes RECHECK_REQUIRED only when the user actually leaves
    // for a project-bound Lekta re-check. The incoming result then either
    // verifies disappearance or reopens the still-present finding.
    return installLektaRecheckLifecycle()
  }, [])

  return (
    <div
      id="katedra-root"
      className="katedra-page"
      dangerouslySetInnerHTML={{ __html: KATEDRA_BODY_HTML }}
    />
  )
}
