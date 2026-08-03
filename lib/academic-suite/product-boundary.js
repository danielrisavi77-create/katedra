const TECHNICAL_REDIRECT =
  'Katedra nije tehnički validator dokumenta. Za margine, fontove, stilove naslova, Word polja, sadržaj/TOC, numeraciju, citatnu mehaniku, bibliografsku povezanost, tracked changes, komentare i druga strojno provjerljiva pravila koristi Lektu. Katedra taj dio može objasniti, ali ga ne smije proglasiti provjerenim ni usklađenim.'

function rewriteAuditPrompt(text) {
  if (typeof text !== 'string' || !text.includes('## PRAVILA AUDITA')) return text

  const marker = '\n\n## PRAVILA AUDITA\n'
  const idx = text.indexOf(marker)
  if (idx < 0) return text

  const tagIdx = text.indexOf('\n\n—\nGenerirano s Katedra', idx)
  const suffix = tagIdx >= 0 ? text.slice(tagIdx) : ''
  const prefix = text
    .slice(0, idx)
    .replace(
      /Napravi POTPUNI AUDIT rada[^\n]*/,
      'Napravi SADRŽAJNU RECENZIJU rada. Katedra ocjenjuje kvalitetu akademskog sadržaja i argumentacije — ne tehničku ispravnost DOCX-a.',
    )

  const rules = `\n\n## PRAVILA SADRŽAJNE RECENZIJE — KATEDRA\n` +
    `1. TEZA I ISTRAŽIVAČKO PITANJE — je li teza jasna i obranjiva; odgovara li zaključak na pitanje iz uvoda.\n` +
    `2. ARGUMENTACIJA — logika, koherentnost, protuargumenti, povezanost teorije i analize.\n` +
    `3. DOKAZI I IZVORI — provjeri podupire li izvor tvrdnju, jesu li tvrdnje unutar granica dokaza i postoje li očite rupe u potkrepi. Ne provjeravaj tehnički format citata, numeraciju ni bibliografsku mehaniku.\n` +
    `4. METODOLOGIJA I ANALIZA — prikladnost metode, ograničenja, interpretacija rezultata i akademska zrelost zaključivanja.\n` +
    `5. STRUKTURA I JASNOĆA — redoslijed ideja, prijelazi, ponavljanja, generičke formulacije i jasnoća akademskog izraza.\n` +
    `6. KOMENTARI MENTORA — ako su priloženi, provjeri jesu li sadržajno adresirani.\n` +
    `7. Na kraju: KRITIČNO / SREDNJE / KOZMETIČKO — samo sadržajni nalazi, s konkretnim mjestom i prijedlogom što razjasniti ili argumentirati.\n` +
    `8. ${TECHNICAL_REDIRECT}\n` +
    `9. Ako korisnik traži tehničku potvrdu ili izjavu da je dokument formalno usklađen, izričito reci da Katedra to ne može pouzdano utvrditi i uputi ga na Lekta Check.`

  return prefix + rules + suffix
}

function rewriteGradePrompt(text) {
  if (typeof text !== 'string' || !text.includes('OCIJENI priloženi draft')) return text
  let next = text
  next = next.replace(
    /3\. DOKAZI I IZVORI[^\n]*/,
    '3. DOKAZI I IZVORI — podupiru li izvori tvrdnje, kvaliteta i relevantnost izvora, granice dokaza; NE ocjenjuj tehnički format citata ili bibliografsku mehaniku',
  )
  next = next.replace(
    /6\. FORMALNO[^\n]*/,
    '6. AKADEMSKA ZRELOST — preciznost zaključivanja, svijest o ograničenjima, doprinos i uvjerljivost cjeline',
  )
  if (!next.includes('Katedra nije tehnički validator dokumenta.')) {
    next += `\n6. TEHNIČKA GRANICA: ${TECHNICAL_REDIRECT}`
  }
  return next
}

function rewritePromptElement(element) {
  if (!(element instanceof HTMLElement)) return
  const before = element.textContent || ''
  const after = rewriteGradePrompt(rewriteAuditPrompt(before))
  if (after !== before) element.textContent = after
}

function replaceLegacyCheatsheets(root) {
  root.querySelectorAll('.cs').forEach(card => {
    const heading = card.querySelector('h3')?.textContent || ''

    if (heading.includes('Audit pipeline A–G')) {
      card.innerHTML = `
        <h3><em>🧠</em> Katedra Review — sadržaj, ne DOCX tehnika</h3>
        <ol>
          <li><b>Teza i pitanje</b> — je li rad usmjeren i obranjiv</li>
          <li><b>Argumentacija</b> — logika, teorija ↔ analiza, protuargumenti</li>
          <li><b>Dokazi</b> — podupiru li izvori tvrdnje i poštuju li se granice dokaza</li>
          <li><b>Metodologija</b> — prikladnost pristupa, ograničenja i interpretacija</li>
          <li><b>Jasnoća</b> — struktura ideja, prijelazi, ponavljanja i akademski izraz</li>
        </ol>
        <p style="font-size:12.5px;color:var(--mut);margin-top:8px"><b>Katedra namjerno ne radi tehničku provjeru dokumenta.</b> Formalnu i strojno provjerljivu ispravnost utvrđuje Lekta.</p>`
      return
    }

    if (heading.includes('Word mehanika')) {
      card.innerHTML = `
        <h3><em>✅</em> Tehnička provjera pripada Lekti</h3>
        <p style="font-size:12.8px;color:var(--mut);margin-bottom:9px">Word polja, TOC/SEQ/REF, fontovi, prijelomi, margine, stilovi, numeracija, citatna mehanika i druga pravila stvarnog dokumenta nisu Katedrina provjera. LLM ih ne može potvrditi jednako pouzdano kao deterministička analiza dokumenta.</p>
        <div class="final-actions"><a class="att-btn" data-technical-authority-link style="text-decoration:none" href="https://lektahr.netlify.app" target="_blank" rel="noopener">✅ Provjeri dokument u Lekti ↗</a></div>`
    }
  })
}

function relabelContentReview(root) {
  root.querySelectorAll('button, a, span, h2, h3').forEach(el => {
    const text = (el.textContent || '').trim()
    if (text === '🧠 Recenzija rada') el.textContent = '🧠 Recenzija sadržaja'
    if (text === 'Recenzija rada') el.textContent = 'Recenzija sadržaja'
    if (text === '🔍 Audit rada') el.textContent = '🧠 Recenzija sadržaja'
    if (text === 'Audit rada') el.textContent = 'Recenzija sadržaja'
  })

  root.querySelectorAll('li').forEach(el => {
    const text = (el.textContent || '').trim()
    if (text.startsWith('Audit — sustavna provjera gotovog rada')) {
      el.innerHTML = '<b>Recenzija sadržaja</b> — teza, argumentacija, dokazi, metodologija i jasnoća; tehničku provjeru dokumenta radi Lekta.'
    }
  })

  const phase = root.querySelector('#ph-f4 .ph-intro')
  if (phase && !phase.querySelector('[data-katedra-boundary-note]')) {
    const note = document.createElement('div')
    note.dataset.katedraBoundaryNote = '1'
    note.style.cssText = 'margin-top:10px;padding:10px 12px;border:1px solid var(--line2);border-radius:10px;background:var(--bg2);font-size:12.5px;color:var(--mut)'
    note.innerHTML = '<b style="color:var(--txt)">Granica proizvoda:</b> Katedra recenzira sadržaj i pomaže riješiti nalaze, ali ne radi vlastiti tehnički check. Ako treba znati je li stvarni DOCX tehnički/formalno ispravan, mjerodavan je Lekta Check.'
    phase.appendChild(note)
  }
}

function correctLegacyPrivacyCopy(root) {
  root.querySelectorAll('p, .onb-note').forEach(el => {
    const text = (el.textContent || '').trim()
    if (
      text.includes('Sve ostaje u tvom pregledniku') &&
      text.includes('stranica ništa nikamo ne šalje')
    ) {
      el.textContent = '🔒 Neprijavljenima stanje ostaje lokalno. Prijavljenima se projektno stanje sinkronizira na račun; tekst i prilozi šalju se AI dobavljaču samo kada pokreneš pisanje.'
    }
  })
}

function ensureBoundaryNotice(root) {
  if (root.querySelector('[data-product-boundary-banner]')) return
  const tabs = root.querySelector('#tabs')
  if (!tabs?.parentElement) return

  const notice = document.createElement('div')
  notice.dataset.productBoundaryBanner = '1'
  notice.style.cssText = 'margin:0 0 14px;padding:11px 13px;border:1px solid var(--line2);border-radius:12px;background:var(--card2);font-size:12.5px;line-height:1.5;color:var(--mut)'
  notice.innerHTML = '<b style="color:var(--txt)">Katedra = sadržaj i proces · Lekta = tehnička provjera dokumenta.</b><br>Katedra neće tvrditi da je DOCX tehnički usklađen. Za format, Word mehaniku i citatnu/bibliografsku mehaniku koristi Lekta Check.'
  tabs.insertAdjacentElement('beforebegin', notice)
}

function enforce(root) {
  ensureBoundaryNotice(root)
  replaceLegacyCheatsheets(root)
  relabelContentReview(root)
  correctLegacyPrivacyCopy(root)
  rewritePromptElement(root.querySelector('#promptOut'))
  root.querySelectorAll('.prompt-out').forEach(rewritePromptElement)
}

export function installKatedraProductBoundary() {
  if (typeof window === 'undefined') return () => {}
  const root = document.getElementById('katedra-root')
  if (!root) return () => {}

  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      enforce(root)
    })
  }

  enforce(root)
  const observer = new MutationObserver(schedule)
  observer.observe(root, { childList: true, subtree: true, characterData: true })

  return () => observer.disconnect()
}
