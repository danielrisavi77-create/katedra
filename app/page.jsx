'use client'

import { useEffect } from 'react'
import { initKatedraEngine } from './katedra-engine'
import { KATEDRA_BODY_HTML } from './katedra-body'
import './katedra-scoped.css'

// Ekran i koža se čitaju PRIJE prvog crtanja. initKatedraEngine() ide iz
// useEffecta, dakle nakon paint-a — bez ovoga povratnik na jedan frame vidi
// uvodni ekran, a onaj s odabranom kožom bljesak zadane palete.
const BOOT = `(function(){try{
var r=document.getElementById('katedra-root');if(!r)return;
var CH={tip:'funnel',gdje:'funnel',pitanja:'funnel',fakultet:'fak',ploca:'board',chat:'board',povratak:'funnel'};
var s=localStorage.getItem('rp_screen');
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

export default function KatedraPage() {
  useEffect(() => {
    initKatedraEngine()
  }, [])

  return (
    <>
      <div
        id="katedra-root"
        className="katedra-page"
        // Zadano za korisnika bez povijesti: kreda i prvi ekran lijevka.
        // Povratnika BOOT skripta ispod prebaci prije crtanja — a upravo zato
        // se atributi na klijentu namjerno razlikuju od poslužiteljskih, pa
        // hidracija za njih ne smije javljati neslaganje.
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
