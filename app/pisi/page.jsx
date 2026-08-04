'use client'

import { useEffect } from 'react'
import { initKatedraEngine } from '../katedra-engine'
import { KATEDRA_BODY_HTML } from '../katedra-body'
import { ensureGuestProjectIdentity } from '@/lib/academic-suite/guest-project'
import { normalizeLektaHandoffHashForLegacyEngine } from '@/lib/academic-suite/handoff'
import { installLektaRecheckLifecycle } from '@/lib/academic-suite/reconciliation'
import { installKatedraProductBoundary } from '@/lib/academic-suite/product-boundary'
import '../katedra-scoped.css'

const LEKTA_PRODUCTION_ORIGIN = 'https://lektahr.netlify.app'
const LEKTA_PAIRED_PREVIEW_ORIGIN = 'https://deploy-preview-25--lektahr.netlify.app'
const KATEDRA_PAIRED_PREVIEW_HOST = 'deploy-preview-1--katedra.netlify.app'

// Ekran i koža čitaju se prije prvog painta kako povratnik ne bi vidio
// kratki flash uvodnog ekrana ili zadane kože. `?screen=` u URL-u (npr.
// landing-page CTA "Provjeri bez prijave" → /pisi?screen=scan) ima prednost
// nad spremljenim rp_screen — svjež klik s eksplicitnom namjerom nadjačava
// staro stanje, ne obrnuto.
const BOOT = `(function(){try{
var r=document.getElementById('katedra-root');if(!r)return;
var CH={tip:'funnel',gdje:'funnel',pitanja:'funnel',fakultet:'fak',ploca:'board',chat:'board',povratak:'funnel',scan:'funnel'};
var params=new URLSearchParams(location.search);
var qs=params.get('screen');
var tp=params.get('tip');
var s=(qs&&CH[qs])?qs:(tp&&['s','z','d'].indexOf(tp)>-1?'pitanja':localStorage.getItem('rp_screen'));
if(!s&&localStorage.getItem('rp_onb')==='1')s='ploca';
if(s==='povratak')s='ploca';
var last=+(localStorage.getItem('rp_seen')||0);
if(last&&Date.now()-last>144e5){try{
var ck=(JSON.parse(localStorage.getItem('rp_state')||'{}').checks)||{};
if(Object.keys(ck).some(function(k){return ck[k];}))s='povratak';}catch(e){}}
if(s&&CH[s]){r.setAttribute('data-screen',s);r.setAttribute('data-chrome',CH[s]);}
var k=localStorage.getItem('rp_skin');
if(k){if(k==='papir')r.removeAttribute('data-skin');else r.setAttribute('data-skin',k);}
}catch(e){}})();`

function pairedLektaPreviewUrl(value) {
  if (
    typeof window === 'undefined' ||
    window.location.hostname !== KATEDRA_PAIRED_PREVIEW_HOST
  ) return value

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

async function persistIncomingLektaManifest() {
  let manifest

  try {
    manifest = JSON.parse(localStorage.getItem('rp_manifest') || 'null')
  } catch {
    return
  }

  if (
    !manifest?.projectId ||
    !manifest?.lektaCheckedAt ||
    !Array.isArray(manifest?.lektaIssues)
  ) return

  const workType =
    ['s', 'z', 'd'].includes(manifest.workType) ? manifest.workType : 'z'

  try {
    await fetch('/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: manifest.projectId,
        guestProjectId: manifest.projectId,
        workType,
        profileId: manifest.profileId || '',
        rulesetVersion: manifest.rulesetVersion || '',
        lektaScore: manifest.lektaScore ?? null,
        lektaCheckedAt: manifest.lektaCheckedAt,
        lektaIssues: manifest.lektaIssues,
        lektaFixedTotal: manifest.lektaFixedTotal || 0,
      }),
    })
  } catch {
    // Local-first engine ostaje funkcionalan i bez mreže.
  }
}

export default function KatedraPage() {
  useEffect(() => {
    ensureGuestProjectIdentity()

    const isPairedPreview =
      window.location.hostname === KATEDRA_PAIRED_PREVIEW_HOST

    const originalOpen = window.open
    let lektaLinkObserver = null

    if (isPairedPreview) {
      window.open = function patchedOpen(url, target, features) {
        return originalOpen.call(
          window,
          pairedLektaPreviewUrl(url),
          target,
          features
        )
      }
    }

    const hadIncomingLektaHandoff =
      window.location.hash.startsWith('#lekta=')

    const normalizeIncomingLektaHash = () => {
      normalizeLektaHandoffHashForLegacyEngine()
    }

    window.addEventListener('hashchange', normalizeIncomingLektaHash)
    normalizeIncomingLektaHash()

    initKatedraEngine()

    // Katedra = sadržaj/proces.
    // Lekta = jedini tehnički validator stvarnog dokumenta.
    const removeProductBoundary = installKatedraProductBoundary()

    if (hadIncomingLektaHandoff) {
      void persistIncomingLektaManifest()
    }

    if (isPairedPreview) {
      const rewriteRenderedLektaLinks = () => {
        document
          .querySelectorAll(`a[href^="${LEKTA_PRODUCTION_ORIGIN}"]`)
          .forEach(anchor => {
            const next = pairedLektaPreviewUrl(anchor.href)
            if (next !== anchor.href) anchor.href = next
          })
      }

      rewriteRenderedLektaLinks()

      const root = document.getElementById('katedra-root')
      if (root) {
        lektaLinkObserver = new MutationObserver(rewriteRenderedLektaLinks)
        lektaLinkObserver.observe(root, {
          childList: true,
          subtree: true,
        })
      }
    }

    const removeRecheckLifecycle = installLektaRecheckLifecycle()

    return () => {
      window.removeEventListener('hashchange', normalizeIncomingLektaHash)
      removeRecheckLifecycle()
      removeProductBoundary()
      lektaLinkObserver?.disconnect()

      if (isPairedPreview) {
        window.open = originalOpen
      }
    }
  }, [])

  return (
    <>
      <div
        id="katedra-root"
        className="katedra-page"
        suppressHydrationWarning
        data-skin="kreda"
        data-screen="tip"
        data-chrome="funnel"
        dangerouslySetInnerHTML={{ __html: KATEDRA_BODY_HTML }}
      />
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
    </>
  )
}
