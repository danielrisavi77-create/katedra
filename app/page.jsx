'use client'

import { useEffect } from 'react'
import { initKatedraEngine } from './katedra-engine'
import { KATEDRA_BODY_HTML } from './katedra-body'
import { ensureGuestProjectIdentity } from '@/lib/academic-suite/guest-project'
import { normalizeLektaHandoffHashForLegacyEngine } from '@/lib/academic-suite/handoff'
import { installLektaRecheckLifecycle } from '@/lib/academic-suite/reconciliation'
import './katedra-scoped.css'

const LEKTA_PRODUCTION_ORIGIN = 'https://lektahr.netlify.app'
const LEKTA_PAIRED_PREVIEW_ORIGIN = 'https://deploy-preview-25--lektahr.netlify.app'
const KATEDRA_PAIRED_PREVIEW_HOST = 'deploy-preview-1--katedra.netlify.app'

function pairedLektaPreviewUrl(value) {
  if (typeof window === 'undefined' || window.location.hostname !== KATEDRA_PAIRED_PREVIEW_HOST) return value
  if (typeof value !== 'string') return value

  try {
    const url = new URL(value, window.location.href)
    if (url.origin !== LEKTA_PRODUCTION_ORIGIN) return value
    const preview = new URL(LEKTA_PAIRED_PREVIEW_ORIGIN)
    url.protocol = preview.protocol
    url.host = preview.host
    return url.toString()
  } catch {
    return value
  }
}

export default function KatedraPage() {
  useEffect(() => {
    // Project identity exists before auth. Existing legacy `k...` projects are
    // preserved; new projects receive a canonical UUID before the vanilla
    // engine reads/writes its manifest.
    ensureGuestProjectIdentity()

    // During the paired PR smoke, the legacy engine still renders production
    // Lekta links. Rewrite only on Katedra Deploy Preview #1 so the browser
    // actually exercises Lekta PR #25, where the return-to-Katedra bridge lives.
    // Production Katedra remains pointed at production Lekta.
    const isPairedPreview = window.location.hostname === KATEDRA_PAIRED_PREVIEW_HOST
    const originalOpen = window.open
    let lektaLinkObserver = null

    if (isPairedPreview) {
      window.open = function patchedOpen(url, target, features) {
        return originalOpen.call(window, pairedLektaPreviewUrl(url), target, features)
      }
    }

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

    if (isPairedPreview) {
      const rewriteRenderedLektaLinks = () => {
        document.querySelectorAll(`a[href^="${LEKTA_PRODUCTION_ORIGIN}"]`).forEach(anchor => {
          const next = pairedLektaPreviewUrl(anchor.href)
          if (next !== anchor.href) anchor.href = next
        })
      }

      rewriteRenderedLektaLinks()
      const root = document.getElementById('katedra-root')
      if (root) {
        lektaLinkObserver = new MutationObserver(rewriteRenderedLektaLinks)
        lektaLinkObserver.observe(root, { childList: true, subtree: true })
      }
    }

    // USER_CHANGED becomes RECHECK_REQUIRED only when the user actually leaves
    // for a project-bound Lekta re-check. The incoming result then either
    // verifies disappearance or reopens the still-present finding.
    const removeRecheckLifecycle = installLektaRecheckLifecycle()

    return () => {
      window.removeEventListener('hashchange', normalizeIncomingLektaHash)
      removeRecheckLifecycle()
      lektaLinkObserver?.disconnect()
      if (isPairedPreview) window.open = originalOpen
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
