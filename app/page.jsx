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

    // Register BEFORE initKatedraEngine(): its legacy hashchange listener must
    // never see a shared LektaResult before this bridge has reconciled and
    // converted it to the legacy internal shape. This also supports Katedra
    // already being open when a #lekta= fragment arrives in the same tab.
    const normalizeIncomingLektaHash = () => {
      normalizeLektaHandoffHashForLegacyEngine()
    }
    window.addEventListener('hashchange', normalizeIncomingLektaHash)
    normalizeIncomingLektaHash()

    initKatedraEngine()

    // USER_CHANGED becomes RECHECK_REQUIRED only when the user actually leaves
    // for a project-bound Lekta re-check. The incoming result then either
    // verifies disappearance or reopens the still-present finding.
    const removeRecheckLifecycle = installLektaRecheckLifecycle()

    return () => {
      window.removeEventListener('hashchange', normalizeIncomingLektaHash)
      removeRecheckLifecycle()
    }
  }, [])

  return (
    <div
      id="katedra-root"
      className="katedra-page"
      dangerouslySetInnerHTML={{ __html: KATEDRA_BODY_HTML }}
    />
  )
}
