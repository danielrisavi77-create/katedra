/* eslint-disable react-hooks/rules-of-hooks -- this is a mounted vanilla-JS
   engine, not a React component; useSkills() below is a plain helper whose
   name only coincidentally matches the hook-naming convention. */
export function initKatedraEngine() {
  const __root = document.getElementById('katedra-root');
  if (!__root || __root.dataset.katedraInit) return;
  __root.dataset.katedraInit = '1';

/* =====================================================================
   Katedra — destiliran iz skillova fpzg-skill-pisanje + rad-audit
   ===================================================================== */

const PHASES = [
{ id:'f0', grp:'pre', ico:'🗂️', tit:'FAZA 0 — Tema i administrativa',
  sub:'Bez ovoga ne kreće ništa — pola problema nastaje ovdje',
  intro:'Sve u ovoj fazi rješavaš <b>prije ijednog prompta</b>. Svaka rupa ovdje znači prepravljanje cijelog rada poslije.',
  items:[
   {t:'Tema definirana i ODOBRENA od mentora', crit:1, types:'szd',
    d:'Imaš <b>pismenu potvrdu</b> (mail je dovoljan). Usmeno „može" zna postati „nisam to mislio" nakon 30 napisanih stranica.'},
   {t:'Službene upute fakulteta pronađene i pročitane', crit:1, types:'szd',
    d:'Pravilnik o pisanju radova + predložak — provjeri web fakulteta i repozitorij. Ako fakultet <b>nema propisani stil</b> (često na veleučilištima), stil de facto određuje mentor — ključni kriterij tada je <b>dosljednost</b>.'},
   {t:'Pravila fakulteta o korištenju AI alata provjerena', types:'szd',
    d:'Sve više fakulteta ima pravilnik o AI alatima (dopušteno uz navođenje / ograničeno / zabranjeno) — i to se često potpisuje u izjavi o akademskoj čestitosti. Znaj gdje stojiš PRIJE nego počneš.'},
   {t:'Word predložak fakulteta skinut', types:'szd',
    d:'Naslovnica, margine, font, prored, zaglavlja. Pisati u tuđem predlošku od prve stranice = nula sati prebacivanja na kraju.'},
   {t:'Zadani opseg poznat (stranice / riječi)', crit:1, types:'szd',
    d:'Seminarski: tipično <b>1.500–3.000 riječi</b>. Diplomski: po mentoru, tipično <b>15.000–30.000 riječi</b>. Opseg određuje dubinu strukture — zato ide u prompt.'},
   {t:'Citatni stil potvrđen (autor-godina ili IEEE [1])', crit:1, types:'szd',
    d:'FPZG standard: <b>(Prezime, godina, str. X)</b>. Tehnički radovi: <b>IEEE [1]</b>. Ako nije propisan → pošalji mentoru mail i traži potvrdu stila. Formalnost od 2 minute koja skida sav rizik.'},
   {t:'Rok predaje + interni rok upisani', crit:1, types:'szd',
    d:'Interni rok = <b>min. 7–10 dana prije službenog</b>: mentor treba vremena za komentare, ti za 1–2 runde ispravaka + završni audit.'},
   {t:'Raniji komentari mentora pregledani', types:'szd',
    d:'Što je zamjerio na prošlim radovima? To ide u prompt pod „posebne upute" — da se ista greška ne ponovi.'},
   {t:'Prijava teme / obrazac predan u referadu', types:'zd',
    d:'Završni i diplomski često traže službenu prijavu teme prije pisanja. Provjeri rokove referade — oni ne čekaju.'}
  ]},

{ id:'f1', grp:'pre', ico:'📚', tit:'FAZA 1 — Građa i izvori',
  sub:'Sve što Claude treba vidjeti, skupi PRIJE prvog prompta',
  intro:'Pravilo iz audita: <b>izvor istine &gt; dojam</b>. Svaka brojka i tvrdnja u radu mora postojati u građi — zato građa ide prva.',
  items:[
   {t:'SVA izvorna građa na jednom mjestu', crit:1, types:'zd',
    d:'Izvješća, glavni/izvedbeni projekt, prethodni seminarski, fotodokumentacija, sirovi podaci — <b>sve na što će se rad pozivati</b>. Rad se poslije cross-checka baš s ovom građom: što nije u građi, ne smije biti tvrdnja u radu.'},
   {t:'Literatura skupljena iz dozvoljenih baza', crit:1, types:'szd',
    d:'HRČAK, Google Scholar, JSTOR, akademske knjige, službeni dokumenti (EU, vlade, međunarodne organizacije), Eurostat / World Bank / OECD. Cilj: seminarski <b>5–10</b>, završni <b>15–25</b>, diplomski <b>30+</b> izvora.'},
   {t:'Zabranjeni izvori izbačeni', types:'szd',
    d:'<b>Wikipedia nikad</b> (ni sekundarno), blogovi bez autorstva, nerecenzirani materijali. Novinski članci samo kao empirijska ilustracija — ne kao akademski izvor.'},
   {t:'Za SVAKI izvor odmah zapisan pun bibliografski zapis', crit:1, types:'szd',
    d:'Autor, godina, naslov, izdavač/časopis, vol./br./stranice, DOI ili URL + <b>datum pristupa</b>. „Bez godine" = crveni flag — nađi godinu odmah; tražiti je naknadno za 30 izvora je noćna mora.'},
   {t:'Datoteke spremne za prilaganje u chat', types:'szd',
    d:'<b>Google Drive konektor vuče max ~10 MB</b> — veće datoteke i ZIP-ove prilaži IZRAVNO u chat (upload nema taj limit) ili razlomi na ključne dokumente.'},
   {t:'Skenirani / loši PDF-ovi provjereni', types:'zd',
    d:'Ako PDF ima oštećen tekstualni sloj (sken, loš font), brojke se moraju potvrđivati vizualno po stranicama — označi takve datoteke u promptu.'},
   {t:'Istraživačko pitanje formulirano u JEDNOJ rečenici', crit:1, types:'szd',
    d:'Zaključak rada mora biti <b>direktan odgovor</b> na ovo pitanje. Ako ga ne znaš napisati — u redu, generator ima opciju da Claude prvo predloži 3 varijante.'},
   {t:'Radni outline poglavlja skiciran', types:'szd',
    d:'2–4 poglavlja razrade (seminarski); diplomski + metodološki odjeljak. Idealno: pošalji mentoru na kratku potvrdu <b>prije pisanja</b> — 5 minuta njegova čitanja štedi tjedne tvoga prepravljanja.'}
  ]},

{ id:'f2', grp:'pre', ico:'⚡', tit:'FAZA 2 — Prompt i setup chata',
  sub:'Jedan chat = jedan rad. Sve definiraj ODMAH u prvom promptu',
  intro:'Prompt bez rupa = rad bez rupa. Zato postoji <b>generator</b> — ručno pisani prompt uvijek nešto izostavi.',
  items:[
   {t:'Novi zaseban chat / projekt otvoren samo za ovaj rad', types:'szd',
    d:'Bez miješanja tema — kontekst rada mora ostati čist kroz sve iteracije.'},
   {t:'Sva građa i literatura priložene u chat', crit:1, types:'szd',
    d:'PDF-ovi, DOCX, upute fakulteta. Claude ne smije pisati „napamet" — piše iz priložene građe.'},
   {t:'Prompt složen kroz Autopilot ili Generator — bez rupa', crit:1, types:'szd', jump:1,
    d:'<b>Autopilot</b>: zadaješ samo temu, Claude vodi sve (defaulti ugrađeni). <b>Generator</b>: puna kontrola nad svakim parametrom. U oba slučaja — nijedno polje se ne zaboravlja.'},
   {t:'U promptu: prva isporuka = PLAN I PROGRAM, ne tekst rada', crit:1, types:'szd',
    d:'<b>Nikad „napiši cijeli rad odjednom”.</b> Prvi korak svakog rada je Plan i program (sekcije 0–11: formalna pravila fakulteta, teza, budžet stranica, program pisanja, verificirana literatura, hodogram…). Ugrađeno u Autopilot i Generator prompte — v. Pravila → Plan i program.'},
   {t:'Anti-halucinacija pravilo u promptu', crit:1, types:'szd',
    d:'„Ne izmišljaj izvore — gdje nemaš stvaran izvor, označi <b>[TREBA IZVOR]</b>." Ugrađeno u generirani prompt.'},
   {t:'PLAN I PROGRAM izrađen i ODOBREN prije prvog poglavlja', crit:1, types:'szd',
    d:'Plan od jednog dana redovito otkrije razloge zašto rad NE BI dobio peticu (nema teze, formalni propusti, prazna literatura) — dok ih je još jeftino ispraviti. Odobri ga ti, a strukturu i tezu idealno potvrdi i mentor. Ovo je kritični put cijelog rada.'}
  ]},

{ id:'f3', grp:'post', ico:'✍️', tit:'FAZA 3 — Pisanje',
  sub:'Kontrola kvalitete DOK tekst nastaje, ne poslije',
  intro:'Svako poglavlje pročitaj <b>prije</b> nego kažeš „nastavi". Greška uhvaćena odmah = 1 minuta; uhvaćena na kraju = sat vremena.',
  items:[
   {t:'Plan i program odobren (ti + idealno mentor)', crit:1, types:'szd',
    d:'Struktura, teza i budžet stranica zaključani. Tek tada kreće prvo poglavlje — pisanje je <b>izvršavanje plana</b>, ne izmišljanje u hodu.'},
   {t:'Uvod ima sva 4 elementa', crit:1, types:'szd',
    d:'Kontekst i relevantnost → <b>istraživačko pitanje</b> → cilj rada → kratki pregled strukture. Bez ijednog od ta 4, uvod ne prolazi.'},
   {t:'Poglavlje po poglavlje — svako pročitano prije nastavka', crit:1, types:'szd',
    d:'Provjeri u svakom paragrafu: tematska rečenica → objašnjenje → primjer → referenca → mini zaključak/prijelaz.'},
   {t:'Svaki citat uz tvrdnju, s TOČNOM stranicom', crit:1, types:'szd',
    d:'(Lindblom, 1959, <b>str. 81</b>) — ne samo (Lindblom, 1959). Citat ide odmah uz tvrdnju, ne na kraj paragrafa. Bez „ibid." u tekstu.'},
   {t:'Svaki izvor koji Claude navede PROVJEREN da postoji', crit:1, types:'szd',
    d:'Google Scholar / HRČAK / DOI provjera — <b>AI zna halucinirati izvore</b>. 2 minute provjere po izvoru &lt; pad rada zbog izmišljene reference.'},
   {t:'Teorija povezana s analizom', types:'szd',
    d:'Nijedno poglavlje ne smije samo prepričavati teoriju — uvijek: implikacije, ograničenja, kritički osvrt, veza s tvojim slučajem.'},
   {t:'Zabranjene AI fraze očišćene', types:'szd',
    d:'„kroz povijest", „od davnina", „u današnje vrijeme", „neupitno je da", „svima je poznato" — nula tolerancije.'},
   {t:'Metodološki odjeljak napisan', types:'d',
    d:'Kvalitativna/kvantitativna analiza, studija slučaja, uzorak, ograničenja metode — diplomski bez metodologije ne postoji.'},
   {t:'Zaključak = direktan odgovor na istraživačko pitanje', crit:1, types:'szd',
    d:'Sažetak nalaza → odgovor na pitanje iz uvoda → implikacije / preporuke za daljnje istraživanje.'},
   {t:'Literatura složena u dogovorenom stilu', types:'szd',
    d:'Autor-godina: abecedno. IEEE: redom prvog pojavljivanja, bez rupa u numeraciji. Imena dosljedno (prezime-inicijal ILI inicijal-prezime — jedno kroz cijeli popis).'}
  ]},

{ id:'f4', grp:'post', ico:'🔍', tit:'FAZA 4 — Recenzija (prije mentora)',
  sub:'4A Katedra Review (sadržaj) → 4B Lekta Check (dokument) → 4C ispravci → 4D Lekta re-check',
  intro:'Dva neovisna, nikad pomiješana pregleda. <b>🧠 4A — Katedra Review</b>: sadržaj (teza, argumentacija, izvori) — to je dolje kao checklist, jer je to Katedrin posao. <b>✅ 4B — Lekta Check</b>: dokument (format, struktura, citatna mehanika) — to Katedra više ne provjerava sama niti izmišljenim kvačicama tvrdi da je „usklađeno"; to mjeri isključivo Lekta, deterministički, po pravilima tvog fakulteta.',
  items:[
   {t:'C — Brojke i tvrdnje unutar granica dokaza', crit:1, types:'zd',
    d:'Sve što se može izračunati — izračunaj (površine, količine, rasponi). Rad <b>ne smije tvrditi što građa ne dokazuje</b>.'},
   {t:'D — Cross-check s izvornom građom ⚑', crit:1, types:'zd',
    d:'Najvrjednija stavka: svaka ključna tvrdnja/brojka potvrđena u konkretnom izvoru. Kad se izvori razlikuju → rad razliku <b>izričito deklarira</b> (kasnija/izvedbena izvješća &gt; rani nacrti; fotografija &gt; prepis).'},
   {t:'E — Jezik i ponavljanja sređeni', types:'szd',
    d:'Razbij obrazac („izvješće navodi…" 20×), koncentriraj hedžing na jedno mjesto, spoji staccato rečenice.'},
   {t:'4C — Sadržajni nalazi (Katedra) razvrstani i riješeni', crit:1, types:'szd',
    d:'Teza, argumentacija, izvori — Kritično / Srednje / Kozmetičko. U predaju ne ide ništa s otvorenim kritičnim sadržajnim nalazom.'}
  ]},

{ id:'f5', grp:'post', ico:'📦', tit:'FAZA 5 — Finale i predaja',
  sub:'Zadnjih 30 minuta koje odlučuju dojam',
  intro:'Rad je gotov tek kad je <b>predan ispravan dokument</b> — ne kad je napisan zadnji paragraf.',
  items:[
   {t:'Finalni .docx otvoren u Wordu: Ctrl+A → F9', crit:1, types:'zd',
    d:'Osvježava SVA polja: sadržaj, popise tablica/slika, brojeve stranica, unakrsne reference. Bez ovoga sadržaj pokazuje krive stranice.'},
   {t:'Vizualni pregled od naslovnice do literature', crit:1, types:'szd',
    d:'Praznine, naslovi-siročad na dnu stranice, prelomljene tablice, dosljedan font (i u zaglavlju/podnožju).'},
   {t:'Naslovnica točno po predlošku fakulteta', crit:1, types:'szd',
    d:'Ime, JMBAG, studij, mentor, akademska godina, datum — sve provjereno slovo po slovo.'},
   {t:'Izjava o autorstvu / akademskoj čestitosti uključena', types:'zd',
    d:'Ako je fakultet traži — potpisana i na pravom mjestu u dokumentu.'},
   {t:'Sažetak + ključne riječi (HR + EN)', types:'zd',
    d:'Sažetak 150–250 riječi: problem → metoda → glavni nalaz. Abstract = prijevod, ne nova verzija.'},
   {t:'PDF export napravljen i pregledan', types:'szd',
    d:'Fontovi i prijelomi identični Wordu? Otvori PDF i prolistaj — export zna pomaknuti tablice.'},
   {t:'Similarity self-check (Turnitin/PlagScan)', types:'zd',
    d:'Ako fakultet daje pristup — provjeri prije službene predaje, ne poslije.'},
   {t:'Poslano mentoru na pregled PRIJE službene predaje', crit:1, types:'szd',
    d:'Interni rok iz Faze 0. Mentorov OK prije uploada u sustav.'},
   {t:'Nakon komentara mentora: izmjene + MINI AUDIT ponovno', crit:1, types:'szd',
    d:'Svaka runda izmjena = ponovna provjera citata, brojki i polja. Izmjena „samo jedne rečenice" zna slomiti referencu.'},
   {t:'Backup s verzijom u imenu + predaja u sustav', types:'szd',
    d:'Rad_v3_2026-08-02.docx — jasno verzioniranje. Pa Merlin / repozitorij / referada, po uputama.'},
   {t:'Lekcije zapisane za sljedeći rad', types:'szd',
    d:'Što je mentor zamjerio? Što si skoro zaboravio? Zapiši — to ide u „posebne upute” sljedećeg prompta (i u nadogradnju skillova). Tako svaki rad postaje bolji od prošlog.'}
  ]},

{ id:'f6', grp:'post', ico:'🎤', tit:'FAZA 6 — Obrana',
  sub:'Rad brani onaj tko zna svoje slabe točke',
  intro:'Prompt za pripremu složi u Generatoru → mod <b>🎤 Obrana</b>: prezentacija, govorni scenarij, pitanja komisije i slabe točke — sve iz tvog rada.',
  items:[
   {t:'Termin obrane potvrđen + administrativa referade', crit:1, types:'zd',
    d:'Prijava obrane, potvrde, rok za upload u repozitorij — referada ima svoje rokove koji ne čekaju tebe.'},
   {t:'Prezentacija napravljena (10–12 slajdova iz rada)', crit:1, types:'szd',
    d:'Struktura: problem → istraživačko pitanje → metoda → 3–4 ključna nalaza → zaključak/doprinos. <b>Ništa novo što nije u radu</b> — komisija pita po slajdovima.'},
   {t:'Govorni scenarij napisan i tempiran', types:'szd',
    d:'~110 riječi/min za zadano trajanje. Govorni jezik, ne čitanje rada naglas. Prvi i zadnji slajd znaš napamet.'},
   {t:'Pitanja komisije + odgovori pripremljeni', crit:1, types:'zd',
    d:'Min. 15 pitanja — obavezno: metodologija, ograničenja rada, „zašto baš ova tema/pristup”. Slabe točke rada popiši sam PRIJE obrane — komisija ih vidi, bolje da ti prvi imaš odgovor.'},
   {t:'Generalna proba naglas (min. 2×, sa štopericom)', types:'szd',
    d:'Naglas, ne u glavi — tek tada čuješ gdje zapinješ i koliko izlaganje stvarno traje.'},
   {t:'Tehnika spremna: laptop, USB, adapter, backup PDF', types:'zd',
    d:'Prezentacija i kao PDF na USB-u + u mailu — projektor ne oprašta. Dođi 15 min ranije i testiraj.'}
  ]}
];

/* ---------- STATE ---------- */
const state = { tip:'z', checks:{}, mode:'write' };
const TIP_LABEL = {s:'SEMINARSKI RAD', z:'ZAVRŠNI RAD', d:'DIPLOMSKI RAD'};
const TIP_MOD = {s:'SEMINAR MODE', z:'DIPLOMSKI MODE (završni rad — manji opseg)', d:'DIPLOMSKI MODE'};
const TIP_OPSEG = {s:'npr. 1.500–3.000 riječi', z:'npr. 25–35 stranica', d:'npr. 15.000–30.000 riječi'};
const TIP_IZV = {s:'npr. 5–10', z:'npr. 15–25', d:'npr. 30+'};
const $ = id => document.getElementById(id);

/* ---------- RENDER PHASES ---------- */
function visibleItems(ph){ return ph.items.filter(it => it.types.includes(state.tip)); }

function renderPhases(){
  const pre = $('phasesPre'), post = $('phasesPost');
  pre.innerHTML = '<div class="sec-lbl"><span>Prije pisanja</span><b class="req">OBAVEZNO 100 %</b><i></i></div>';
  post.innerHTML = '<div class="sec-lbl"><span>Pisanje → predaja</span><b class="after">NAKON ZELENOG SVJETLA</b><i></i></div>';
  // F6: prva neoznačena stavka u TRENUTNOJ fazi (linePos()) dobiva suptilan
  // pulse — jedina vizualno naglašena stavka, ne cijeli popis.
  const curPh = PHASES[linePos()];
  const curPhaseId = curPh ? curPh.id : null;
  PHASES.forEach(ph => {
    const items = visibleItems(ph);
    const div = document.createElement('div');
    div.className = 'phase' + (openPhases.has(ph.id) ? ' open' : '');
    div.id = 'ph-' + ph.id;
    let ih = '';
    let nextMarked = false;
    items.forEach((it,idx) => {
      const key = ph.id + ':' + it.t;
      const ck = state.checks[key] ? ' ck' : '';
      const isNext = !ck && !nextMarked && ph.id === curPhaseId;
      if(isNext) nextMarked = true;
      ih += `<div class="item${ck}${isNext ? ' next' : ''}" data-key="${escA(key)}">
        <div class="cb" onclick="toggleCheck(this)"><svg width="13" height="13" viewBox="0 0 14 14"><path d="M2 7.5 5.5 11 12 3.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="it-main">
          <span class="it-txt" onclick="toggleCheck(this)">${it.t}${it.crit?'<span class="badges"><span class="bdg crit">kritično</span></span>':''}</span><br>
          <button class="why" onclick="this.closest('.item').classList.toggle('exp')">ⓘ zašto / kako</button>
          <div class="it-detail">${it.d}</div>
          ${it.jump?'<br><button class="jump" onclick="goAuto()">🤖 Autopilot →</button> <button class="jump" onclick="goGen()">⚡ Generator →</button>':''}
        </div>
      </div>`;
    });
    if(ph.id === 'f4'){
      ih += `<div class="att-card" style="margin-top:10px">
        <div class="att-top"><span class="nm" style="font-size:14px">✅ 4B — Lekta Check (dokument)<small>Format, struktura, citatna mehanika, Word polja — deterministički, po pravilima tvog fakulteta. Ovo Katedra više ne provjerava kvačicama — to mjeri isključivo Lekta.</small></span></div>
        <ul style="padding-left:18px;font-size:12.5px;color:var(--mut);margin-top:8px">
          <li style="margin-bottom:4px">Integritet dokumenta — tracked changes prihvaćeni, komentari riješeni</li>
          <li style="margin-bottom:4px">Citati interno konzistentni — bez siročadi, bez rupa u numeraciji</li>
          <li style="margin-bottom:4px">Hrvatska tipografija — navodnici, en-crtice, decimalni zarez</li>
          <li style="margin-bottom:4px">Word mehanika — TOC/SEQ/REF polja, prijelomi, font, uvlake</li>
          <li style="margin-bottom:0">4D — ponovna Lekta provjera nakon svake runde ispravaka</li>
        </ul>
        <div class="final-actions"><a class="att-btn" style="text-decoration:none" href="${lektaLink()}" target="_blank" rel="noopener">✅ Otvori Lekta Check ↗</a></div>
      </div>`;
    }
    div.innerHTML = `
      <div class="ph-head" onclick="togglePhase('${ph.id}')">
        <div class="ph-ico">${ph.ico}</div>
        <div class="ph-tit"><h3>${ph.tit}</h3><p>${ph.sub}</p></div>
        <div class="ph-meta">
          <span class="ph-count" id="cnt-${ph.id}"></span>
          <div class="ph-bar"><i id="bar-${ph.id}"></i></div>
          <div class="ph-stamp"><div class="stp${ph.id==='f6'?' gold':''}" id="stp-${ph.id}">${ph.id==='f6'?'KATEDRA ★ OBRANJENO':'KATEDRA ✓ OVJERENO'}</div></div>
          <span class="chev">▼</span>
        </div>
      </div>
      <div class="ph-body"><div class="ph-intro">${ph.intro}</div>${ih}</div>`;
    (ph.grp === 'pre' ? pre : post).appendChild(div);
  });
  refreshProgress();
}

const openPhases = new Set(['f0']);
function togglePhase(id){
  openPhases.has(id) ? openPhases.delete(id) : openPhases.add(id);
  document.getElementById('ph-'+id).classList.toggle('open');
}

function toggleCheck(el){
  const item = el.closest('.item');
  const key = item.dataset.key;
  state.checks[key] = !state.checks[key];
  item.classList.toggle('ck', state.checks[key]);
  refreshProgress();
  if(typeof saveState === 'function') saveState();
}

function refreshProgress(){
  let totAll = 0, ckAll = 0, totPre = 0, ckPre = 0;
  // Mentorov stol: faza na kojoj si je povučena prema naprijed, dovršene su
  // odgurnute i blago nakrivljene, buduće prigušene. Klase se postavljaju ovdje
  // (a ne u renderPhases) jer se stanje mijenja na svaku kvačicu, bez ponovnog
  // crtanja cijelog popisa.
  const curIdx = linePos();
  PHASES.forEach((ph, idx) => {
    const items = visibleItems(ph);
    let ck = 0;
    items.forEach(it => { if(state.checks[ph.id+':'+it.t]) ck++; });
    totAll += items.length; ckAll += ck;
    if(ph.grp === 'pre'){ totPre += items.length; ckPre += ck; }
    const cnt = $('cnt-'+ph.id), bar = $('bar-'+ph.id), card = $('ph-'+ph.id);
    const full = ck===items.length && items.length>0;
    if(cnt){ cnt.textContent = ck + '/' + items.length; cnt.classList.toggle('full', full); }
    if(bar){ bar.style.width = (items.length ? ck/items.length*100 : 0) + '%'; }
    if(card){
      card.classList.toggle('done', full);
      card.classList.toggle('now', idx === curIdx && !full);
      card.classList.toggle('ahead', idx > curIdx && !full);
    }
    const stp = $('stp-'+ph.id); if(stp){ stp.classList.toggle('on', full); }
  });
  /* dnevnik: zabilježi svaku novo-dovršenu fazu (jednom) */
  try{
    const logged = new Set(JSON.parse(lsGet('rp_logf') || '[]'));
    let dirty = false;
    PHASES.forEach(ph => {
      const items = visibleItems(ph); if(!items.length) return;
      const full = items.every(it => state.checks[ph.id+':'+it.t]);
      if(full && !logged.has(ph.id)){ logged.add(ph.id); rpLog('Dovršena '+ph.tit); dirty = true; }
    });
    if(dirty) lsSet('rp_logf', JSON.stringify([...logged]));
  }catch(e){}
  const pct = totAll ? Math.round(ckAll/totAll*100) : 0;
  window.__pct = pct;
  const rp = $('ringPct'); if(rp) rp.textContent = pct + '%';
  const rf = $('ringFg'); if(rf) rf.style.strokeDashoffset = 157 - 157*pct/100;
  if(typeof renderLine === 'function') renderLine();
  if(typeof renderIndeksHead === 'function') renderIndeksHead();
  if(typeof updatePaper === 'function') updatePaper();
  /* banner — spreman za pisanje? */
  const b = $('banner'), go = $('bGo');
  const preP = totPre ? ckPre/totPre : 0;
  b.className = 'banner';
  if(preP >= 1){
    b.classList.add('yes'); $('bIco').textContent = '🟢';
    $('bTit').textContent = 'SPREMAN ZA PISANJE';
    $('bTxt').textContent = 'Faze 0–2 su 100 %. Otvori Autopilot (samo tema) ili Generator (puna kontrola) i kreni.';
    go.style.display = 'block';
  } else if(preP >= .6){
    b.classList.add('almost'); $('bIco').textContent = '🟡';
    $('bTit').textContent = 'SKORO SPREMAN — ' + (totPre-ckPre) + ' stavki do zelenog';
    $('bTxt').textContent = 'Dovrši faze 0–2 prije prvog prompta. Kritične stavke su označene crveno.';
    go.style.display = 'none';
  } else {
    b.classList.add('no'); $('bIco').textContent = '🔴';
    $('bTit').textContent = 'NISI SPREMAN ZA PISANJE — ' + (totPre-ckPre) + ' stavki do zelenog';
    $('bTxt').textContent = 'Faze 0–2 (tema, građa, prompt) moraju biti 100 % prije prvog prompta.';
    go.style.display = 'none';
  }
}

function escA(s){ return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
/* ---------- TABS ---------- */
function smoothly(){ return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; }
// Dovedi pogled na fazu na kojoj si. Ako je već pred tobom, ne miči stranicu —
// skrol koji se dogodi bez potrebe djeluje kao da je nešto puklo.
function scrollToNow(){
  const el = document.querySelector('#view-check .phase.now');
  if(!el) return false;
  const r = el.getBoundingClientRect(), vh = window.innerHeight || 0;
  // Otvorena faza zna biti viša od prozora, pa "cijela stane" nije dobar uvjet —
  // dovoljno je da ti je pred očima: počinje u gornjoj polovici ili je seže preko nje.
  if(r.top >= 0 ? r.top <= vh * 0.5 : r.bottom >= vh * 0.5) return true;
  el.scrollIntoView({ behavior: smoothly(), block: 'center' });
  return true;
}
function setTab(v){
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.view===v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id==='view-'+v));
  if(v === 'check'){
    if(typeof renderIndeksHead === 'function') renderIndeksHead();
    // Ulazak u Indeks vodi točno na mjesto gdje treba djelovati. Dok napretka
    // nema, vrh (zaglavlje + vozni red) je prava orijentacija, pa ostaje vrh.
    if(hasRealProgress() && scrollToNow()) return;
  }
  window.scrollTo({top:0, behavior: smoothly()});
}
function goGen(){ setTab('gen'); }
function goAuto(){ setTab('auto'); }

/* ---------- GENERATOR ---------- */
const REQ = {
  write:[['f_tema','tema'],['f_opseg','opseg'],['f_stil','citatni stil']],
  audit:[['f_radfile','datoteka rada'],['f_gradja','priložena građa']],
  improve:[['f_imptekst','što se poboljšava']],
  obrana:[['f_radfile','datoteka rada']]
};
const GEN_IDS = ['f_fakultet','f_kolegij','f_mentor','f_tema','f_pitanje','f_opseg','f_izvori','f_stil','f_rok','f_obvezni','f_gradja','f_upute','f_radfile','f_brige','f_imptekst','f_impfokus','f_trajanje','f_datumobr','f_komisija','a_tema','dl_rok','wc_total','wc_unit'];

function val(id){ const e = $(id); return e ? e.value.trim() : ''; }
function useSkills(){ const e = $('u_skills'); return !!(e && e.checked); }

/* ---------- KONFIG (promijeni pri hostanju) ---------- */
const RP_VER = '10.3';
const RP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://katedra.hr'; // VIZIJA.md: domena je katedra.hr
const EMAIL_URL = '';                            /* ← Tally/Google Form URL; prazno = mailto fallback */
const RP_TAG = '\n\n—\nGenerirano s Katedra · ' + RP_URL.replace('https://','');

/* ---------- TRAJNOST (localStorage, sigurno) ---------- */
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function gatherGen(){
  const gen = {}; GEN_IDS.forEach(id => gen[id] = val(id));
  ['f_brutal','a_gradja','a_checkpoint','u_skills','a_learn'].forEach(k => { if($(k)) gen[k] = $(k).checked; });
  return gen;
}
function saveState(){
  lsSet('rp_state', JSON.stringify({tip: state.tip, checks: state.checks, gen: gatherGen()}));
  syncServerDebounced();
}
function loadState(){
  try{
    const raw = lsGet('rp_state'); if(!raw) return;
    const d = JSON.parse(raw);
    if(d.tip) state.tip = d.tip;
    if(d.checks) state.checks = d.checks;
    if(d.gen){
      GEN_IDS.forEach(id => { if($(id) && d.gen[id] !== undefined) $(id).value = d.gen[id]; });
      ['f_brutal','a_gradja','u_skills','a_learn'].forEach(k => { if($(k)) $(k).checked = !!d.gen[k]; });
      if($('a_checkpoint')) $('a_checkpoint').checked = d.gen.a_checkpoint !== false;
    }
  }catch(e){}
}
function getHist(){ try{ return JSON.parse(lsGet('rp_hist') || '[]'); }catch(e){ return []; } }
function pushHist(entry){ const h = getHist(); h.unshift(entry); lsSet('rp_hist', JSON.stringify(h.slice(0,10))); syncServerNow(); }
function getLog(){ try{ return JSON.parse(lsGet('rp_log') || '[]'); }catch(e){ return []; } }
function rpLog(txt){ const l = getLog(); l.push({t: Date.now(), txt}); lsSet('rp_log', JSON.stringify(l.slice(-200))); syncServerNow(); }
function exportDnevnik(){
  const l = getLog();
  const fmt = ts => new Date(ts).toLocaleString('hr-HR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
  let md = '# DNEVNIK PROCESA IZRADE RADA\n\n';
  md += 'Student: ______________________\n\n';
  md += 'Rad: ' + (val('a_tema') || val('f_tema') || '______________________') + '\n\n';
  md += 'Izvezeno: ' + fmt(Date.now()) + ' (Katedra)\n\n';
  md += '## Kronologija (automatski bilježeno u alatu)\n\n| Datum i vrijeme | Događaj |\n|---|---|\n';
  md += (l.length ? l.map(e => '| ' + fmt(e.t) + ' | ' + String(e.txt).replace(/\|/g,'/') + ' |').join('\n') : '| — | (još nema zabilježenih događaja) |');
  md += '\n\n## Napomena\n\nPotpuni dokaz procesa izrade čine i: transkripti razgovora s AI alatom (izvoz iz Claude chata), sačuvane verzije dokumenta i komunikacija s mentorom. U Claudeu možeš zatražiti i detaljan dnevnik iz samog razgovora (Katedra → 🧩 Brzi prompti → Dnevnik procesa).\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([md], {type:'text/markdown'}));
  a.download = 'dnevnik-procesa.md';
  a.click(); URL.revokeObjectURL(a.href);
  toast('🗂️ Dnevnik procesa spremljen (.md)');
}

/* ---------- KOŽE (izgled aplikacije) ---------- */
// Sve boje idu kroz CSS tokene (v. katedra-scoped.css → blok KOŽE), pa je koža
// samo data-skin na #katedra-root. Zadana ("kreda") je već u page.jsx da nema
// bljeska pri učitavanju — ovdje se primjenjuje samo korisnikov spremljeni izbor.
// Izbor je namjerno lokalan: /api/state validira {tip, checks, gen} i dodavanje
// polja bi mu razbilo PUT. Prijenos na server ide uz sljedeću migraciju stanja.
const SKINS = [
  ['kreda',       'Ploča i kreda',   'predavaonica, kreda na tamnoj ploči', '#1e3a2f', '#e8c468'],
  ['papir',       'Papir i tinta',   'klasični izgled Katedre',             '#ece5d3', '#2c5fa8'],
  ['filatelija',  'Filatelija',      'poštanski žigovi za dovršene faze',   '#e7dcbf', '#a13327'],
  ['katalog',     'Katalog kartica', 'knjižnični katalog, smeđa tinta',     '#f9f7ee', '#5b4a2f'],
  ['ploca',       'Oglasna ploča',   'pluto ploča s pribadačama',           '#a97a44', '#c73b3b'],
  ['razglednica', 'Razglednica',     'putopisni ton, plava tinta',          '#eee5d2', '#3d6b8a'],
  ['karta',       'Karta potrage',   'kartografski nacrt puta',             '#e6dbbc', '#8a3b2f'],
  ['novine',      'Novine',          'naslovnica, oštri bridovi',           '#f2f0e8', '#7a1f1f']
];
const SKIN_DEFAULT = 'kreda';
function getSkin(){
  const s = lsGet('rp_skin');
  return SKINS.some(k => k[0] === s) ? s : SKIN_DEFAULT;
}
function applySkin(id){
  // "papir" je bazna paleta iz CSS-a — nema vlastiti blok, pa se atribut skida
  if(id === 'papir') __root.removeAttribute('data-skin');
  else __root.setAttribute('data-skin', id);
  __root.querySelectorAll('.skin-item').forEach(el => el.classList.toggle('on', el.dataset.skin === id));
}
function setSkin(id){
  lsSet('rp_skin', id);
  applySkin(id);
  const s = SKINS.find(k => k[0] === id);
  toast('🎨 Izgled: ' + (s ? s[1] : id));
}
function buildSkinPicker(){
  const header = __root.querySelector('header');
  if(!header || header.querySelector('.skin-wrap')) return;
  const cur = getSkin();
  const wrap = document.createElement('div');
  wrap.className = 'skin-wrap';
  wrap.innerHTML =
    '<button class="skin-open" type="button" aria-expanded="false" aria-haspopup="true">' +
      '<span class="sw"></span><span class="lbl">Izgled</span></button>' +
    '<div class="skin-menu" role="menu"><h5>Izgled aplikacije</h5>' +
      SKINS.map(([id, nm, desc, c1, c2]) =>
        '<button type="button" role="menuitem" class="skin-item' + (id === cur ? ' on' : '') + '" data-skin="' + id + '">' +
          '<span class="chip"><i style="background:' + c1 + '"></i><i style="background:' + c2 + '"></i></span>' +
          '<span class="nm">' + nm + '<small>' + desc + '</small></span>' +
          '<span class="tick">✓</span>' +
        '</button>').join('') +
      '<div class="skin-note">Mijenja samo izgled — rad, plan i pravila ostaju isti.</div>' +
    '</div>';
  const auth = header.querySelector('#katedraAuth');
  if(auth) header.insertBefore(wrap, auth); else header.appendChild(wrap);

  const btn = wrap.querySelector('.skin-open');
  const menu = wrap.querySelector('.skin-menu');
  const close = () => { menu.classList.remove('on'); btn.setAttribute('aria-expanded', 'false'); };
  btn.onclick = e => {
    e.stopPropagation();
    const open = menu.classList.toggle('on');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  wrap.querySelectorAll('.skin-item').forEach(it => {
    it.onclick = e => { e.stopPropagation(); setSkin(it.dataset.skin); close(); };
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') close(); });
}

/* ---------- LEKTA RULES — source of truth: katedra-pack (dohvaća se s /katedra-pack.json) ---------- */
const LEKTA_URL = 'https://lektahr.netlify.app';
let LEKTA_PACK = null, lektaPackPromise = null;
const LP_BY_ID = {};
async function loadLektaPack(){
  if(LEKTA_PACK) return LEKTA_PACK;
  if(!lektaPackPromise) lektaPackPromise = fetch('/katedra-pack.json').then(r => r.ok ? r.json() : null).catch(() => null);
  LEKTA_PACK = await lektaPackPromise;
  if(LEKTA_PACK) LEKTA_PACK.profiles.forEach(p => { LP_BY_ID[p.id] = p; });
  return LEKTA_PACK;
}
const LP_WT = { s:'seminar', z:'final', d:'graduate' };
const LP_CIT = {
  'fpzg': 'autor-godina (Prezime, godina, str. X) — FPZG standard',
  'ieee': 'IEEE numerički [1]',
  'apa': 'APA 7', 'apa7': 'APA 7',
  'chicago': 'Chicago (fusnote)'
};
const LP_SLUG = { s:'seminarski', z:'zavrsni', d:'diplomski' };   /* = Lekta LEVEL_SLUGS */
function lektaLink(){
  const u = lsGet('rp_unit');
  const q = [];
  if(u) q.push('unit=' + encodeURIComponent(u));
  if(LP_SLUG[state.tip]) q.push('work=' + LP_SLUG[state.tip]);
  const m = getManifest();
  if(m && m.projectId) q.push('project=' + encodeURIComponent(m.projectId));
  return LEKTA_URL + (q.length ? '/?' + q.join('&') : '');
}

/* ---------- PROJECT MANIFEST v1 (Faza C — klijentski, bez backenda) ---------- */
function getManifest(){
  try{ const m = JSON.parse(lsGet('rp_manifest') || 'null'); return (m && m.v === 1) ? m : null; }
  catch(e){ return null; }
}
function saveManifest(m){ lsSet('rp_manifest', JSON.stringify(m)); syncServerNow(); }
function ensureManifest(){
  let m = getManifest();
  if(!m) m = { v:1, projectId: 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
               createdAt: Date.now(), lektaIssues: [], lektaScore: null, lektaCheckedAt: '', lektaFixedTotal: 0 };
  m.unitId = lsGet('rp_unit') || m.unitId || '';
  m.profileId = lsGet('rp_profile') || m.profileId || '';
  m.workType = state.tip;
  const t = val('a_tema') || val('f_tema'); if(t) m.topic = t;
  const r = val('dl_rok'); if(r) m.deadline = r;
  saveManifest(m); return m;
}

/* ---------- SERVER SYNC (prijavljeni korisnici — localStorage ostaje cache/gost) ---------- */
let katedraLoggedIn = null;       // null = još ne znamo; postavlja refreshAuthAndCredits()
let katedraStateReconciled = false;
let stateSyncTimer = null;
function gatherServerState(){
  // Čisto čitanje — NE smije zvati ensureManifest()/saveManifest() (beskonačna petlja
  // preko syncServerNow unutar saveManifest).
  const m = getManifest() || { projectId: 'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    lektaIssues:[], lektaScore:null, lektaCheckedAt:'', lektaFixedTotal:0 };
  return {
    guestProjectId: m.projectId,
    unitId: m.unitId || lsGet('rp_unit') || '', profileId: m.profileId || lsGet('rp_profile') || '', workType: state.tip,
    topic: m.topic || '', deadline: m.deadline || '', rulesetVersion: m.rulesetVersion || '',
    lektaScore: m.lektaScore, lektaCheckedAt: m.lektaCheckedAt || '',
    lektaIssues: m.lektaIssues || [], lektaFixedTotal: m.lektaFixedTotal || 0,
    checks: state.checks, gen: gatherGen(),
    hist: getHist(), log: getLog(), logf: (() => { try{ return JSON.parse(lsGet('rp_logf')||'[]'); }catch(e){ return []; } })(),
  };
}
function syncServerNow(){
  if(!katedraLoggedIn) return;
  fetch('/api/state', {
    method:'PUT', headers:{'content-type':'application/json'},
    body: JSON.stringify(gatherServerState())
  }).catch(()=>{});
}
function syncServerDebounced(){
  if(!katedraLoggedIn) return;
  clearTimeout(stateSyncTimer);
  stateSyncTimer = setTimeout(syncServerNow, 1500);
}
function applyServerState(d){
  if(!d) return;
  if(d.workType) state.tip = d.workType;
  if(d.checks) state.checks = d.checks;
  if(d.gen){
    GEN_IDS.forEach(id => { if($(id) && d.gen[id] !== undefined) $(id).value = d.gen[id]; });
    ['f_brutal','a_gradja','u_skills','a_learn'].forEach(k => { if($(k)) $(k).checked = !!d.gen[k]; });
    if($('a_checkpoint')) $('a_checkpoint').checked = d.gen.a_checkpoint !== false;
  }
  if(d.hist) lsSet('rp_hist', JSON.stringify(d.hist));
  if(d.log) lsSet('rp_log', JSON.stringify(d.log));
  if(d.logf) lsSet('rp_logf', JSON.stringify(d.logf));
  if(d.unitId){ lsSet('rp_unit', d.unitId); const lpSel = $('lpUnit'); if(lpSel) lpSel.value = d.unitId; }
  if(d.profileId){ lsSet('rp_profile', d.profileId); lpLevel = null; }   // razina se izvede iz profila
  const m = {
    v:1, projectId: d.guestProjectId || ('k'+Date.now().toString(36)),
    createdAt: Date.now(),
    unitId: d.unitId||'', profileId: d.profileId||'', workType: d.workType||state.tip,
    topic: d.topic||'', deadline: d.deadline||'', rulesetVersion: d.rulesetVersion||'',
    lektaScore: d.lektaScore ?? null, lektaCheckedAt: d.lektaCheckedAt||'',
    lektaIssues: d.lektaIssues||[], lektaFixedTotal: d.lektaFixedTotal||0
  };
  // izravno u localStorage — ne kroz saveManifest()/saveState() da ne okineš sync natrag
  lsSet('rp_manifest', JSON.stringify(m));
  lsSet('rp_state', JSON.stringify({tip: state.tip, checks: state.checks, gen: gatherGen()}));
}
async function reconcileServerState(){
  if(!katedraLoggedIn) return;
  let data;
  try{
    const r = await fetch('/api/state');
    if(r.status === 401){ katedraLoggedIn = false; return; }
    if(!r.ok) return;
    data = await r.json();
  }catch(e){ return; }
  if(!data || !data.id){ syncServerNow(); return; } // nema retka — migriraj trenutno (gost) stanje
  // Lokalno već postoji nešto neposredno u tijeku (npr. gost upravo počeo raditi ovdje) —
  // ne gazi ga; sljedeći save će to poslati na server (moguće kao zaseban redak).
  const localHasWork = Object.keys(state.checks||{}).some(k => state.checks[k]) || !!val('a_tema') || !!val('f_tema');
  if(localHasWork) return;
  applyServerState(data);
  document.querySelectorAll('#tipSeg button').forEach(b => b.classList.toggle('on', b.dataset.tip === state.tip));
  applyTipPlaceholders(); renderPhases(); applyMode(); buildAuto(); renderDeadlines(); renderWC();
  renderLine(); renderIndeksHead(); updatePaper(); lpRenderCascade();
}

function lpUnitObj(){ if(!LEKTA_PACK) return null; const s = $('lpUnit'); return LEKTA_PACK.units.find(x => x.id === (s ? s.value : '')) || null; }

/* Razine studija — profil se svrstava po prvom workType-u koji se poklopi.
   'diplomski' je jedan zalutali zapis u packu, 'project'/'article' idu uz seminar. */
const LP_LEVELS = [
  ['final',      'Prijediplomski',      ['final']],
  ['graduate',   'Diplomski',           ['graduate', 'diplomski']],
  ['specialist', 'Specijalistički',     ['specialist']],
  ['doctoral',   'Doktorski',           ['doctoral']],
  ['seminar',    'Seminarski i ostalo', ['seminar', 'project', 'article']]
];
function lpLevelOf(p){
  const wt = p.workTypes || [];
  const hit = LP_LEVELS.find(l => l[2].some(w => wt.includes(w)));
  return hit ? hit[0] : 'seminar';
}
function lpUnitProfiles(unitId){
  const u = LEKTA_PACK && LEKTA_PACK.units.find(x => x.id === unitId);
  return ((u && u.profiles) || []).map(i => LP_BY_ID[i]).filter(Boolean);
}

/* Naziv smjera se izvodi iz p.label jer pack nema zasebno polje. Dva formata:
   "FPZG · Politologija · diplomski rad" i "Filozofski fakultet (Odsjek za
   psihologiju), diplomski rad". Skida se sastavnica s početka i naziv tipa rada
   s kraja; ako ne ostane ništa, fakultet nema podjelu po smjeru. Provjereno na
   svih 395 profila iz packa. */
const LP_DEACC = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
const LP_TYPE_RE = /^((zavr[sš]ni|diplomski|doktorski|specijalisti[cč]ki|stru[cč]ni|sveu[cč]ili[sš]ni|poslijediplomski)\s+)*(zavr[sš]ni|diplomski|doktorski|specijalisti[cč]ki)\s+(rad|thesis)$|^disertacija$|^master'?s thesis$/i;
function lpSmjerName(u, p){
  let s = String(p.label || '');
  if(s.includes('·')){
    const parts = s.split('·').map(x => x.trim()).filter(Boolean);
    parts.shift();                                    // prvi dio je sastavnica
    s = parts.filter(x => !LP_TYPE_RE.test(LP_DEACC(x).replace(/\s+/g, ' '))).join(' · ');
  } else {
    const ci = s.lastIndexOf(',');
    let head = ci > 0 ? s.slice(0, ci).trim() : s;
    const tail = ci > 0 ? s.slice(ci + 1).trim() : '';
    for(const n of [u.name, u.inst].filter(Boolean)){
      if(LP_DEACC(head).startsWith(LP_DEACC(n))){ head = head.slice(n.length).trim(); break; }
    }
    head = head.replace(/^[([\-–—,\s]+/, '').replace(/[)\]\s]+$/, '').trim();
    const mv = tail.match(/\(([^)]+)\)\s*$/);
    s = [head, mv ? mv[1].trim() : ''].filter(Boolean).join(' · ');
  }
  return s.replace(/\s{2,}/g, ' ').trim() || 'svi smjerovi';
}

function lpChosen(){ const id = lsGet('rp_profile'); return (id && LP_BY_ID[id]) || null; }
function lpSetChosen(id){
  lsSet('rp_profile', id || '');
  const m = getManifest();
  if(m){ m.profileId = id || ''; saveManifest(m); }
}
function lpProfileFor(unitId){
  if(!LEKTA_PACK) return null;
  // Izričit izbor smjera ima prednost. Bez njega se pogađalo po tipu rada, pa je
  // fakultet s više smjerova (FPZG: Politologija, Novinarstvo, Nac. sigurnost)
  // dobivao pravila prvog profila u nizu — moguće krivog.
  const chosen = lpChosen();
  if(chosen && chosen.unitId === unitId) return chosen;
  const profs = lpUnitProfiles(unitId);
  return profs.find(p => (p.workTypes || []).includes(LP_WT[state.tip])) || profs[0] || null;
}
async function lpInit(){
  const sel = $('lpUnit'); if(!sel || sel.options.length) return;
  const pack = await loadLektaPack();
  if(!pack){
    const box = $('lpCard');
    if(box) box.innerHTML = '<p style="font-size:12.5px;color:var(--mut)">Pravila fakulteta trenutno nisu dostupna — pokušaj kasnije ili otvori <a href="'+LEKTA_URL+'" target="_blank" rel="noopener" style="color:var(--acc)">Lektu</a> izravno.</p>';
    return;
  }
  pack.units.slice().sort((a,b) => a.name.localeCompare(b.name, 'hr')).forEach(u => {
    const o = document.createElement('option'); o.value = u.id;
    o.textContent = u.name + (u.inst ? ' — ' + u.inst : '');
    sel.appendChild(o);
  });
  sel.value = lsGet('rp_unit') || 'fpzg';
  if(!sel.value) sel.selectedIndex = 0;
  sel.onchange = () => { lsSet('rp_unit', sel.value); lpRenderCascade(); };
  const metaEl = $('lpMetaCount');
  if(metaEl) metaEl.textContent = pack.meta.counts.profiles + ' profila / ' + pack.meta.counts.units + ' fakulteta · generirano ' + pack.meta.generatedAt;
  const search = $('lpSearch');
  if(search) search.oninput = () => lpRenderUnits(search.value);
  lpRenderCascade();
}

/* ---------- KASKADA: fakultet → studij → smjer ---------- */
let lpLevel = null;
function lpRow(txt, sub, status, sel, onPick){
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'lp-row' + (sel ? ' on' : '');
  let h = '<span class="lp-nm">' + escA(txt) + (sub ? '<small>' + escA(sub) + '</small>' : '') + '</span>';
  if(status) h += '<span class="lp-st ' + (status === 'verified' ? 'v' : 'p') + '">'
                + (status === 'verified' ? 'potvrđen' : 'tehnički') + '</span>';
  b.innerHTML = h; b.onclick = onPick;
  return b;
}
function lpRenderUnits(filter){
  const host = $('lpUnits'); if(!host || !LEKTA_PACK) return;
  const q = LP_DEACC(filter || '');
  const cur = $('lpUnit') ? $('lpUnit').value : '';
  const units = LEKTA_PACK.units.slice().sort((a,b) => a.name.localeCompare(b.name, 'hr'))
    .filter(u => !q || LP_DEACC(u.name).includes(q) || LP_DEACC(u.inst).includes(q) || LP_DEACC(u.id).includes(q));
  host.innerHTML = '';
  if(!units.length){ host.innerHTML = '<p class="lp-empty">Nema fakulteta za „' + escA(filter) + '”.</p>'; return; }
  units.forEach(u => {
    // VIZIJA.md: nudimo sve sastavnice, ali status je vidljiv na svakom retku —
    // ne skrivamo profile koji imaju samo tehničke provjere.
    const verified = (u.profiles || []).some(pid => LP_BY_ID[pid] && LP_BY_ID[pid].status === 'verified');
    host.appendChild(lpRow(u.name, u.inst || '', verified ? 'verified' : 'partial', u.id === cur, () => {
      const sel = $('lpUnit'); if(sel) sel.value = u.id;
      lsSet('rp_unit', u.id);
      lpSetChosen('');            // smjer s prethodnog fakulteta više ne vrijedi
      lpLevel = null;
      lpRenderCascade();
      if(getManifest()) ensureManifest();
    }));
  });
  const selRow = host.querySelector('.lp-row.on');
  if(selRow) selRow.scrollIntoView({ block: 'nearest' });
}
function lpRenderLevels(){
  const host = $('lpLevels'); if(!host) return;
  const u = lpUnitObj();
  host.innerHTML = '';
  if(!u){ host.innerHTML = '<p class="lp-empty">Prvo odaberi fakultet.</p>'; return; }
  const profs = lpUnitProfiles(u.id);
  const have = LP_LEVELS.filter(l => profs.some(p => lpLevelOf(p) === l[0]));
  if(!have.length){ host.innerHTML = '<p class="lp-empty">Za ovaj fakultet pack nema profile.</p>'; return; }
  // Predodabir: razina koja odgovara odabranom tipu rada, inače prva dostupna.
  if(!have.some(l => l[0] === lpLevel)){
    const wt = LP_WT[state.tip];
    const byTip = have.find(l => l[2].includes(wt));
    lpLevel = (byTip || have[0])[0];
  }
  have.forEach(l => {
    const n = profs.filter(p => lpLevelOf(p) === l[0]).length;
    host.appendChild(lpRow(l[1], n === 1 ? '1 profil' : n + ' profila', '', l[0] === lpLevel, () => {
      lpLevel = l[0]; lpSetChosen(''); lpRenderCascade();
    }));
  });
}
function lpRenderProfiles(){
  const host = $('lpProfs'); if(!host) return;
  const u = lpUnitObj();
  host.innerHTML = '';
  if(!u || !lpLevel){ host.innerHTML = '<p class="lp-empty">Zatim razinu studija.</p>'; return; }
  const profs = lpUnitProfiles(u.id).filter(p => lpLevelOf(p) === lpLevel);
  if(!profs.length){ host.innerHTML = '<p class="lp-empty">Nema profila za ovu razinu.</p>'; return; }
  // Jedini profil znači da fakultet nema podjelu — odaberi ga sam, bez suvišnog klika.
  if(profs.length === 1 && !lpChosen()) lpSetChosen(profs[0].id);
  const cur = lpChosen();
  profs.forEach(p => {
    host.appendChild(lpRow(lpSmjerName(u, p), '', p.status, !!cur && cur.id === p.id, () => {
      lpSetChosen(p.id); lpRenderCascade();
      if(getManifest()) ensureManifest();
    }));
  });
}
function lpRenderCascade(){
  if(!$('lpUnits')) { lpRender(); return; }
  lpRenderUnits($('lpSearch') ? $('lpSearch').value : '');
  lpRenderLevels();
  lpRenderProfiles();
  ['lpColU','lpColL','lpColP'].forEach((id, i) => {
    const el = $(id); if(!el) return;
    el.classList.toggle('ready', i === 0 ? !!lpUnitObj() : i === 1 ? !!lpLevel : !!lpChosen());
  });
  lpRender();
}
function lpRender(){
  const box = $('lpCard'); if(!box || !$('lpUnit')) return;
  // Prazno stanje mora objasniti samo sebe — prije je kartica ostajala nijemo
  // prazna (npr. ako spremljeni fakultet više ne postoji u novom packu).
  const u = lpUnitObj();
  if(!u){
    box.innerHTML = '<div class="empty-note">Odaberi fakultet u prvom stupcu — ovdje će stajati pravila tvog studija: opseg, font, prored i citatni stil.</div>';
    return;
  }
  const p = lpProfileFor(u.id);
  const lekta = '<a class="att-btn" style="text-decoration:none" href="'+LEKTA_URL+'/?unit='+encodeURIComponent(u.id)+'" target="_blank" rel="noopener">✅ Provjeri u Lekti ↗</a>';
  if(!p){
    box.innerHTML = '<div class="att-card"><b>'+escA(u.name)+'</b><br><span style="font-size:12.5px;color:var(--mut)">Detaljni profili za ovaj fakultet žive u Lekti — otvori je za provjeru dokumenta.</span><div class="final-actions">'+lekta+'</div></div>';
    return;
  }
  const stLbl = (LEKTA_PACK.meta.statusLabels || {})[p.status] || p.status;
  const badge = (p.status === 'verified' ? '✅ ' : '🟡 ') + stLbl;
  let h = '<div class="att-card"><div class="att-top"><span class="nm" style="font-size:14px">'+escA(p.label || u.name)+'<small>'+badge+(p.verifiedAt ? ' · provjereno '+p.verifiedAt : '')+' · izvor: Lekta</small></span></div>';
  if(p.facts) h += '<ul style="padding-left:18px;font-size:12.8px;color:var(--mut);margin-top:8px">'+p.facts.map(f => '<li style="margin-bottom:4px">'+escA(f)+'</li>').join('')+'</ul>';
  const fm = [];
  if(p.font) fm.push(p.font + (p.size ? ' '+p.size+' pt' : ''));
  if(p.spacing) fm.push('prored ' + String(p.spacing).replace('.', ','));
  if(p.wordMin && p.wordMax) fm.push(p.wordMin.toLocaleString('hr-HR')+'–'+p.wordMax.toLocaleString('hr-HR')+' riječi');
  if(p.pageMin && p.pageMax) fm.push(p.pageMin+'–'+p.pageMax+' str.');
  if(p.minReferences) fm.push('min. '+p.minReferences+' izvora');
  // LP_CIT ima čitljiv naziv; bez njega bi ovdje pisao sirovi ključ ("fpzg").
  if(p.citation) fm.push('citiranje: ' + (LP_CIT[p.citation] || p.citation).split(/\s*[—(]/)[0].trim());
  if(fm.length) h += '<div style="font-size:12px;color:var(--mut2);margin-top:6px">'+escA(fm.join(' · '))+'</div>';
  if(p.manualChecks) h += '<div style="font-size:11.5px;color:var(--mut);margin-top:7px"><b style="color:var(--ink)">Ručne provjere:</b> '+escA(p.manualChecks.slice(0,3).join(' '))+'</div>';
  if(p.sources) h += '<div style="font-size:11px;margin-top:7px">'+p.sources.slice(0,3).map(s => '<a href="'+s.u+'" target="_blank" rel="noopener" style="color:var(--acc)">'+escA(s.t)+'</a>').join(' · ')+'</div>';
  h += '<div class="final-actions"><button class="att-btn" onclick="lpToGen()">→ U Generator</button>'+lekta+'</div></div>';
  box.innerHTML = h;
}
function lpToGen(){
  const u = lpUnitObj(); const p = u && lpProfileFor(u.id); if(!p) return;
  $('f_fakultet').value = u.name;
  const cit = LP_CIT[p.citation];
  $('f_stil').value = cit || 'prema uputama fakulteta (prilažem upute)';
  if(p.wordMin && p.wordMax) $('f_opseg').value = p.wordMin.toLocaleString('hr-HR')+'–'+p.wordMax.toLocaleString('hr-HR')+' riječi';
  else if(p.pageMin && p.pageMax) $('f_opseg').value = p.pageMin+'–'+p.pageMax+' stranica';
  if(p.minReferences) $('f_izvori').value = 'min. ' + p.minReferences;
  const tag = '[LEKTA '+p.id+']';
  const uEl = $('f_upute');
  if(!uEl.value.includes(tag)){
    const bits = [tag + ' ' + (p.facts || []).join('; ')];
    if(!cit && p.citation) bits.push('Citatni stil (Lekta): ' + p.citation + '.');
    if(p.manualChecks) bits.push(p.manualChecks.slice(0, 3).join(' '));
    uEl.value = (uEl.value ? uEl.value + '\n' : '') + bits.join(' ');
  }
  lsSet('rp_unit', u.id);
  if(getManifest()){ const m = ensureManifest(); m.profileId = p.id; saveManifest(m); }
  buildPrompt(); saveState(); setTab('gen');
  toast('✓ ' + u.name + ' — Lekta pravila ubačena u Generator');
}

/* ---------- LINIJA (koncept C) ---------- */
const LIN_ST = ['TEMA','GRAĐA','PLAN','PISANJE','AUDIT','PREDAJA','OBRANA'];
function buildLine(){
  const host = $('linSts'); if(!host || host.children.length) return;
  LIN_ST.forEach((nm, i) => {
    const s = document.createElement('div'); s.className = 'lin-st'; s.id = 'lst'+i;
    s.innerHTML = '<div class="dot"></div><div class="nm">'+nm+'</div>';
    host.appendChild(s);
  });
}
function linePos(){
  for(let i = 0; i < PHASES.length; i++){
    const items = visibleItems(PHASES[i]);
    if(!items.length) continue;
    if(!items.every(it => state.checks[PHASES[i].id+':'+it.t])) return i;
  }
  return LIN_ST.length - 1;
}
// Zajednička "što je sljedeće" poruka — koristi je i .linija (renderLine),
// i sticky next-step traka (F2), i chatStart()-ov resume pozdrav (F1).
// Jedan izvor istine umjesto tri odvojena izračuna koja mogu razići.
function nextStepText(){
  const pos = linePos();
  const phLast = PHASES[PHASES.length-1], itLast = visibleItems(phLast);
  const allDone = itLast.length && itLast.every(x2 => state.checks[phLast.id+':'+x2.t]) && pos === LIN_ST.length - 1;
  let rokTxt = '';
  const rv = val('dl_rok');
  if(rv){
    const d = Math.ceil((new Date(rv+'T12:00:00') - new Date()) / 86400000);
    rokTxt = ' · vozni red: PREDAJA ' + new Date(rv+'T12:00:00').toLocaleDateString('hr-HR') + (d >= 0 ? ' (za '+d+' d)' : ' — <b style="color:var(--bad)">⚠ kasniš '+(-d)+' d</b>');
  } else rokTxt = ' · postavi rok u Indeksu za vozni red';
  const mf = getManifest();
  if(mf && mf.lektaScore != null){
    const openN = (mf.lektaIssues || []).filter(x => x.status !== 'VERIFIED_FIXED').length;
    rokTxt += ' · Lekta dokument: <b>' + mf.lektaScore + '/100</b>' + (openN ? ' ('+openN+' otvoreno)' : '');
  }
  let pre = {t:0, c:0};
  PHASES.filter(p => p.grp === 'pre').forEach(p => {
    const it = visibleItems(p); pre.t += it.length;
    it.forEach(x2 => { if(state.checks[p.id+':'+x2.t]) pre.c++; });
  });
  const ready = pre.t && pre.c === pre.t;
  const status = allDone ? '' : ready ? '🟢 Spreman za pisanje · ' : '🔴 ' + (pre.t - pre.c) + ' koraka do pisanja · ';
  return {
    pos, allDone,
    html: allDone ? '🎉 Krajnja stanica: <b>OBRANA</b>. Hvala što ste putovali Katedrom.'
                  : status + 'Sljedeća stanica: <b>'+LIN_ST[pos]+'</b>'+rokTxt,
    label: LIN_ST[pos]
  };
}
function renderLine(){
  const host = $('linSts'); if(!host) return;
  buildLine();
  const ns = nextStepText();
  const pos = ns.pos;
  const cx = i => { const s = $('lst'+i); return s ? s.offsetLeft + s.offsetWidth / 2 : 0; };
  const x = cx(pos), x0 = cx(0), xN = cx(LIN_ST.length - 1);
  const rail = $('linRail');
  if(rail){ rail.style.left = x0 + 'px'; rail.style.right = (host.parentElement.clientWidth - xN) + 'px'; }
  const tram = $('linTram'); if(tram) tram.style.left = (x - 26) + 'px';
  const fill = $('linFill'); if(fill) fill.style.width = (xN > x0 ? ((x - x0) / (xN - x0)) * 100 : 0) + '%';
  LIN_ST.forEach((_, i) => { const s = $('lst'+i); if(s) s.className = 'lin-st' + (i < pos ? ' past' : i === pos ? ' cur' : ''); });
  const info = $('linInfo');
  if(info) info.innerHTML = ns.html;
  const nbTxt = $('nextBarTxt');
  if(nbTxt) nbTxt.innerHTML = ns.html;
  const bar = $('nextBar');
  const barVisible = !ns.allDone && typeof hasRealProgress === 'function' && hasRealProgress();
  if(bar) bar.style.display = barVisible ? 'flex' : 'none';
  const nbBtn = $('nextBarBtn');
  if(nbBtn) nbBtn.classList.toggle('glow', barVisible);
}
window.addEventListener('resize', () => { if($('linSts')) renderLine(); });

/* ---------- RASPODJELA OPSEGA ---------- */
const WC_SPLIT = {
  s: [['Uvod',15],['Razrada (2–3 poglavlja)',70],['Zaključak',15]],
  z: [['Uvod',8],['Teorijski okvir',30],['Razrada / analiza',40],['Kritički osvrt',12],['Zaključak',10]],
  d: [['Uvod',7],['Teorijski okvir',25],['Metodologija',13],['Empirijska analiza',30],['Rasprava',15],['Zaključak',10]]
};
function renderWC(){
  const out = $('wc_out'); if(!out) return;
  const n = parseInt(val('wc_total'), 10);
  if(!n || n < 1){ out.innerHTML = '<p style="font-size:12px;color:var(--mut2);font-style:italic">Upiši ukupan opseg gore da vidiš raspodjelu po poglavljima.</p>'; return; }
  const total = ($('wc_unit') && $('wc_unit').value === 'p') ? n * 300 : n;
  out.innerHTML = WC_SPLIT[state.tip].map(([nm, pct]) => {
    const w = Math.round(total * pct / 100 / 50) * 50;
    return '<div class="dl-row"><b>'+nm+' <span style="color:var(--mut2);font-weight:600">('+pct+' %)</span></b><span class="date">≈ '+w.toLocaleString('hr-HR')+' riječi · '+Math.max(1, Math.round(w/300))+' str.</span></div>';
  }).join('');
}
function lines(raw){ return raw.split('\n').map(s=>s.trim()).filter(Boolean).map(s=> s.startsWith('-')||s.startsWith('•') ? s.replace(/^•/,'-') : '- '+s).join('\n'); }
function block(title, raw){ return raw ? '\n\n## '+title+'\n'+lines(raw) : ''; }

function applyMode(){
  document.querySelectorAll('[data-modes]').forEach(el => {
    el.style.display = el.dataset.modes.split(' ').includes(state.mode) ? '' : 'none';
  });
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode===state.mode));
  buildPrompt();
}

function checkMissing(){
  const miss = [];
  document.querySelectorAll('.fld').forEach(f => f.classList.remove('missing'));
  REQ[state.mode].forEach(([id,label]) => {
    if(!val(id)){ miss.push(label); const e = $(id); if(e) e.closest('.fld').classList.add('missing'); }
  });
  $('missBox').classList.toggle('on', miss.length>0);
  $('missChips').innerHTML = miss.map(m => '<span>'+m+'</span>').join('');
  return miss;
}

function buildPrompt(){
  checkMissing();
  const t = state.tip, p = [];
  const tipL = TIP_LABEL[t];
  const meta = (lbl,v,suffix) => { if(v) p.push('- '+lbl+': '+v+(suffix||'')); };

  if(state.mode === 'write'){
    p.push(useSkills() ? 'Koristi skill katedra (mod: pisanje).' : 'Ti si vrhunski akademski pisac i mentor za radove na hrvatskom jeziku — strog prema pravilima, alergičan na izmišljene izvore.');
    p.push('');
    p.push('Pišem '+tipL+' — prati stroga pravila akademskog pisanja (formalni ton, treće lice, svaka tvrdnja s izvorom).');
    p.push('');
    p.push('## KONTEKST');
    meta('Fakultet/studij', val('f_fakultet'));
    meta('Kolegij', val('f_kolegij'));
    meta('Mentor', val('f_mentor'));
    meta('Tema', val('f_tema') || '[UPIŠI TEMU]');
    if(val('f_pitanje')) meta('Istraživačko pitanje', val('f_pitanje'));
    else p.push('- Istraživačko pitanje: još nemam finalno — vidi korak 0 dolje');
    p.push('- Mod: '+TIP_MOD[t]+($('f_brutal').checked ? ' + BRUTAL PRECISION (maksimalna gustoća, nula punjenja)' : ''));
    meta('Opseg', val('f_opseg') || '[UPIŠI OPSEG]');
    meta('Citatni stil', val('f_stil') || '[ODABERI STIL]', ' — svaki citat odmah uz tvrdnju, s točnom stranicom');
    meta('Ciljani broj izvora', val('f_izvori'));
    meta('Rok predaje', val('f_rok'));
    let s = p.join('\n');
    s += block('OBVEZNI IZVORI I TEORIJSKI OKVIRI', val('f_obvezni'));
    s += block('PRILOŽENA GRAĐA (sve je u ovom chatu)', val('f_gradja'));
    s += block('POSEBNE UPUTE MENTORA', val('f_upute'));
    s += '\n\n## NAČIN RADA — drži se točno ovih koraka\n';
    let n = 1;
    if(!val('f_pitanje')) s += '0. PRVO mi predloži 3 opcije istraživačkog pitanja s kratkim obrazloženjem i ČEKAJ moj izbor prije svega ostalog.\n';
    s += (n++)+'. PRVO izradi PLAN I PROGRAM IZRADE RADA: formalni zahtjevi mog fakulteta iz službenih uputa (web search + navedi izvor svakog zahtjeva), gap-analiza priloženog materijala ako postoji, obranjiva TEZA s empirijskim dokazima, struktura s budžetom stranica, program pisanja po potpoglavljima s izvorima, plan tablica/grafikona s vlastitim izračunima, verificirana literatura mapirana po poglavljima, metodološka upozorenja, hodogram do roka, pitanja za mene. NE piši tekst rada dok ne odobrim plan.\n';
    s += (n++)+'. Nakon odobrenja plana piši POGLAVLJE PO POGLAVLJE — strogo po programu pisanja iz plana; nakon svakog stani i čekaj moju potvrdu prije nastavka.\n';
    s += (n++)+'. Uvod obavezno: kontekst i relevantnost → istraživačko pitanje → cilj rada → pregled strukture. Zaključak = direktan odgovor na istraživačko pitanje + implikacije/preporuke.\n';
    s += (n++)+'. Svaki paragraf: tematska rečenica → objašnjenje → primjer/razrada → referenca → mini zaključak ili prijelaz.\n';
    s += (n++)+'. NIKAD ne izmišljaj izvore, citate ni podatke. Za tvrdnju bez stvarnog izvora iz priložene građe/literature označi [TREBA IZVOR] i nastavi.\n';
    s += (n++)+'. Zabranjene fraze: „kroz povijest", „od davnina", „u današnje vrijeme", „neupitno je da", „svima je poznato". Bez Wikipedije i nerecenziranih izvora.\n';
    s += (n++)+'. Na kraju rada: popis literature u zadanom stilu + self-check (svaka tvrdnja potkrijepljena, citati ispravni s točnim stranicama, svaki paragraf ima tematsku rečenicu, zaključak odgovara na pitanje iz uvoda).';
    return output(s);
  }

  if(state.mode === 'audit'){
    p.push((useSkills() ? 'Koristi skill katedra (mod: audit). ' : 'Ti si strogi recenzent akademskih radova. ')+'Napravi POTPUNI AUDIT rada — cijeli pipeline A–G (faze dolje).');
    p.push('');
    p.push('## RAD I GRAĐA');
    meta('Rad', val('f_radfile') || '[IME DATOTEKE]', ' (prilažem u ovaj chat)');
    meta('Tip rada', tipL.toLowerCase());
    meta('Fakultet/ustanova', val('f_fakultet'));
    meta('Mentor', val('f_mentor'));
    if(val('f_stil')) meta('Citatni stil', val('f_stil'));
    else p.push('- Citatni stil: auto-detektiraj iz rada pa mi ga potvrdi prije provjera');
    let s = p.join('\n');
    s += block('IZVORNA GRAĐA KOJU PRILAŽEM', val('f_gradja') || '[POPIS DATOTEKA — izvješća, projekt, seminarski, fotodokumentacija]');
    s += block('POSEBNO PROVJERI', val('f_brige'));
    s += '\n\n## PRAVILA AUDITA\n';
    s += '1. Prođi sve faze redom: A integritet (polja, tracked changes, komentari) → B citati i literatura (siročad, rupe, format svake jedinice) → C brojke/aritmetika i granica dokaza → D cross-check svake ključne tvrdnje s priloženom građom → E jezik, ponavljanja i hrvatska tipografija → F Word formatiranje (TOC/SEQ/REF polja, prijelomi, fontovi, uvlake).\n';
    s += '2. Izvor istine > dojam: svaka brojka mora postojati u građi. Ništa ne izmišljaj — što nije u građi, označi kao ograničenje rada.\n';
    s += '3. Kad se izvori međusobno razlikuju: rad mora razliku izričito deklarirati (kasnija/izvedbena izvješća > rani nacrti; fotografija > prepis).\n';
    s += '4. Jasne pogreške ispravi odmah; stilske izmjene samo predloži i čekaj moju potvrdu.\n';
    s += '5. Nakon SVAKE runde izmjena ponovno provjeri: citate (identičan skup), brojke, polja, validaciju dokumenta.\n';
    s += '6. Na kraju: izvještaj razvrstan KRITIČNO / SREDNJE / KOZMETIČKO + točno ime finalne datoteke + podsjetnik da napravim Ctrl+A → F9 u Wordu.\n';
    s += '7. Sadržajna dubina (ono za što STVARNO služiš): drži li se teza kroz SVA poglavlja, ne samo u uvodu → zaključak mora eksplicitno odgovoriti na istraživačko pitanje iz uvoda, ne samo sažeti nalaze → proporcije poglavlja prati odobreni plan (poglavlje dvostruko duže/kraće od plana je nalaz) → provjeri postoje li VLASTITI izračuni gdje ih rad tvrdi, ne samo prepisani tuđi → dosljednost HR/EN terminologije između sažetka i abstracta.\n';
    s += '8. FOKUS: ti si RECENZENT SADRŽAJA (teza, argumentacija, izvori, jezik). Strojno-formatske stavke (margine, stilovi, polja, citatna mehanika) samo označi — njih deterministički provjerava Lekta ('+LEKTA_URL+'), preporuči korisniku Lekta Check nakon ispravaka.';
    return output(s);
  }

  if(state.mode === 'obrana'){
    p.push('Pripremi me za OBRANU rada — sve gradiš iz priloženog rada, bez novog sadržaja.');
    p.push('');
    p.push('## RAD I KONTEKST');
    meta('Rad', val('f_radfile') || '[IME DATOTEKE]', ' (prilažem u ovaj chat)');
    meta('Tip', tipL.toLowerCase());
    meta('Fakultet/studij', val('f_fakultet'));
    meta('Mentor', val('f_mentor'));
    meta('Trajanje izlaganja', val('f_trajanje') || '10 min');
    meta('Datum obrane', val('f_datumobr'));
    let s = p.join('\n');
    s += block('KOMISIJA (predvidi pitanja po njihovim područjima)', val('f_komisija'));
    s += '\n\n## ŠTO TREBAM\n';
    s += '1. STRUKTURA PREZENTACIJE (točno 12 slajdova, ovim redom): 1 naslovnica (naslov, student, mentor sa zvanjem, ustanova, datum) · 2 zašto ova tema (problem u jednoj rečenici + zašto je relevantna sad) · 3 istraživačko pitanje i teza (doslovno iz rada, bez preformulacije) · 4 metodologija (podaci, izvori, vremenski okvir — ograničenja SAM navedi, ne čekaj pitanje) · 5–8 nalazi (jedan nalaz po slajdu, svaki s vlastitom tablicom/grafikonom i izvorom u podnožju) · 9 odgovor na istraživačko pitanje (eksplicitno, jedna rečenica) · 10 implikacije i preporuke · 11 ograničenja i dalji rad (kratko, samouvjereno) · 12 hvala + kontakt. Pravilo: max 6 redaka po slajdu, nijedan slajd bez razloga za postojanje.\n';
    s += '2. GOVORNI SCENARIJ tempiran na zadano trajanje (~110 riječi/min) — prirodan govorni jezik, ne čitanje rada naglas. Uz svaki dio predviđeno vrijeme i kumulativa, plus naznaka što se izbacuje ako me prekinu na 7. minuti.\n';
    s += '3. 15 PITANJA KOMISIJE, po 3 iz svake od 5 kategorija: metodološka (zašto ovaj uzorak/metoda/vremenski okvir), teorijska (zašto ovaj okvir a ne konkurentski), empirijska (odakle točno ova brojka), kritička (što nalaz NE dokazuje), praktična (što bi preporuka koštala, tko je provodi). Svaki odgovor u obliku: izravan odgovor → obrazloženje → priznata granica („izvan opsega ovog rada, ali indikacija je…").\n';
    s += '4. SLABE TOČKE RADA — prođi rad kao NEPRIJATELJSKI RECENZENT: tanak uzorak, izvor koji nije primaran, tvrdnja bez potpore, poglavlje neproporcionalne duljine, zaključak koji ide dalje od podataka. Za svaku: priznaj granicu pa je pretvori u kontrolirani nalaz — nikad ne izmišljaj obranu koju podaci ne nose.\n';
    s += '5. TOČNO PET brojki/nalaza koje moram znati napamet za dan obrane — svaka s izvorom i stranicom, plus JEDNOM rečenicom konteksta (u odnosu na što je to puno ili malo).\n';
    s += '6. Ako imaš pristup alatima za datoteke: ponudi izradu .pptx prezentacije iz točke 1.';
    return output(s);
  }

  /* improve */
  p.push((useSkills() ? 'Koristi skill katedra (mod: poboljšanje teksta). ' : 'Ti si vrhunski akademski urednik za radove na hrvatskom jeziku. ')+'POBOLJŠAJ postojeći tekst — ne piši novi rad.');
  p.push('');
  p.push('## TEKST I KONTEKST');
  meta('Tekst', val('f_imptekst') || '[DATOTEKA / zalijepljeni tekst]');
  meta('Tip rada', tipL.toLowerCase());
  meta('Fakultet/studij', val('f_fakultet'));
  meta('Mentor', val('f_mentor'));
  meta('Citatni stil', val('f_stil'));
  meta('Fokus poboljšanja', val('f_impfokus'));
  let s = p.join('\n');
  s += block('POSEBNE UPUTE MENTORA', val('f_upute'));
  s += '\n\n## POSTUPAK\n';
  s += '1. PRVO dijagnoza po točkama, bez prepisivanja: struktura (uvod, istraživačko pitanje, koherentnost argumenta), citacijski propusti (format, stranice, izvori bez potkrjepe), stilske slabosti (generičke fraze, neargumentirane tvrdnje, ponavljanja).\n';
  s += '2. Zatim plan izmjena po poglavljima — čekaj moju potvrdu prije prepisivanja.\n';
  s += '3. Pri prepisivanju STROGO: sačuvaj svaki postojeći citat i svaku brojku (identičan skup prije/poslije), ne dodaji tvrdnje bez izvora, zadrži akademski registar i hrvatsku tipografiju („navodnici", en-crtice za raspone, decimalni zarez).\n';
  s += '4. Uz svaku promijenjenu sekciju kratko navedi što je promijenjeno i zašto.';
  return output(s);
}
function output(s){ s = s.replace(/\n{3,}/g,'\n\n') + RP_TAG; $('promptOut').textContent = s; return s; }

/* ---------- COPY ---------- */
async function copyText(s, btn, miss){
  let ok = false;
  try { await navigator.clipboard.writeText(s); ok = true; }
  catch(e){
    const ta = document.createElement('textarea');
    ta.value = s; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch(e2){}
    document.body.removeChild(ta);
  }
  if(ok){
    const orig = btn.textContent;
    btn.classList.add('ok'); btn.textContent = '✓ Kopirano';
    toast(miss && miss.length ? '⚠ Kopirano, ali nedostaje: '+miss.join(', ') : '✓ Prompt kopiran — zalijepi u novi Claude chat');
    setTimeout(()=>{ btn.classList.remove('ok'); btn.textContent = orig; }, 1800);
  } else {
    toast('Kopiranje blokirano — označi tekst ručno i Ctrl+C');
  }
}
function copyPrompt(){ copyText($('promptOut').textContent, $('copyBtn'), checkMissing()); }

/* ---------- AUTOPILOT ---------- */
let chatFiles = [], chatNotes = '', chatRokVal = '';
const AUTO_DEF = {
  s:{opseg:'2.000–2.500 riječi', izv:'6–8 relevantnih izvora', str:'uvod + 2–3 poglavlja razrade + zaključak'},
  z:{opseg:'25–30 stranica', izv:'15–20 izvora', str:'uvod + teorijski okvir + razrada/analiza + zaključak (uz kratki metodološki osvrt)'},
  d:{opseg:'18.000–22.000 riječi', izv:'30+ izvora', str:'uvod + teorijski okvir + metodologija + empirijska analiza + rasprava + zaključak'}
};
function buildAuto(){
  const t = state.tip, D = AUTO_DEF[t];
  const tema = val('a_tema');
  const cp = $('a_checkpoint').checked, hasG = $('a_gradja').checked || chatFiles.length > 0;
  let s = (useSkills() ? 'Koristi skill katedra (mod: plan i program → pisanje).' : 'Ti si vrhunski akademski pisac i mentor za radove na hrvatskom jeziku — strog prema pravilima, alergičan na izmišljene izvore.') + ' AUTOPILOT MODE — vodiš cijeli proces sam, ja se uključujem minimalno.\n\n';
  s += '## ZADANO (jedino što definiram)\n';
  s += '- Tip: '+TIP_LABEL[t]+'\n';
  s += '- Tema: '+(tema || '[UPIŠI TEMU]')+'\n';
  s += hasG ? '- Građu, upute fakulteta i literaturu prilažem u ovaj chat — one su IZVOR ISTINE i imaju prednost pred svime.\n'
            : '- Nemam pripremljenu građu — literaturu pronađi sam web pretragom iz dozvoljenih baza.\n';
  if(chatFiles.length) s += '- Priložene datoteke (sve su u ovom chatu):\n' + chatFiles.map(n => '  · '+n).join('\n') + '\n';
  if(chatRokVal) s += '- Rok predaje: '+chatRokVal+' — hodogram u planu složi unatrag od ovog datuma.\n';
  if(chatNotes) s += '\n## DODATNE NAPOMENE\n' + lines(chatNotes) + '\n';
  s += '\n## DEFAULTI (vrijede jer nisam rekao drukčije — navedi ih u tablici pretpostavki na početku)\n';
  s += '- Opseg: '+D.opseg+' | Izvori: '+D.izv+'\n';
  s += '- Struktura: '+D.str+'\n';
  s += '- Citatni stil: autor-godina (Prezime, godina, str. X); ako je tema izrazito tehnička/inženjerska → IEEE [1]. Odluči prema temi i deklariraj izbor.\n';
  s += '- Formalni ton, treće lice, hrvatska tipografija („navodnici”, en-crtice za raspone, decimalni zarez).\n';
  const learn = (typeof chat !== 'undefined' && chat.learn) || (!!$('a_learn') && $('a_learn').checked);
  if(learn){
    s += '\n## NAUČI ME MOD (sokratski — aktivno)\n';
    s += '- Misaoni rad je MOJ: tezu, istraživačko pitanje, ključne argumente i zaključke formuliram ja — ti me vodiš pitanjima, nudiš opcije s prednostima i manama i ispravljaš moje formulacije.\n';
    s += '- Ti radiš: strukturu, provjeru logike, pronalazak i provjeru literature, citate, tehničko uređivanje i formatiranje.\n';
    s += '- Nakon svakog poglavlja postavi mi 2–3 kontrolna pitanja da provjeriš razumijem li vlastiti rad (priprema za obranu i usmenu provjeru).\n';
    s += '- Svaki tvoj tekstualni prijedlog označi [AI PRIJEDLOG] dok ga ne potvrdim ili preradim svojim riječima.\n';
  }
  s += '\n## AUTOPILOT PROTOKOL\n';
  s += '1. PRVI KORAK — PLAN I PROGRAM IZRADE RADA (ne piši još nijedno poglavlje!). Izradi dokument sa sekcijama: (0) izvršni sažetak — što stoji između mene i ocjene 5 i kako to plan rješava, (1) formalni zahtjevi MOG fakulteta provjereni web pretragom iz SLUŽBENIH uputa (tehnička pravila, obvezni dijelovi uklj. naslovnicu na engleskom / izjavu o čestitosti / životopis ako se traže, točan lokalni citatni format, hodogram predaje s rokovima) — uz naveden izvor svakog zahtjeva, (2) gap-analiza materijala ako sam ga priložio, (3) 3 opcije istraživačkog pitanja → sam odaberi najbolju + obranjiva TEZA s tablicom empirijskih dokaza i izvorima, (4) struktura s budžetom stranica po poglavlju, (5) program pisanja po potpoglavljima — za svako: sadržaj + izvori, (6) plan tablica i grafikona s VLASTITIM izračunima, (7) literatura verificirana (Crossref/Hrčak/DOI) i mapirana po poglavljima, (8) metodološka upozorenja — brojke koje se ne smiju koristiti bez ograde, (9) hodogram unatrag od roka s kritičnim putem, (10) pitanja za mene, (11) popis isporuka.'+(cp?' TU STANI — pisanje počinje tek kad odobrim Plan i program.':' NE čekaj odobrenje — sam usvoji plan, deklariraj to jasno i odmah nastavi na pisanje.')+'\n';
  s += '2. LITERATURA (u planu i tijekom pisanja): samo stvarni, provjerljivi izvori (HRČAK, Google Scholar, akademske knjige, službeni dokumenti, Eurostat/World Bank/OECD). Uz svaki izvor link ili DOI. Izvor čije postojanje ne možeš potvrditi — NE koristi. Wikipedia i nerecenzirano: nikad.\n';
  s += '3. PISANJE: strogo po sekciji 5 plana, poglavlje po poglavlje u jednom nizu. Nakon svakog poglavlja interni self-check (svaki paragraf: tematska rečenica → objašnjenje → primjer → referenca → prijelaz; citati odmah uz tvrdnje; bez zabranjenih fraza) pa ispravi PRIJE nastavka. Odstupanje od plana deklariraj i obrazloži — ne mijenjaj tiho. Ne postavljaj mi pitanja osim ako je nešto stvarno blokirajuće.\n';
  s += '4. CITATI: s točnom stranicom. Stranicu koju ne možeš potvrditi iz teksta izvora označi (Prezime, godina) + [PROVJERI STR.] — nikad je ne izmišljaj.\n';
  s += '5. ZAKLJUČAK = direktan odgovor na istraživačko pitanje + eksplicitan dokaz teze iz plana + implikacije/preporuke.\n';
  s += '6. ISPORUKA na kraju, bez da tražim — sve iz sekcije 11 plana, minimalno: (a) cijeli rad u jednom komadu, (b) popis literature u odabranom stilu, (c) tablica „RUČNO PROVJERI” — svi [PROVJERI STR.], pretpostavke koje mentor mora potvrditi, pravila fakulteta, (d) samoprocjena po self-check listi.\n';
  s += '7. Ako imaš pristup alatima za datoteke: složi i .docx verziju po uputama fakulteta (predložak ako je priložen).\n';
  s += '\nMOJIH 30 SEKUNDI: '+(hasG?'priložiti građu u ovaj chat':'ništa za priložiti')+(cp?' + odobriti Plan i program u koraku 1.':'.')+' Sve ostalo je tvoje.';
  s += RP_TAG;
  $('autoOut').textContent = s;
}

/* ---------- ROK KALKULATOR ---------- */
const MILESTONES = {
  s:[['Struktura + literatura spremne',-10],['Draft gotov',-5],['Mentoru na pregled',-4],['Audit + finalne izmjene',-2],['PREDAJA',0]],
  z:[['Struktura potvrđena (mentor)',-28],['Draft gotov',-14],['Audit (rad-audit)',-12],['Mentoru na pregled',-10],['Izmjene + mini audit',-4],['PREDAJA',0]],
  d:[['Struktura potvrđena (mentor)',-45],['Draft gotov',-21],['Audit (rad-audit)',-16],['Mentoru na pregled',-14],['Izmjene + mini audit',-5],['PREDAJA',0]]
};
function renderDeadlines(){
  const v = $('dl_rok').value, out = $('dl_out');
  if(!v){ out.innerHTML = '<p style="font-size:12px;color:var(--mut2);font-style:italic">Upiši službeni rok gore da vidiš interne rokove unatrag.</p>'; return; }
  const rok = new Date(v+'T12:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  out.innerHTML = MILESTONES[state.tip].map(([lbl,off]) => {
    const d = new Date(rok); d.setDate(d.getDate()+off);
    const past = d < today;
    const ds = d.toLocaleDateString('hr-HR',{weekday:'short', day:'2-digit', month:'2-digit', year:'numeric'});
    return '<div class="dl-row'+(past?' past':'')+'"><b>'+lbl+'</b><span class="date">'+ds+(past?' ⚠ prošlo':'')+'</span></div>';
  }).join('');
}

/* ---------- EXPORT / IMPORT / RESET ---------- */
function exportState(){
  const data = JSON.stringify({app:'Katedra', tip:state.tip, mode:state.mode, checks:state.checks, gen: gatherGen()}, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], {type:'application/json'}));
  a.download = 'katedra-napredak.json';
  a.click(); URL.revokeObjectURL(a.href);
  toast('💾 Napredak spremljen');
}
function importState(file){
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      state.tip = d.tip || 'z'; state.checks = d.checks || {}; state.mode = d.mode || 'write';
      if(d.gen){
        GEN_IDS.forEach(id => { if($(id) && d.gen[id] !== undefined) $(id).value = d.gen[id]; });
        ['f_brutal','a_gradja','u_skills','a_learn'].forEach(k => { if($(k)) $(k).checked = !!d.gen[k]; });
        $('a_checkpoint').checked = d.gen.a_checkpoint !== false;
      }
      document.querySelectorAll('#tipSeg button').forEach(b => b.classList.toggle('on', b.dataset.tip===state.tip));
      applyTipPlaceholders(); renderPhases(); applyMode(); buildAuto(); renderDeadlines(); saveState();
      toast('📂 Napredak učitan');
    } catch(e){ toast('⚠ Neispravna datoteka'); }
  };
  r.readAsText(file);
}
function resetAll(){
  if(!confirm('Resetirati sve kvačice za novi rad? (Polja generatora ostaju)')) return;
  state.checks = {}; renderPhases(); saveState(); toast('↺ Checklista resetirana — sretno s novim radom!');
}

/* ---------- TOAST ---------- */
let toastT;
function toast(msg){
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('on'), 3200);
}

/* ---------- TIP RADA ---------- */
function applyTipPlaceholders(){
  $('f_opseg').placeholder = TIP_OPSEG[state.tip];
  $('f_izvori').placeholder = TIP_IZV[state.tip];
}

/* ---------- CHEATSHEET ---------- */
$('cheatRoot').innerHTML = `
<p class="cs full" style="font-size:12.8px;color:var(--mut);padding:2px 2px 4px;background:transparent;border:0;box-shadow:none">Brza referenca dok pišeš ili provjeravaš rad — pravila citiranja, tipografije i formata na jednom mjestu, plus pravila tvog fakulteta ispod.</p>
<div class="cs">
  <h3><em>🏗️</em> Struktura rada — obavezni elementi</h3>
  <ol>
    <li><b>Uvod:</b> kontekst i relevantnost → istraživačko pitanje → cilj rada → pregled strukture</li>
    <li><b>Razrada:</b> logička poglavlja s naslovima; teorija UVIJEK povezana s analizom (implikacije, ograničenja, kritički osvrt)</li>
    <li><b>Metodologija</b> (diplomski): pristup, uzorak, ograničenja</li>
    <li><b>Zaključak:</b> sažetak nalaza → direktan odgovor na istraživačko pitanje → implikacije/preporuke</li>
    <li><b>Opseg:</b> seminarski 1.500–3.000 riječi (5–10 izvora) · diplomski 15.000–30.000 (30+ izvora)</li>
  </ol>
</div>
<div class="cs">
  <h3><em>🧩</em> Anatomija svakog paragrafa</h3>
  <ol>
    <li><b>Tematska rečenica</b> — o čemu je odlomak</li>
    <li><b>Objašnjenje koncepta</b> — što to znači / kako funkcionira</li>
    <li><b>Primjer ili razrada</b> — konkretno, kontekstualizirano</li>
    <li><b>Referenca</b> — uz svaku tvrdnju koja traži potkrjepu</li>
    <li><b>Mini zaključak / prijelaz</b> — što slijedi, veza s idućim odlomkom</li>
  </ol>
  <p style="font-size:12.5px;color:var(--mut);margin-top:8px">Jedan odlomak = jedna ideja. Bez bullet lista u tekstu rada.</p>
</div>
<div class="cs">
  <h3><em>📌</em> Citiranje</h3>
  <div class="cite-ex"><b>(Lindblom, 1959, str. 81)</b><small>FPZG autor-godina — UVIJEK s točnom stranicom, odmah uz tvrdnju (ne na kraj paragrafa)</small></div>
  <div class="cite-ex"><b>[1] · [1, 3] · [19–22]</b><small>IEEE numerički (tehnički radovi) — numeracija redom prvog pojavljivanja, bez rupa</small></div>
  <ul>
    <li>Bez „ibid." u tekstu (samo u fusnotama ako se izričito traži)</li>
    <li>Web izvori: naslov, URL, <b>datum pristupa</b> (dosljedan format)</li>
    <li>„Bez godine" = crveni flag — nađi godinu, ne izmišljaj</li>
    <li>Nikad ne izmišljaj izvore ni podatke — provjeri svaki na Scholar/HRČAK/DOI</li>
  </ul>
</div>
<div class="cs">
  <h3><em>🚫</em> Zabranjene AI fraze</h3>
  <div class="chips">
    <span class="chip bad">kroz povijest</span><span class="chip bad">od davnina</span>
    <span class="chip bad">u današnje vrijeme</span><span class="chip bad">od kada postoji čovječanstvo</span>
    <span class="chip bad">neupitno je da</span><span class="chip bad">svima je poznato</span>
  </div>
  <p style="font-size:12.5px;color:var(--mut);margin-top:10px">Umjesto toga: konkretan kontekst s izvorom. Piši u studentsko-akademskom registru — formalno, treće lice, bez kolokvijalizama.</p>
</div>
<div class="cs">
  <h3><em>✅</em> Dozvoljeni izvori</h3>
  <div class="chips">
    <span class="chip good">HRČAK</span><span class="chip good">Google Scholar</span><span class="chip good">JSTOR</span>
    <span class="chip good">akademske knjige</span><span class="chip good">EU institucije</span><span class="chip good">nacionalne vlade</span>
    <span class="chip good">Eurostat</span><span class="chip good">World Bank</span><span class="chip good">OECD</span>
  </div>
</div>
<div class="cs">
  <h3><em>❌</em> Zabranjeni izvori</h3>
  <div class="chips">
    <span class="chip bad">Wikipedia (nikad)</span><span class="chip bad">blogovi bez autora</span>
    <span class="chip bad">nerecenzirani materijali</span><span class="chip bad">novinski članci kao primarni izvor</span>
  </div>
  <p style="font-size:12.5px;color:var(--mut);margin-top:10px">Novinski članci smiju samo kao empirijska ilustracija — nikad kao teorijska potkrjepa.</p>
</div>
<div class="cs full">
  <h3><em>✍️</em> Hrvatska tipografija — brza referenca</h3>
  <table>
    <tr><th>Element</th><th>Ispravno</th><th>Pogrešno</th></tr>
    <tr><td>Navodnici</td><td><b>„tekst”</b> (U+201E / U+201D)</td><td><s>“tekst”</s> (engleski) · <s>"tekst"</s> (ravni)</td></tr>
    <tr><td>Raspon</td><td><b>2019–2024 · 16–22 mm</b> (en-crtica, bez razmaka)</td><td><s>2019-2024</s> (spojnica)</td></tr>
    <tr><td>Umetnuta rečenica</td><td><b>riječ – riječ</b> (en-crtica s razmacima)</td><td><s>riječ — riječ</s> · <s>riječ-riječ</s></td></tr>
    <tr><td>Množenje / dimenzije</td><td><b>80 × 80 mm</b> (znak ×)</td><td><s>80 x 80</s> (slovo x)</td></tr>
    <tr><td>Decimale</td><td><b>4,50 m</b> (zarez)</td><td><s>4.50 m</s> (točka)</td></tr>
    <tr><td>Broj + jedinica</td><td><b>40 t · 100 mm · 230 bar</b> (razmak, idealno NBSP)</td><td><s>40t · 100mm</s></td></tr>
    <tr><td>Kut vs temperatura</td><td><b>10°</b> (bez razmaka) · <b>20 °C</b> (s razmakom)</td><td><s>10 °</s> · <s>20°C</s></td></tr>
    <tr><td>Postotak</td><td><b>45 %</b> ili <b>45%</b> — dosljedno kroz cijeli rad</td><td><s>miješano</s></td></tr>
    <tr><td>Tri točke</td><td><b>…</b> (U+2026)</td><td><s>...</s></td></tr>
  </table>
</div>
<div class="cs">
  <h3><em>🔍</em> Audit pipeline A–G (mapa)</h3>
  <ol>
    <li><b>A Integritet</b> — polja, tracked changes, komentari</li>
    <li><b>B Citati</b> — definirano = citirano, bez siročadi i rupa</li>
    <li><b>C Brojke</b> — aritmetika + granica dokaza</li>
    <li><b>D Cross-check</b> ⚑ — svaka tvrdnja potvrđena u građi</li>
    <li><b>E Jezik</b> — ponavljanja, ritam, tipografija</li>
    <li><b>F Formatiranje</b> — TOC/SEQ/REF polja, fontovi, prijelomi</li>
    <li><b>G Ispravci</b> — pa PONOVNA provjera svega</li>
  </ol>
  <p style="font-size:12.5px;color:var(--mut);margin-top:8px">Željezno pravilo: nakon SVAKE izmjene → citati + brojke + polja + validacija.</p>
</div>
<div class="cs">
  <h3><em>⚙️</em> Word mehanika — prije predaje</h3>
  <ul>
    <li>SADRŽAJ i POPISI = <b>TOC polja</b>, ne ručno tipkani</li>
    <li>Natpisi tablica/slika = <b>SEQ</b> auto-numeracija; spomeni u tekstu = <b>REF</b></li>
    <li>Natpis tablice <b>iznad</b>, slike <b>ispod</b>; „Izvor:" dosljedan</li>
    <li>Praznine / „zaključana" tablica → makni <b>pageBreakBefore</b>, tablice na <b>autofit</b></li>
    <li>Jedan font posvuda → provjeri i <b>theme</b> (Calibri/Cambria probijaju kroz naslove)</li>
    <li>Finale: <b>Ctrl+A → F9</b> pa vizualni pregled</li>
  </ul>
</div>
<div class="cs full" id="fakCard">
  <h3><em>🏛️</em> Pravila fakulteta — izvor: Lekta</h3>
  <p style="font-size:12.5px;color:var(--mut);margin-bottom:8px">Verificirana pravila iz <a href="https://lektahr.netlify.app" target="_blank" rel="noopener" style="color:var(--acc);font-weight:700">Lekta baze</a> (<span id="lpMetaCount">učitavam…</span>) — svako bodovano pravilo sljedivo je do službenog izvora fakulteta. Katedra ih koristi za plan i prompt; <b>mjerodavnu provjeru dokumenta radi Lekta</b>.</p>
  <select id="lpUnit" style="display:none" aria-hidden="true" tabindex="-1"></select>
  <div class="lp-cascade">
    <div class="lp-col" id="lpColU">
      <h5><em>1</em>Fakultet</h5>
      <input id="lpSearch" class="lp-search" type="search" placeholder="Traži fakultet…" aria-label="Traži fakultet">
      <div class="lp-list" id="lpUnits"></div>
    </div>
    <div class="lp-col" id="lpColL">
      <h5><em>2</em>Studij</h5>
      <div class="lp-list" id="lpLevels"><p class="lp-empty">Prvo odaberi fakultet.</p></div>
    </div>
    <div class="lp-col" id="lpColP">
      <h5><em>3</em>Smjer</h5>
      <div class="lp-list" id="lpProfs"><p class="lp-empty">Zatim razinu studija.</p></div>
    </div>
  </div>
  <div id="lpCard"></div>
</div>
</div>
<div class="cs full">
  <h3><em>📐</em> Plan i program — obavezni prvi korak (sekcije 0–11)</h3>
  <p style="font-size:12.8px;color:var(--mut);margin-bottom:10px">Prva isporuka SVAKOG rada, prije ijednog poglavlja. Plan od jednog dana otkriva razloge zašto rad ne bi dobio peticu — dok ih je još jeftino ispraviti. Ugrađen u Autopilot i Generator prompte (+ dostupan kao skill <b>plan-i-program</b>).</p>
  <ol>
    <li><b>0 · Izvršni sažetak</b> — što stoji između rada i ciljane ocjene (3–5 razloga) i kako ih plan rješava</li>
    <li><b>1 · Formalni zahtjevi</b> — iz SLUŽBENIH uputa fakulteta: tehnička pravila, obvezni dijelovi (naslovnica na engleskom, izjava o čestitosti, životopis!), točan lokalni citatni format, hodogram predaje (Turnitin + uvez + referada = 10–14 dana)</li>
    <li><b>2 · Gap-analiza</b> — što je u postojećem materijalu pogrešno: numeracija, dupli naslovi, format literature, ručno tipkan sadržaj…</li>
    <li><b>3 · Teza</b> — obranjiva tvrdnja + tablica empirijskih dokaza s izvorima. Bez teze rad je deskriptivan, a deskriptivan rad ne nosi peticu</li>
    <li><b>4 · Struktura s budžetom stranica</b> — poglavlje → stranice → uloga; podjednake duljine po pravilima fakulteta</li>
    <li><b>5 · Program pisanja</b> — za svako potpoglavlje: točan sadržaj + izvori [P]/[D]/[E]. Pisanje poslije = izvršavanje, ne izmišljanje</li>
    <li><b>6 · Plan tablica i grafikona</b> — vlastiti izračuni („Izvor: autorov izračun prema…”) vrijede znatno više od preuzetih slika</li>
    <li><b>7 · Literatura</b> — verificirana (Crossref/Hrčak/DOI), mapirana po poglavljima; svaki izvor s popisa citiran barem jednom</li>
    <li><b>8 · Metodološka upozorenja</b> — brojke koje se NE smiju koristiti bez ograde (promjene definicija KPI-jeva, neusporedive osnove, medijski nepotvrđeno)</li>
    <li><b>9 · Hodogram</b> — unatrag od roka, s mentorovim komentarima i administrativnim repom; kritični put = odobrenje plana</li>
    <li><b>10 · Pitanja korisniku</b> + <b>11 · Popis isporuka</b> — što treba od tebe i što točno dobivaš na kraju</li>
  </ol>
</div>
<div class="cs full">
  <h3><em>✉️</em> Mail predlošci za mentora</h3>
  <div class="cite-ex"><b>1 · Potvrda teme i citatnog stila</b><small>Poštovani/a [titula prezime], za [tip rada] predlažem temu „[tema]”. Planirani okvir: opseg [X], citatni stil [autor-godina / IEEE]. Molim potvrdu teme i stila prije nego krenem s pisanjem. Srdačan pozdrav, [ime]</small></div>
  <div class="cite-ex"><b>2 · Slanje drafta</b><small>Poštovani/a, u privitku je radna verzija rada. Posebno molim osvrt na [strukturu / poglavlje X]. Rok predaje je [datum], pa bih Vaše komentare volio uklopiti do [datum − 3 dana]. Hvala unaprijed.</small></div>
  <div class="cite-ex"><b>3 · Finalna verzija / prijava obrane</b><small>Poštovani/a, šaljem finalnu verziju s uklopljenim komentarima. Molim potvrdu da mogu predati, odnosno informaciju o daljnjim koracima za [predaju / prijavu obrane].</small></div>
</div>
<div class="cs full">
  <h3><em>🕳️</em> Zamke koje su nas stvarno ugrizle</h3>
  <div class="trap"><span class="t-ico">📁</span><div><b>Google Drive konektor vuče max ~10 MB.</b> <span>Veći ZIP/PDF prilaži izravno u chat — upload nema taj limit.</span></div></div>
  <div class="trap"><span class="t-ico">📝</span><div><b>Word re-save razbija tekst u fragmente.</b> <span>Tipfeleri se znaju sakriti u razbijenim runovima — zato audit, ne ručno traženje.</span></div></div>
  <div class="trap"><span class="t-ico">🔄</span><div><b>Neprihvaćene tracked changes ruše sve provjere.</b> <span>Prije audita prihvati sve izmjene i riješi komentare.</span></div></div>
  <div class="trap"><span class="t-ico">📄</span><div><b>Ručno tipkan SADRŽAJ = krive stranice.</b> <span>Mora biti TOC polje + Ctrl+A → F9 prije predaje.</span></div></div>
  <div class="trap"><span class="t-ico">🖨️</span><div><b>PDF pregled iz konvertera nije dokaz fonta.</b> <span>Fontove provjeri u Wordu / pravom PDF exportu.</span></div></div>
  <div class="trap"><span class="t-ico">🤖</span><div><b>AI zna izmisliti izvor koji ne postoji.</b> <span>Svaki izvor provjeri na Scholar/HRČAK/DOI prije nego uđe u literaturu.</span></div></div>
  <div class="trap"><span class="t-ico">⚖️</span><div><b>Kad se izvori razlikuju, rad mora razliku deklarirati.</b> <span>Kasnija/izvedbena izvješća &gt; rani nacrti; fotografija oznake &gt; tekstualni prepis.</span></div></div>
</div>`;
lpInit();

/* =============== CHAT WIZARD =============== */
function goChat(){ setTab('chat'); }
function setTip(t){
  state.tip = t;
  document.querySelectorAll('#tipSeg button').forEach(x => x.classList.toggle('on', x.dataset.tip===t));
  applyTipPlaceholders(); renderPhases(); buildPrompt(); buildAuto(); renderDeadlines(); renderWC(); updatePaper(); lpRenderCascade(); saveState();
}

const chat = { step:'mode', mode:null, files:[], skipped:new Set(), notes:'', rok:'', pendingTema:'', warned:false, reqMissing:[], learn:false, izjNaslov:'', izjSel:null };
let currentCat = -1;
const MODE_LBL = {write:'✍️ Novi rad', audit:'🧠 Recenzija rada', ocjena:'📊 Ocijeni draft', improve:'🛠️ Poboljšanje teksta', obrana:'🎤 Priprema obrane', izjava:'📝 Izjava o AI'};
const IZJ_USES = [
  'pretraživanje i pregled literature',
  'izrada nacrta i strukture rada',
  'lektura, stil i jasnoća teksta',
  'parafraziranje uz vlastito uređivanje',
  'pisanje dijelova teksta uz moje uređivanje i provjeru',
  'prijevod',
  'izrada i provjera tablica ili grafikona',
  'provjera citata i literature',
  'priprema za obranu'
];
const IZJ_LVL = {
  0:'0 — alati umjetne inteligencije nisu korišteni',
  1:'1 — AI za pomoćne zadatke (lektura, pretraživanje literature)',
  2:'2 — AI za strukturu i parafraziranje, uz vlastito pisanje teksta',
  3:'3 — AI je sudjelovao u izradi dijelova teksta, uz moje uređivanje, provjeru i punu odgovornost'
};
const TIP_UI = {s:'Seminarski', z:'Završni', d:'Diplomski'};
const CHAT_ATT = {
 write:[
  {ic:'📜', nm:'Upute fakulteta za pisanje radova', d:'PDF s pravilima formatiranja i citiranja. Nemaš? Claude ih nađe web searchom.', req:0},
  {ic:'📄', nm:'Word predložak / naslovnica fakulteta', d:'Da rad od prve stranice bude u točnom formatu.', req:0},
  {ic:'🗂️', nm:'Postojeći sadržaj, draft ili bilješke', d:'Ako postoji — Plan i program dobiva gap-analizu.', req:0},
  {ic:'📚', nm:'Literatura koju već imaš (PDF-ovi)', d:'Claude citira iz stvarnog teksta → točne stranice, bez [PROVJERI STR.].', req:0},
  {ic:'📊', nm:'Izvorna građa: izvješća, projekti, podaci', d:'Sve na što će se rad pozivati — izvor istine.', req:0},
  {ic:'📝', nm:'Prošli rad s komentarima mentora', d:'Da se iste zamjerke ne ponove.', req:0}
 ],
 audit:[
  {ic:'📄', nm:'Rad koji se auditira (.docx)', d:'Bez ovoga audit ne može krenuti.', req:1},
  {ic:'🗂️', nm:'SVA izvorna građa', d:'Izvješća, projekt, seminarski, fotodokumentacija — za cross-check (faza D).', req:1},
  {ic:'📜', nm:'Upute fakulteta', d:'Za provjeru formata i citatnog stila.', req:0}
 ],
 improve:[
  {ic:'📄', nm:'Tekst / draft koji se poboljšava', d:'.docx — ili ćeš tekst zalijepiti izravno u Claude chat.', req:1},
  {ic:'📝', nm:'Komentari mentora', d:'Da poboljšanje cilja točno ono što je zamjereno.', req:0},
  {ic:'📜', nm:'Upute fakulteta', d:'Format i citatni stil.', req:0}
 ],
 obrana:[
  {ic:'📄', nm:'Finalni rad (.docx ili PDF)', d:'Iz njega se gradi prezentacija, scenarij i pitanja komisije.', req:1},
  {ic:'🖼️', nm:'Predložak prezentacije fakulteta', d:'Ako fakultet ima svoj PPT predložak.', req:0}
 ],
 ocjena:[
  {ic:'📄', nm:'Draft rada (.docx ili PDF)', d:'Ono što želiš da se ocijeni — može i nedovršeno.', req:1},
  {ic:'📜', nm:'Upute fakulteta', d:'Da se ocijeni i usklađenost s formalnim pravilima.', req:0},
  {ic:'📝', nm:'Raniji komentari mentora', d:'Da se provjeri jesu li adresirani.', req:0}
 ]
};

const MICRO = [
 {ic:'📩', t:'Mentor vratio komentare', d:'Plan izmjena po komentaru, pa primjena bez diranja ostatka',
  p:'Prilažem rad i komentare mentora (mail / datoteka / zalijepljeno dolje).\n1. Izlistaj SVAKI mentorov komentar kao numeriranu stavku + tvoj plan izmjene za svaku (što, gdje, koliko teksta).\n2. ČEKAJ moju potvrdu plana.\n3. Zatim primijeni izmjene — NE diraj ništa što mentor nije tražio: u nepromijenjenim dijelovima identičan skup citata i brojki.\n4. Na kraju: popis svih izmjena + mini provjera (citati, brojke, polja, sadržaj).'},
 {ic:'⏭️', t:'Nastavi rad u NOVOM chatu', d:'Kad je stari razgovor postao predug',
  p:'Nastavljamo pisanje rada. Prilažem: dosad napisani rad + Plan i program (+ literaturu).\n1. Pročitaj priloženo i kratko sažmi gdje smo stali (dovršena poglavlja, otvorene stavke).\n2. Nastavi od poglavlja [UPIŠI BROJ] STROGO po programu pisanja iz plana — isti stil, isti citatni format, ne mijenjaj postojeći tekst.\n3. Poglavlje po poglavlje — nakon svakog stani i čekaj moju potvrdu.'},
 {ic:'⏸️', t:'Claude je stao usred odgovora', d:'Nastavak bez ponavljanja i mijenjanja',
  p:'Stao si usred odgovora. Nastavi TOČNO gdje si stao — od zadnje potpune rečenice, bez ponavljanja već napisanog i bez mijenjanja prethodnog teksta. Ako je poglavlje dovršeno, prijeđi na sljedeće po planu.'},
 {ic:'🔍', t:'Provjeri literaturu (postoji li svaki izvor)', d:'Anti-halucinacija provjera prije predaje',
  p:'Provjeri popis literature (prilažem / zalijepljen dolje). Za SVAKI izvor:\n1. Potvrdi da stvarno postoji — web search, nađi DOI ili link.\n2. Provjeri podatke: autori, godina, naslov, časopis/izdavač, vol./br./stranice.\n3. Označi: ✅ potvrđeno (s linkom) · ✏️ ispravak (navedi što je krivo) · ⚠ NEPOTVRĐENO — kandidat za izbacivanje.\nNišta ne izmišljaj. Na kraju: tablica statusa + ispravljeni popis u istom citatnom stilu.'},
 {ic:'✂️', t:'Skrati tekst bez gubitka', d:'Kad si preko dopuštenog opsega',
  p:'Skrati priloženi tekst [na UPIŠI riječi / za UPIŠI %] BEZ gubitka sadržaja:\n- sačuvaj SVE citate (identičan skup), sve brojke i sve tvrdnje s izvorima\n- reži punjenje, ponavljanja, prazne fraze i preduge uvode\n- zadrži akademski registar i logiku argumenta\nNa kraju: broj riječi prije/poslije + što je izrezano (po kategorijama).'},
 {ic:'🏷️', t:'Naslovi + sažetak + ključne riječi', d:'HR sažetak, EN abstract, 5 naslova',
  p:'Iz priloženog rada generiraj:\n1. 5 opcija naslova — precizno, akademski, bez senzacionalizma (+ kraća varijanta svakog)\n2. Sažetak 150–250 riječi: problem → cilj i pitanje → metoda → glavni nalazi → doprinos\n3. Abstract — prijevod sažetka na engleski (akademski registar)\n4. 5–6 ključnih riječi na hrvatskom i engleskom\nSve isključivo iz sadržaja rada — bez novih tvrdnji.'},
 {ic:'📚', t:'Predloži dodatnu literaturu', d:'5–8 stvarnih izvora s DOI, mapirano po poglavljima',
  p:'Prilažem rad i trenutni popis literature. Predloži 5–8 DODATNIH relevantnih izvora:\n- samo stvarni i provjerljivi (uz svaki DOI ili link — provjeri web searchom)\n- za svaki: 1 rečenica što pokriva + u koje poglavlje ide\n- ništa što već imam; prednost recenziranim radovima i službenim izvorima\nFormat: gotove bibliografske jedinice u mom citatnom stilu [UPIŠI STIL].'},
 {ic:'🗂️', t:'Dnevnik procesa (dokaz autorstva)', d:'Generira kronologiju iz Claude razgovora',
  p:'Iz CIJELOG ovog razgovora generiraj DNEVNIK PROCESA IZRADE RADA (dokaz mog autorstva za mentora):\n1. Kronološka tablica: faza → što je napravljeno → moja odluka/doprinos → AI doprinos\n2. Popis svih mojih odobrenja i traženih izmjena (plan, poglavlja, revizije)\n3. Kratki narativ (pola stranice) kako je rad nastajao\nTočno i bez uljepšavanja — služi kao transparentan dokaz procesa izrade.'}
];

const STEPS = ['Zadatak','Tip','Tema','Datoteke','Detalji','Prompt'];
function setStep(i){
  $('stepbar').innerHTML = STEPS.map((s,idx) =>
    '<span class="'+(idx<i?'done':idx===i?'cur':'')+'">'+(idx<i?'✓ ':'')+s+'</span>').join('');
  chatClockMount();   // innerHTML gore obriše sat, pa ga vrati
}

/* ---------- Šahovski sat: čiji je red ----------
   Prikazuje se samo u živom razgovoru. U čarobnjaku bi uvijek pisalo isto
   ("na potezu: ti"), a pokazivač koji nikad ne mijenja vrijednost je šum. */
function chatClockMount(){
  const bar = $('stepbar'); if(!bar) return;
  let c = $('chatClock');
  if(!c){ c = document.createElement('div'); c.id = 'chatClock'; c.className = 'chat-clock'; }
  if(c.parentNode !== bar) bar.appendChild(c);
  chatTurn(chat.busy ? 'k' : 'ti');
}
function chatTurn(who){
  const c = $('chatClock'); if(!c) return;
  c.hidden = !chat.live;
  c.innerHTML = '<i' + (who === 'ti' ? ' class="on"' : '') + '>Na potezu: ti</i>' +
                '<i' + (who === 'k'  ? ' class="on"' : '') + '>Katedra</i>';
}
function chatBusy(v){ chat.busy = v; chatTurn(v ? 'k' : 'ti'); }
function chatScroll(){ const l = $('chatLog'); l.scrollTop = l.scrollHeight; }
function setComposer(ph){ $('chatInput').placeholder = ph; }
function pushA(html){
  const d = document.createElement('div'); d.className = 'msg a';
  d.innerHTML = '<div class="bub">'+html+'</div>';
  $('chatLog').appendChild(d); chatScroll(); return d;
}
function pushU(text){
  const d = document.createElement('div'); d.className = 'msg u';
  const b = document.createElement('div'); b.className = 'bub'; b.textContent = text;
  d.appendChild(b); $('chatLog').appendChild(d); chatScroll();
}
function pushChips(list){
  const row = document.createElement('div'); row.className = 'chips-row';
  list.forEach(([lbl, cb, ghost]) => {
    const b = document.createElement('button'); b.className = 'qchip'+(ghost?' ghost':''); b.textContent = lbl;
    b.onclick = () => { row.remove(); cb(); };
    row.appendChild(b);
  });
  $('chatLog').appendChild(row); chatScroll(); return row;
}

// Ima li korisnik već stvaran napredak (nasuprot potpuno praznog stanja)?
// Koristi se samo pri POČETNOM učitavanju — "🔁 Ispočetka" gumbi i dalje
// pozivaju chatStart() bez argumenta pa uvijek daju pravi svježi start.
function hasRealProgress(){
  const anyChecked = Object.keys(state.checks || {}).some(k => state.checks[k]);
  const mf = getManifest();
  return anyChecked || !!(mf && mf.topic);
}
function goToNextStep(pos){
  setTab('check');
  const ph = PHASES[pos]; if(!ph) return;
  if(!openPhases.has(ph.id)) togglePhase(ph.id);
  setTimeout(() => { const el = document.getElementById('ph-'+ph.id); if(el) el.scrollIntoView({behavior: smoothly(), block:'center'}); }, 60);
}
function chatStart(isInitial){
  $('chatLog').innerHTML = '';
  Object.assign(chat, {step:'mode', mode:null, files:[], skipped:new Set(), notes:'', rok:'', pendingTema:'', warned:false, reqMissing:[], learn:false, izjNaslov:'', izjSel:null, live:false, msgs:[], busy:false});
  chatFiles = []; chatNotes = ''; chatRokVal = '';
  if(typeof updatePaper === 'function') updatePaper();
  setStep(0);
  if(isInitial && hasRealProgress()){
    const ns = nextStepText();
    const tema = val('a_tema') || val('f_tema');
    pushA((tema ? '👋 Bok opet — nastavljaš <b>'+escA(tema)+'</b>.' : '👋 Bok opet — nastavljaš svoj rad.') + '<br>' + ns.html);
    pushChips([
      ['▶ Nastavi', () => goToNextStep(ns.pos)],
      ['📋 Prikaži izbornik', () => chatModeChips(), true]
    ]);
    setComposer('…ili upiši poruku');
  } else {
    pushA('Bok! 👋 Ja sam <b>Katedra</b> — kopilot za seminarski, završni i diplomski.<br>Odgovoriš na par pitanja → dobiješ <b>gotovu uputu za Claude</b> + popis datoteka koje priložiti. Ništa se ne zaboravlja, ništa se ne izmišlja.<br><br><b>Što danas radimo?</b>');
    chatModeChips();
    setComposer('…ili odmah upiši temu rada svojim riječima');
  }
}
function chatModeChips(){
  let list;
  if(typeof isAdv === 'function' && isAdv()){
    list = [
      [MODE_LBL.write, () => chatMode('write')],
      [MODE_LBL.audit, () => chatMode('audit')],
      [MODE_LBL.ocjena, () => chatMode('ocjena')],
      [MODE_LBL.improve, () => chatMode('improve')],
      [MODE_LBL.obrana, () => chatMode('obrana')],
      [MODE_LBL.izjava, () => chatMode('izjava')],
      ['🧩 Brzi prompti', chatMicro, true],
      ['❓ Kako ovo radi?', chatExplain, true]
    ];
  } else {
    list = [
      ['✍️ Pišem novi rad', () => chatMode('write')],
      ['📄 Imam gotov rad / draft', chatDoneMenu],
      ['❓ Kako ovo radi?', chatExplain, true]
    ];
  }
  const h = getHist();
  if(h.length) list.push(['🕘 Moji promptovi ('+h.length+')', chatHistory, true]);
  pushChips(list);
}
function chatDoneMenu(){
  pushU('📄 Imam gotov rad / draft');
  pushA('<b>Što želiš s njim?</b>');
  pushChips([
    ['✅ Provjeri DOKUMENT — Lekta ↗', () => { pushU('✅ Lekta provjera dokumenta'); window.open(lektaLink(), '_blank'); pushA('Lekta provjerava <b>dokument</b> (format, struktura, citatna mehanika) — deterministički, po verificiranim pravilima tvog fakulteta. Kad dobiješ nalaze, vrati se ovdje: <b>🧠 Recenzija</b> pokriva sadržaj, a ispravke vodimo zajedno.'); chatModeChips(); }],
    ['🧠 Recenziraj SADRŽAJ (Katedra)', () => chatMode('audit')],
    ['📊 Ocijeni ga — što bi mentor rekao', () => chatMode('ocjena')],
    ['🛠️ Poboljšaj ga', () => chatMode('improve')],
    ['🎤 Pripremi obranu', () => chatMode('obrana')],
    ['📝 Izjava o korištenju AI', () => chatMode('izjava')],
    ['🧩 Nastavljam pisati — brzi prompti', chatMicro, true],
    ['↩ Natrag', () => { pushU('↩ Natrag'); chatModeChips(); }, true]
  ]);
}
function chatHistory(){
  pushU('🕘 Moji promptovi');
  const h = getHist();
  const d = pushA('<b>Spremljeni promptovi</b> (zadnjih '+h.length+') — klikni Kopiraj i nastavi gdje si stao:');
  const bub = d.querySelector('.bub');
  h.forEach(e => {
    const row = document.createElement('div'); row.className = 'att-card';
    row.innerHTML = '<div class="att-top"><span class="ic">📄</span><span class="nm">'+escA(e.label||'Prompt')+'<small>'+new Date(e.t).toLocaleDateString('hr-HR')+' · '+(MODE_LBL[e.mode]||e.mode)+'</small></span></div>';
    const b = document.createElement('button'); b.className = 'att-btn'; b.textContent = 'Kopiraj';
    b.onclick = () => copyText(e.prompt, b, []);
    row.querySelector('.att-top').appendChild(b); bub.appendChild(row);
  });
  const clr = document.createElement('button'); clr.className = 'att-skip'; clr.textContent = 'Obriši povijest';
  clr.onclick = () => { lsSet('rp_hist','[]'); d.remove(); toast('Povijest obrisana'); };
  bub.appendChild(clr); chatScroll();
  chatModeChips();
}
function chatMicro(){
  pushU('🧩 Brzi prompti');
  const d = pushA('<b>Brzi prompti za sredinu procesa</b> — klikni naslov za pregled ili odmah Kopiraj (dijelove u [UGLATIM ZAGRADAMA] prilagodi):');
  const bub = d.querySelector('.bub');
  MICRO.forEach(m => {
    const row = document.createElement('div'); row.className = 'att-card';
    row.innerHTML = '<div class="att-top"><span class="ic">'+m.ic+'</span><span class="nm" style="cursor:pointer">'+m.t+'<small>'+m.d+'</small></span></div>';
    const b = document.createElement('button'); b.className = 'att-btn'; b.textContent = 'Kopiraj';
    b.onclick = () => copyText(m.p, b, []);
    row.querySelector('.att-top').appendChild(b);
    row.querySelector('.nm').onclick = () => {
      const dd = pushA('<b>'+m.ic+' '+m.t+'</b>');
      const out = document.createElement('div'); out.className = 'prompt-out'; out.textContent = m.p;
      const cp = document.createElement('button'); cp.className = 'copy-btn'; cp.textContent = '📋 Kopiraj';
      cp.style.marginTop = '10px'; cp.onclick = () => copyText(m.p, cp, []);
      dd.querySelector('.bub').append(out, cp); chatScroll();
    };
    bub.appendChild(row);
  });
  chatScroll();
  chatModeChips();
}
function chatExplain(){
  pushU('❓ Kako ovo radi?');
  pushA('Jednostavno, 3 koraka:<br>1️⃣ <b>Odgovoriš na par pitanja</b> — vodim te korak po korak, ništa ne moraš znati unaprijed.<br>2️⃣ <b>Dodaš datoteke</b> — kažem ti točno što pomaže (upute fakulteta, literatura, draft…). Nemaš? Preskočiš.<br>3️⃣ <b>Dobiješ gotovu uputu (prompt)</b> — kopiraš je u <b>Claude</b> (claude.ai, besplatan račun), priložiš iste datoteke i pošalješ. Claude prvo napravi detaljan <b>plan rada</b>, pa piše poglavlje po poglavlje uz tvoje odobrenje.<br><br>Detalji u tabu <b>❓ Kako radi</b>. Idemo?');
  chatModeChips();
}
function chatMode(m){
  chat.mode = m; pushU(MODE_LBL[m]);
  if(m === 'izjava') return izjavaStart();
  chat.step = 'tip'; setStep(1);
  pushA('<b>Koji tip rada?</b>');
  pushChips([['Seminarski', ()=>chatTipPick('s')], ['Završni', ()=>chatTipPick('z')], ['Diplomski', ()=>chatTipPick('d')]]);
}

/* ---------- IZJAVA O KORIŠTENJU AI ---------- */
function izjavaStart(){
  chat.step = 'izj_naslov'; setStep(1);
  pushA('<b>📝 Izjava o korištenju AI</b> — hrvatski fakulteti (FPZG, FOI…) od 2026. traže ovu izjavu u radu. Složimo je u 3 klika.<br><br><b>Naslov rada?</b> Upiši dolje ↓ ili preskoči (ostat će mjesto za upis).');
  pushChips([['⏭ Preskoči', () => { chat.izjNaslov=''; izjavaUses(); }, true]]);
  setComposer('Upiši naslov rada…'); $('chatInput').focus();
}
function izjavaUses(){
  chat.step = 'izj_uses'; setStep(3); chat.izjSel = new Set();
  const d = pushA('<b>Za što si koristio/la AI?</b> Klikni SVE što vrijedi, pa Nastavi:');
  const bub = d.querySelector('.bub');
  const row = document.createElement('div'); row.className = 'chips-row'; row.style.marginTop = '10px'; row.style.maxWidth = '100%';
  IZJ_USES.forEach((u, i) => {
    const b = document.createElement('button'); b.className = 'qchip ghost'; b.textContent = u;
    b.onclick = () => { b.classList.toggle('sel'); chat.izjSel.has(i) ? chat.izjSel.delete(i) : chat.izjSel.add(i); };
    row.appendChild(b);
  });
  bub.appendChild(row);
  const acts = document.createElement('div'); acts.className = 'final-actions';
  const go = document.createElement('button'); go.className = 'fa p'; go.textContent = 'Nastavi ➜'; go.onclick = izjavaMentor;
  acts.appendChild(go); bub.appendChild(acts); chatScroll();
}
function izjavaMentor(){
  chat.step = 'izj_mentor'; setStep(4);
  pushU(chat.izjSel.size ? [...chat.izjSel].map(i => IZJ_USES[i]).join(' · ') : 'AI nije korišten');
  pushA('<b>Je li mentor upoznat s korištenjem AI?</b> (FPZG za završne i diplomske traži konzultaciju s mentorom)');
  pushChips([
    ['✅ Da, odobrio je', () => izjavaFinal('da')],
    ['📩 Još nisam pitao/la', () => izjavaFinal('ne')],
    ['ℹ️ Fakultet ne traži odobrenje', () => izjavaFinal('nt'), true]
  ]);
}
function izjavaFinal(mentor){
  chat.step = 'done'; setStep(5);
  const sel = [...(chat.izjSel || [])].map(i => IZJ_USES[i]);
  const lvl = chat.izjSel.has(4) ? 3 : (chat.izjSel.has(1) || chat.izjSel.has(3)) ? 2 : sel.length ? 1 : 0;
  const mentorLine = mentor === 'da' ? 'korištenje AI alata odobrio je mentor'
                   : mentor === 'ne' ? 'konzultacija s mentorom o korištenju AI alata bit će obavljena prije predaje rada'
                   : 'prema uputama ustanove posebno odobrenje mentora nije predviđeno';
  let t = 'IZJAVA O KORIŠTENJU ALATA UMJETNE INTELIGENCIJE\n\n';
  t += 'Ja, ______________________, izjavljujem da sam pri izradi rada\n';
  t += '„' + (chat.izjNaslov || '______________________') + '”\n';
  t += sel.length ? 'koristio/la alate umjetne inteligencije transparentno i u skladu sa smjernicama ustanove, kako slijedi:\n\n'
                  : 'postupao/la u skladu sa smjernicama ustanove o umjetnoj inteligenciji.\n\n';
  if(sel.length){
    t += 'Alat: Claude (Anthropic)\n';
    t += 'Svrhe i faze korištenja:\n' + sel.map(s => '· ' + s).join('\n') + '\n\n';
  } else {
    t += 'Alati umjetne inteligencije nisu korišteni u izradi ovog rada.\n\n';
  }
  t += 'Procijenjena razina korištenja (skala 0–4): ' + IZJ_LVL[lvl] + '\n';
  t += 'Mentor: ' + mentorLine + '.\n\n';
  t += 'Sav tekst rada moje je autorsko djelo za koje preuzimam punu odgovornost. Svi izvori i citati provjereni su u izvornoj literaturi. Sadržaj u čijoj je izradi sudjelovao AI alat pregledan je, uređen i potvrđen s moje strane. Transkripti razgovora s AI alatom pohranjeni su i mogu se dostaviti na zahtjev.\n\n';
  t += 'U ______________, dana ______________          Potpis: ______________';
  const d = pushA('<b>✅ Izjava je spremna.</b> Kopiraj je u rad (obično iza izjave o akademskoj čestitosti) i <b>prilagodi točnom obrascu svog fakulteta</b> — FPZG i FOI imaju vlastite formate.');
  const bub = d.querySelector('.bub');
  const out = document.createElement('div'); out.className = 'prompt-out'; out.textContent = t; bub.appendChild(out);
  const note = document.createElement('div'); note.style.cssText = 'margin-top:9px;font-size:12.5px;color:var(--warn)';
  note.textContent = '⚠ Spremi i transkripte razgovora s Claudeom (izvoz chata) — FPZG ih smije zatražiti.';
  bub.appendChild(note);
  const acts = document.createElement('div'); acts.className = 'final-actions';
  const cp = document.createElement('button'); cp.className = 'fa p'; cp.textContent = '📋 Kopiraj izjavu';
  cp.onclick = () => copyText(t, cp, []);
  const re = document.createElement('button'); re.className = 'fa s'; re.textContent = '🔁 Ispočetka'; re.onclick = chatStart;
  acts.append(cp, re); bub.appendChild(acts); chatScroll();
  pushHist({t: Date.now(), mode:'izjava', tip: state.tip, label: 'Izjava o AI — ' + (chat.izjNaslov || 'bez naslova').slice(0,50), prompt: t});
  rpLog('Generirana izjava o korištenju AI (razina ' + lvl + ')');
}
function chatTipPick(t){
  setTip(t); pushU(TIP_UI[t]);
  if(chat.mode === 'write'){
    if(chat.pendingTema){ $('a_tema').value = chat.pendingTema; buildAuto(); kpType(chat.pendingTema); renderIndeksHead(); chatLearnStep(); }
    else {
      chat.step = 'tema'; setStep(2);
      pushA('<b>Tema rada?</b> Upiši je dolje ↓ — dovoljna je radna verzija, izoštrit ćemo je u planu.');
      setComposer('Upiši temu rada…'); $('chatInput').focus();
    }
  } else chatAttach();
}
function chatTema(text){
  $('a_tema').value = text; buildAuto(); kpType(text); renderIndeksHead(); pushU(text); chatLearnStep();
}
function chatLearnStep(){
  chat.step = 'learn';
  pushA('<b>Kako želiš raditi?</b>');
  pushChips([
    ['✍️ Piši sa mnom — brže', () => { chat.learn = false; pushU('✍️ Piši sa mnom'); chatAttach(); }],
    ['🎓 Nauči me — vodi me pitanjima', () => { chat.learn = true; pushU('🎓 Nauči me'); chatAttach(); }]
  ]);
}
function chatAttach(){
  chat.step = 'files'; chat.warned = false; setStep(3);
  const sugg = CHAT_ATT[chat.mode];
  const d = pushA('<b>📎 Dodaj datoteke</b> — evo što ubrzava proces i diže kvalitetu (klik na <b>+ Dodaj</b> kod stavke ili veliki ＋ dolje):');
  const bub = d.querySelector('.bub');
  sugg.forEach((s, i) => {
    const c = document.createElement('div'); c.className = 'att-card'+(s.req?' reqd':''); c.id = 'attC'+i;
    c.innerHTML = `<div class="att-top"><span class="ic">${s.ic}</span><span class="nm">${s.nm}${s.req?' <span class="rq">OBAVEZNO</span>':''}<small>${s.d}</small></span>
      <button class="att-btn" onclick="pickFor(${i})">+ Dodaj</button>
      <button class="att-skip" onclick="skipAtt(${i})">nemam</button></div>
      <div class="att-files" id="attF${i}"></div>`;
    bub.appendChild(c);
  });
  const gen = document.createElement('div'); gen.className = 'att-files'; gen.id = 'attFx'; bub.appendChild(gen);
  const acts = document.createElement('div'); acts.className = 'final-actions';
  const go = document.createElement('button'); go.className = 'fa p'; go.textContent = 'Nastavi ➜'; go.onclick = chatAfterFiles;
  acts.appendChild(go); bub.appendChild(acts); chatScroll();
  setComposer('…ili upiši napomenu');
}
function pickFor(i){ currentCat = i; $('chatFilePick').click(); }
function skipAtt(i){ chat.skipped.add(i); const c = $('attC'+i); if(c) c.classList.add('skipped'); }
function addChatFiles(fileList){
  Array.from(fileList).forEach(f => {
    chat.files.push({name: f.name, cat: currentCat, file: f});
    const host = $(currentCat >= 0 ? 'attF'+currentCat : 'attFx');
    if(host){
      const sp = document.createElement('span'); sp.textContent = '✓ '+f.name;
      const x = document.createElement('i'); x.textContent = ' ×';
      x.onclick = () => { chat.files = chat.files.filter(cf => !(cf.name===f.name)); sp.remove(); updatePaper(); };
      sp.appendChild(x); host.appendChild(sp);
    }
    const c = currentCat >= 0 ? $('attC'+currentCat) : null; if(c) c.classList.remove('skipped');
    if(currentCat >= 0) chat.skipped.delete(currentCat);
  });
  updatePaper();
  if(chat.step !== 'files' && fileList.length){
    pushA('📎 Zabilježio sam: <b>'+Array.from(fileList).map(f=>f.name).join('</b>, <b>')+'</b> — ući će u prompt i podsjetnik za upload.');
  }
  chatScroll();
}
function chatAfterFiles(){
  const sugg = CHAT_ATT[chat.mode];
  const missing = sugg.map((s,i)=>({s,i})).filter(o => o.s.req && !chat.files.some(f=>f.cat===o.i) && !chat.skipped.has(o.i));
  if(missing.length && !chat.warned){
    chat.warned = true;
    pushA('⚠ <b>Fali ti obavezno:</b> '+missing.map(o=>o.s.nm).join(' · ')+'.<br>Bez toga '+(chat.mode==='audit'?'audit ne može krenuti kako treba':'rezultat će biti slabiji')+'.');
    pushChips([['↩ Dodat ću ih sada', ()=>{ chat.warned = false; }], ['➜ Svejedno nastavi', ()=>{ chat.reqMissing = missing.map(o=>o.s.nm); chatNext(); }, true]]);
    return;
  }
  chatNext();
}
function chatNext(){
  const n = chat.files.length;
  pushU(n ? '📎 '+n+' datotek'+(n===1?'a':n<5?'e':'a')+' dodano' : 'Bez datoteka');
  if(chat.mode === 'write') chatRok(); else chatNotesStep();
}
function chatRok(){
  chat.step = 'rok'; setStep(4);
  const d = pushA('<b>📅 Rok predaje?</b> <span style="color:var(--mut2)">(neobavezno)</span> Hodogram u Planu i programu slaže se unatrag od njega.');
  const bub = d.querySelector('.bub');
  const acts = document.createElement('div'); acts.className = 'final-actions';
  const inp = document.createElement('input'); inp.type = 'date';
  inp.style.cssText = 'background:var(--bg2);border:1px solid var(--line2);border-radius:10px;color:var(--txt);padding:9px 12px;font-family:inherit;font-size:13px;color-scheme:light;outline:none';
  const ok = document.createElement('button'); ok.className = 'fa p'; ok.textContent = 'Potvrdi';
  ok.onclick = () => {
    if(!inp.value) return toast('Odaberi datum ili preskoči');
    chat.rok = inp.value; $('dl_rok').value = inp.value; renderDeadlines();
    chatRokVal = new Date(inp.value+'T12:00:00').toLocaleDateString('hr-HR',{day:'numeric',month:'numeric',year:'numeric'});
    acts.remove(); pushU('📅 '+chatRokVal); chatNotesStep();
  };
  const skip = document.createElement('button'); skip.className = 'fa s'; skip.textContent = 'Preskoči';
  skip.onclick = () => { acts.remove(); chatNotesStep(); };
  acts.append(inp, ok, skip); bub.appendChild(acts); chatScroll();
}
function chatNotesStep(){
  chat.step = 'notes'; setStep(4);
  pushA('<b>Još nešto što trebam znati?</b> Upute mentora, posebne želje, što te muči… Upiši dolje — ili odmah složi prompt.');
  pushChips([['⚡ Složi prompt', chatFinal]]);
  setComposer('npr. mentorica traži poglavlje o metodologiji…'); $('chatInput').focus();
}
function chatFinal(){
  chat.step = 'done';
  chatFiles = chat.files.map(f => f.name); chatNotes = chat.notes;
  let prompt = '';
  if(chat.mode === 'write'){ buildAuto(); prompt = $('autoOut').textContent; }
  else if(chat.mode === 'ocjena'){ prompt = buildOcjena(); }
  else {
    state.mode = chat.mode; applyMode();
    const names = chat.files.map(f => f.name);
    const doc = names.find(n => /\.(docx?|pdf)$/i.test(n)) || names[0] || '';
    if(chat.mode === 'audit'){
      if(doc) $('f_radfile').value = doc;
      $('f_gradja').value = names.filter(n => n !== doc).join('\n');
      if(chat.notes) $('f_brige').value = chat.notes;
    }
    if(chat.mode === 'improve'){
      if(doc) $('f_imptekst').value = doc + ' (prilažem)';
      if(chat.notes) $('f_upute').value = chat.notes;
    }
    if(chat.mode === 'obrana'){
      if(doc) $('f_radfile').value = doc;
      if(chat.notes) $('f_komisija').value = chat.notes;
    }
    prompt = buildPrompt();
  }
  setStep(5);
  const d = pushA('<b>✅ Gotovo — tvoja uputa (prompt) je spremna.</b><br>Najbrže: <b>▶ Piši ovdje</b> — kreće odmah, bez copy-pastea, s automatskim praćenjem napretka i Lekta provjerom. Imaš već svoj Claude? Kopiraj prompt dolje i nastavi ručno.');
  const bub = d.querySelector('.bub');
  const out = document.createElement('div'); out.className = 'prompt-out'; out.textContent = prompt; bub.appendChild(out);
  if(chat.files.length){
    const rem = document.createElement('div'); rem.style.cssText = 'margin-top:10px;font-size:12.8px;color:var(--mut)';
    rem.innerHTML = '<b style="color:var(--ok)">📎 Privuci u Claude chat:</b><br>' + chat.files.map(f => '· '+f.name).join('<br>');
    bub.appendChild(rem);
  }
  if(chat.reqMissing.length){
    const w = document.createElement('div'); w.style.cssText = 'margin-top:8px;font-size:12.8px;color:var(--bad)';
    w.innerHTML = '⚠ <b>Prije slanja obavezno pripremi još:</b> ' + chat.reqMissing.join(' · ');
    bub.appendChild(w);
  }
  const acts = document.createElement('div'); acts.className = 'final-actions';
  const live = document.createElement('button'); live.className = 'fa p'; live.textContent = '▶ Piši ovdje — bez copy-paste';
  live.onclick = async () => {
    const loggedIn = await refreshAuthAndCredits();
    if(!loggedIn) return goToLogin();
    if(katedraKnownLow) return showPaywall();
    liveBegin(prompt);
  };
  acts.appendChild(live);
  const re = document.createElement('button'); re.className = 'fa s'; re.textContent = '🔁 Ispočetka'; re.onclick = chatStart;
  const share = document.createElement('button'); share.className = 'fa s'; share.textContent = '📤 Podijeli Katedra';
  share.onclick = async () => {
    const msg = 'Pišeš seminarski, završni ili diplomski? Katedra — besplatni kopilot od plana do obrane: ' + RP_URL;
    if(navigator.share){ try{ await navigator.share({title:'Katedra', text: msg, url: RP_URL}); }catch(e){} }
    else copyText(msg, share, []);
  };
  if(chat.mode === 'write' || chat.mode === 'audit' || chat.mode === 'ocjena'){
    const lk = document.createElement('a'); lk.className = 'fa s'; lk.href = lektaLink(); lk.target = '_blank'; lk.rel = 'noopener'; lk.textContent = '✅ Lekta provjera ↗';
    acts.append(lk, share, re);
  } else { acts.append(share, re); }
  bub.appendChild(acts);
  // Ručni put ostaje potpuno dostupan — samo vizualno sveden na alternativu,
  // ne na ravnopravnu opciju. "Piši ovdje" gore ostaje jedini 'fa p' gumb.
  const manual = document.createElement('div');
  manual.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)';
  manual.innerHTML = '<div style="font-size:11.5px;color:var(--mut2);margin-bottom:6px">Imaš već svoj Claude Pro?</div>';
  const manualActs = document.createElement('div'); manualActs.className = 'final-actions';
  const cp = document.createElement('button'); cp.className = 'fa s'; cp.textContent = '📋 Kopiraj prompt';
  cp.onclick = () => copyText(prompt, cp, []);
  const open = document.createElement('a'); open.className = 'fa s'; open.href = 'https://claude.ai/new'; open.target = '_blank'; open.rel = 'noopener'; open.textContent = 'Otvori Claude ↗';
  manualActs.append(cp, open);
  manual.appendChild(manualActs);
  const manualNote = document.createElement('div');
  manualNote.style.cssText = 'font-size:11px;color:var(--mut2);margin-top:6px';
  manualNote.textContent = 'Ručno kopiranje ne prati napredak, ne sinkronizira se s Lekta provjerom i ne generira AI ledger za dokaz autorstva.';
  manual.appendChild(manualNote);
  bub.appendChild(manual);
  if(!lsGet('rp_email_off')){
    const em = document.createElement('div'); em.className = 'auto-note'; em.style.borderLeftColor = 'var(--acc2)'; em.id = 'emailCta';
    em.innerHTML = '<b>📬 Nove verzije i predlošci</b> — ostavi mail pa ti javim nadogradnje.<br>';
    const yes = document.createElement('button'); yes.className = 'att-btn'; yes.style.marginTop = '7px'; yes.textContent = 'Ostavi mail';
    yes.onclick = () => { window.open(EMAIL_URL || 'mailto:danielrisavi77@gmail.com?subject=Katedra%20nadogradnje&body=Javi%20mi%20nove%20verzije%20Katedraa.', '_blank'); lsSet('rp_email_off','1'); em.remove(); };
    const no = document.createElement('button'); no.className = 'att-skip'; no.textContent = 'ne, hvala';
    no.onclick = () => { lsSet('rp_email_off','1'); em.remove(); };
    em.append(yes, no); bub.appendChild(em);
  }
  chatScroll();
  setComposer('Za novi rad klikni 🔁 Ispočetka');
  const histLabel = (chat.mode === 'write' ? (val('a_tema') || 'Novi rad')
    : chat.mode === 'ocjena' ? ('Ocjena drafta — ' + (chat.files[0] ? chat.files[0].name : 'draft'))
    : (val('f_radfile') || MODE_LBL[chat.mode])).slice(0,60);
  pushHist({t: Date.now(), mode: chat.mode, tip: state.tip, label: histLabel, prompt});
  ensureManifest();
  rpLog('Generiran prompt: ' + histLabel + ' (' + (MODE_LBL[chat.mode]||chat.mode) + ')');
  // F3: prvi stvarno generiran prompt otključava napredne tabove — jednosmjerno,
  // nikad se ne vraća natrag u jednostavni mod ako korisnik sam to kasnije uključi.
  if(!isAdv()){ lsSet('rp_adv', '1'); applyAdv(); }
  // ensureManifest() gore upravo može promijeniti hasRealProgress() (topic se
  // prvi put upisuje) — next-bar to inače ne bi vidio do sljedećeg checkboxa/
  // resizea, pa bi ostao "zaostao" dok se stranica ručno ne osvježi.
  renderLine();
}
function buildOcjena(){
  const names = chat.files.map(f => f.name);
  const doc = names.find(n => /\.(docx?|pdf)$/i.test(n)) || names[0] || '[DATOTEKA — prilažem]';
  let s = (useSkills() ? 'Koristi skill katedra (mod: audit) kao podlogu znanja. ' : 'Ti si strog ali konstruktivan recenzent akademskih radova na hrvatskom jeziku. ');
  s += 'OCIJENI priloženi draft — dijagnoza bez prepisivanja teksta.\n\n';
  s += '## DRAFT\n- Datoteka: ' + doc + ' (prilažem u chat)\n- Tip rada: ' + TIP_LABEL[state.tip].toLowerCase() + '\n';
  const rest = names.filter(n => n !== doc);
  if(rest.length) s += '- Dodatno prilažem: ' + rest.join(', ') + '\n';
  if(chat.notes) s += '- Napomene: ' + chat.notes + '\n';
  s += '\n## RUBRIKA — svaku dimenziju ocijeni 1–5 uz obrazloženje i KONKRETNA mjesta u tekstu (poglavlje/odlomak)\n';
  s += '1. TEZA I ISTRAŽIVAČKO PITANJE — postoji li obranjiva teza; odgovara li zaključak na pitanje iz uvoda\n';
  s += '2. ARGUMENTACIJA — logika, povezanost teorije i analize, protuargumenti\n';
  s += '3. DOKAZI I IZVORI — potkrijepljenost tvrdnji, kvaliteta izvora, točnost i format citata\n';
  s += '4. STRUKTURA — redoslijed i ravnoteža poglavlja, prijelazi, anatomija paragrafa (tematska rečenica → razrada → mini zaključak)\n';
  s += '5. JEZIK I STIL — akademski registar, ponavljanja, generičke AI fraze, hrvatska tipografija\n';
  s += '6. FORMALNO — dosljednost citatnog stila, obvezni dijelovi rada\n';
  s += '\n## OUTPUT\n';
  s += '1. Tablica: dimenzija → ocjena 1–5 → glavni problem u jednoj rečenici\n';
  s += '2. TOP 5 stvari koje bi mentor PRVO zamjerio — po prioritetu, s točnim mjestom u tekstu\n';
  s += '3. 3 najjača dijela rada (da ih ne pokvarim u reviziji)\n';
  s += '4. Procjena ocjene (2–5) + što TOČNO nedostaje za jednu ocjenu više\n';
  s += '5. NE prepisuj i NE dotjeruj tekst — samo dijagnoza. Prepisivanje ide zasebno, uz moju potvrdu.';
  return s + RP_TAG;
}
/* ══════════ PRAVI CHAT U APLIKACIJI (preko /api/chat — server drži ključ) ══════════ */
function fileB64(f){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}
async function liveBegin(promptText){
  chat.live = true; chat.step = 'live'; chat.msgs = []; chatBusy(false); chatClockMount();
  const blocks = [], skipped = [];
  for(const cf of chat.files){
    const f = cf.file;
    if(!f){ skipped.push(cf.name); continue; }
    try{
      if(f.type === 'application/pdf' && f.size < 20*1024*1024){
        blocks.push({type:'document', source:{type:'base64', media_type:'application/pdf', data: await fileB64(f)}});
      } else if(/^image\//.test(f.type) && f.size < 5*1024*1024){
        blocks.push({type:'image', source:{type:'base64', media_type:f.type, data: await fileB64(f)}});
      } else skipped.push(cf.name);
    }catch(e){ skipped.push(cf.name); }
  }
  let text = promptText;
  if(skipped.length) text += '\n\n[NAPOMENA: ove datoteke nisam mogao priložiti izravno (podržani su PDF i slike): ' + skipped.join(', ') + '. Reci mi ako ti trebaju pa ću sadržaj zalijepiti kao tekst.]';
  blocks.push({type:'text', text});
  chat.msgs.push({role:'user', content: blocks});
  pushA('▶ <b>Pišemo ovdje.</b> Uputa i datoteke poslane su Claudeu — odgovaraj dolje u polju kao u običnom chatu.');
  setComposer('Odgovori Claudeu… (npr. „odobravam plan")');
  await liveStream();
}
async function liveSend(v){
  chat.msgs.push({role:'user', content: v});
  await liveStream();
}
async function liveStream(){
  if(chat.busy) return; chatBusy(true);
  const d = pushA(''); const bub = d.querySelector('.bub'); bub.textContent = '…';
  let full = '', outTok = 0;
  try{
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: chat.msgs })
    });
    if(resp.status === 401){ d.remove(); chatBusy(false); goToLogin(); return; }
    if(resp.status === 402){ d.remove(); chatBusy(false); showPaywall(); return; }
    if(!resp.ok){ const e = await resp.text(); throw new Error(resp.status + ' — ' + e.slice(0, 260)); }
    const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = '';
    while(true){
      const {done, value} = await reader.read(); if(done) break;
      buf += dec.decode(value, {stream:true});
      const lines = buf.split('\n'); buf = lines.pop();
      for(const ln of lines){
        if(!ln.startsWith('data: ')) continue;
        try{
          const ev = JSON.parse(ln.slice(6));
          if(ev.type === 'content_block_delta' && ev.delta && ev.delta.text){ full += ev.delta.text; bub.textContent = full; chatScroll(); }
          if(ev.type === 'message_delta' && ev.usage && ev.usage.output_tokens) outTok = ev.usage.output_tokens;
        }catch(e){}
      }
    }
    if(!full){ throw new Error('prazan odgovor — pokušaj ponovno'); }
    chat.msgs.push({role:'assistant', content: full});
    if(outTok){
      const u = document.createElement('div');
      u.style.cssText = 'margin-top:8px;font-size:10.5px;color:var(--mut2)';
      u.textContent = '≈ ' + outTok.toLocaleString('hr-HR') + ' tokena odgovora';
      bub.appendChild(u);
    }
    const cp = document.createElement('button'); cp.className = 'att-btn'; cp.style.marginTop = '8px'; cp.textContent = 'Kopiraj odgovor';
    cp.onclick = () => copyText(full, cp, []);
    bub.appendChild(cp);
    rpLog('Claude odgovor u aplikaciji (' + (full.length > 60 ? full.slice(0,60) + '…' : full).replace(/\n/g,' ') + ')');
    refreshAuthAndCredits();
  }catch(e){
    bub.innerHTML = '⚠ <b>Greška:</b> ' + escA(String(e.message || e)) + '<br><span style="font-size:12px;color:var(--mut)">Pokušaj ponovno za koju sekundu.</span>';
  }
  chatBusy(false); chatScroll();
}

/* ---------- ŽIVI DOKUMENT (koncept A) + INDEKS zaglavlje ---------- *//* ---------- ŽIVI DOKUMENT (koncept A) + INDEKS zaglavlje ---------- */
function renderIndeksHead(){
  const r = $('ihRad'); if(r) r.textContent = val('a_tema') || '— upiši temu u Startu —';
  const k = $('ihRok'); if(k){ const rv = val('dl_rok'); k.textContent = rv ? new Date(rv+'T12:00:00').toLocaleDateString('hr-HR') : 'nije postavljen'; }
}
function updatePaper(){
  if(!$('kpaper')) return;
  const tema = val('a_tema');
  const tEl = $('kpTitle');
  if(!tEl.dataset.typing){
    tEl.innerHTML = tema ? escA(tema).toUpperCase() : '<span class="ph">— ovdje će pisati tvoja tema —</span>';
  }
  const tl = TIP_LABEL[state.tip];
  $('kpSub').textContent = tl.charAt(0) + tl.slice(1).toLowerCase() + ' · Zagreb, ' + new Date().getFullYear() + '.';
  $('kpFak').textContent = val('f_fakultet') || 'tvoj fakultet';
  $('kpPct').textContent = 'RAD: ' + (window.__pct || 0) + ' %';
  /* sadržaj: poglavlja iz raspodjele opsega; žive nakon PLAN faze, pune se s PISANJEM */
  const chaps = WC_SPLIT[state.tip];
  const pos = linePos();
  const planDone = pos >= 3;
  const phW = PHASES[3], itW = visibleItems(phW);
  const wr = itW.length ? itW.filter(it => state.checks[phW.id+':'+it.t]).length / itW.length : 0;
  const liveCount = Math.floor(wr * chaps.length + 0.001);
  $('kpToc').innerHTML = chaps.map(([nm], i) => {
    const live = planDone && i < liveCount;
    const partial = planDone && i === liveCount && wr > 0 && wr < 1;
    const p = live ? '100 %' : partial ? '~40 %' : planDone ? '0 %' : '';
    return '<div class="kp-chap ' + (planDone ? '' : 'ghost') + ((live || partial) ? ' live' : '') + '">' +
      '<div class="t">' + (i+1) + '. ' + nm + '<span class="pc">' + p + '</span></div>' +
      '<div class="sk"><i style="width:' + (90 - i*6) + '%"></i><i style="width:' + (72 - i*5) + '%"></i></div></div>';
  }).join('');
  const kf = $('kpFiles');
  if(chat.files.length){
    kf.innerHTML = chat.files.slice(0,6).map(f => '<div>· ' + escA(f.name) + '</div>').join('') +
      (chat.files.length > 6 ? '<div>+ još ' + (chat.files.length - 6) + '</div>' : '');
  } else kf.innerHTML = '<div style="border:0;color:var(--pl-ph);font-style:italic">— još nema priloga —</div>';
  const rv = val('dl_rok');
  $('kpRok').textContent = rv ? new Date(rv+'T12:00:00').toLocaleDateString('hr-HR', {day:'numeric', month:'long', year:'numeric'}) : 'nije postavljen';
}
function kpType(text){
  const el = $('kpTitle'); if(!el) return;
  el.dataset.typing = '1'; el.innerHTML = '';
  const up = text.toUpperCase(); let i = 0;
  const t = setInterval(() => {
    el.textContent = up.slice(0, ++i);
    if(i >= up.length){ clearInterval(t); delete el.dataset.typing; }
  }, 26);
}
function chatSend(){
  const v = $('chatInput').value.trim(); if(!v) return;
  $('chatInput').value = '';
  if(chat.step === 'live'){
    if(chat.busy){ toast('⏳ Pričekaj da Claude dovrši odgovor'); return; }
    pushU(v); liveSend(v); return;
  }
  if(chat.step === 'mode'){ chat.pendingTema = v; pushU(v); chatMode('write'); pushA('Shvaćam to kao <b>temu novog rada</b> 👍'); return; }
  if(chat.step === 'tema') return chatTema(v);
  if(chat.step === 'izj_naslov'){ chat.izjNaslov = v; pushU(v); return izjavaUses(); }
  if(chat.step === 'notes'){ chat.notes = (chat.notes ? chat.notes+'\n' : '') + v; pushU(v); return chatFinal(); }
  if(chat.step === 'done'){ pushU(v); pushA('Za novi prompt klikni <b>🔁 Ispočetka</b> — ili ovu napomenu dodaj ručno u Claude chat.'); return; }
  chat.notes = (chat.notes ? chat.notes+'\n' : '') + v; pushU(v); pushA('Zabilježio sam ✔ — ući će u prompt kao napomena.');
}

/* ---------- KATEDRA: AUTH, KREDITI, PAYWALL (novo za SaaS) ---------- */
const KATEDRA_PACKAGES = [
  ['seminarski', 'Seminarski Pass', '29,90 €', '~1 seminarski s revizijama'],
  ['zavrsni', 'Završni Pass', '79,90 €', '~1 završni + recenzija'],
  ['diplomski', 'Diplomski Pass', '129,90 €', 'diplomski rad'],
];
let katedraKnownLow = false; // zadnje poznato stanje — da paywall ne čeka na 402
function goToLogin(){
  location.href = '/prijava?redirect=' + encodeURIComponent('/');
}
function renderAuthHeader(loggedIn, balance, low){
  const el = document.getElementById('katedraAuth'); if(!el) return;
  if(!loggedIn){
    el.innerHTML = '<button class="jump" id="katedraLoginBtn">Prijavi se</button>';
    const b = document.getElementById('katedraLoginBtn'); if(b) b.onclick = goToLogin;
    return;
  }
  el.innerHTML = '<span title="Krediti za &quot;Piši ovdje&quot;">💳 ' + Number(balance||0).toLocaleString('hr-HR') + ' kredita</span>' +
    (low ? ' <button class="jump" id="katedraTopupBtn">Dokupi</button>' : '');
  const t = document.getElementById('katedraTopupBtn'); if(t) t.onclick = showPaywall;
}
async function refreshAuthAndCredits(){
  try{
    const resp = await fetch('/api/balance');
    if(resp.status === 401){ katedraKnownLow = false; katedraLoggedIn = false; renderAuthHeader(false, 0, false); return false; }
    if(!resp.ok){ return false; }
    const data = await resp.json();
    katedraKnownLow = !!data.low;
    katedraLoggedIn = true;
    renderAuthHeader(true, data.balance, data.low);
    if(!katedraStateReconciled){ katedraStateReconciled = true; reconcileServerState(); }
    return true;
  }catch(e){ return false; }
}
function showPaywall(){
  if(document.getElementById('katedraPaywall')) return;
  const ov = document.createElement('div'); ov.className = 'onb'; ov.id = 'katedraPaywall';
  ov.innerHTML = '<div class="onb-card">' +
    '<div class="logo-badge" style="margin:0 auto">💳</div>' +
    '<h2>Nedovoljno kredita</h2>' +
    '<p class="onb-sub">Wizard i generiranje prompta ostaju besplatni — krediti se troše samo na „Piši ovdje” u aplikaciji.</p>' +
    '<div class="onb-steps" id="paywallPkgs"></div>' +
    '<button class="onb-go" id="paywallClose" style="background:var(--card2);color:var(--txt);box-shadow:none;margin-top:6px">Zatvori</button>' +
    '</div>';
  // Mora ostati unutar #katedra-root — CSS je skopiran na .katedra-page, pa
  // document.body.appendChild ovdje ne bi pokupio nijedan .onb/.onb-card stil.
  __root.appendChild(ov);
  const host = ov.querySelector('#paywallPkgs');
  KATEDRA_PACKAGES.forEach(([key, name, price, desc]) => {
    const row = document.createElement('button');
    row.className = 'onb-go'; row.style.marginBottom = '8px'; row.title = desc;
    row.textContent = name + ' — ' + price;
    row.onclick = () => startCheckout(key);
    host.appendChild(row);
  });
  ov.querySelector('#paywallClose').onclick = () => ov.remove();
}
async function startCheckout(pkgKey){
  try{
    const resp = await fetch('/api/checkout', {
      method: 'POST', headers: {'content-type':'application/json'},
      body: JSON.stringify({ package: pkgKey })
    });
    const data = await resp.json();
    if(data.url) location.href = data.url;
    else toast(data.error || 'Plaćanje trenutno nije dostupno.');
  }catch(e){ toast('Plaćanje trenutno nije dostupno.'); }
}
function handlePaymentReturn(){
  const qs = new URLSearchParams(location.search);
  const placeno = qs.get('placeno');
  if(placeno === '1'){ toast('✅ Uplata uspješna — krediti dodani'); refreshAuthAndCredits(); history.replaceState(null, '', '/'); }
  else if(placeno === '0'){ toast('Plaćanje otkazano'); history.replaceState(null, '', '/'); }
}

/* ---------- INIT ---------- */
// Dio HTML-a se ubacuje kao string (dangerouslySetInnerHTML) s inline
// onclick="fn()" atributima — browser te uvijek traži u window scopeu, ne u
// lokalnom scopeu ove funkcije. Bez ovoga svaki takav gumb baca "fn is not defined".
Object.assign(window, { toggleCheck, goAuto, goGen, togglePhase, lpToGen, pickFor, skipAtt });
document.querySelectorAll('#tabs button[data-view]').forEach(b => b.onclick = () => setTab(b.dataset.view));
function isAdv(){ return lsGet('rp_adv') === '1'; }
function applyAdv(){
  // CSS je skopiran na .katedra-page (vidi katedra-scoped.css) — "simple" klasa
  // mora sjediti na ISTOM elementu (#katedra-root), ne na document.body.
  __root.classList.toggle('simple', !isAdv());
  const b = $('advBtn'); if(b) b.classList.toggle('on', isAdv());
}
$('advBtn').onclick = () => {
  lsSet('rp_adv', isAdv() ? '0' : '1');
  applyAdv();
  if(!isAdv()) setTab('chat');
  toast(isAdv() ? '⚙️ Napredni mod — Autopilot, Generator, Pravila i tip rada otključani' : '✨ Jednostavni mod — samo ono bitno');
};
applyAdv();
applySkin(getSkin());
buildSkinPicker();
document.querySelectorAll('#tipSeg button').forEach(b => b.onclick = () => setTip(b.dataset.tip));
document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => { state.mode = b.dataset.mode; applyMode(); });
$('view-gen').addEventListener('input', () => { buildPrompt(); saveState(); });
$('view-auto').addEventListener('input', () => { buildAuto(); saveState(); });
$('view-auto').addEventListener('change', () => { buildAuto(); saveState(); });
$('copyBtn').onclick = copyPrompt;
$('autoCopy').onclick = () => copyText($('autoOut').textContent, $('autoCopy'), val('a_tema') ? [] : ['tema']);
$('dl_rok').addEventListener('input', () => { renderDeadlines(); renderLine(); renderIndeksHead(); updatePaper(); saveState(); if(getManifest()) ensureManifest(); });
$('wc_total').addEventListener('input', () => { renderWC(); saveState(); });
$('wc_unit').addEventListener('change', () => { renderWC(); saveState(); });
$('btnDnevnik').onclick = exportDnevnik;
$('bGo').onclick = goChat;
$('sendBtn').onclick = chatSend;
$('chatInput').addEventListener('keydown', e => { if(e.key === 'Enter') chatSend(); });
$('plusBtn').onclick = () => { currentCat = -1; $('chatFilePick').click(); };
$('u_skills').onchange = () => { buildAuto(); buildPrompt(); };
$('chatFilePick').onchange = e => { addChatFiles(e.target.files); e.target.value = ''; };
$('btnExport').onclick = exportState;
$('btnImport').onclick = () => $('fileImp').click();
$('fileImp').onchange = e => { if(e.target.files[0]) importState(e.target.files[0]); e.target.value=''; };
$('btnReset').onclick = resetAll;
$('nextBarBtn').onclick = () => goToNextStep(nextStepText().pos);

/* ---------- ONBOARDING — jedno pitanje umjesto opisa (F7) ---------- */
// Preskoči odmah ako je već zatvoreno u prošloj posjeti — nema treptaja, nema
// ponovnog pitanja. Prije je ovo bilo samo CSS (#onbx:checked), bez ikakve
// perzistencije, pa se overlay vraćao na svaki reload.
if(lsGet('rp_onb') === '1'){ const o0 = $('onb'); if(o0) o0.remove(); }
else {
  const onbxEl = $('onbx');
  // Preglednici znaju "zapamtiti" stanje checkboxa preko reloada (bfcache/
  // form restoration), neovisno o localStorageu — checkbox onda dođe već
  // označen prije nego ovaj kod uopće stigne do njega, CSS ga odmah sakrije
  // i overlay se čini kao da "nestane" trenutno. Eksplicitno ga resetiraj.
  if(onbxEl) onbxEl.checked = false;
  if(onbxEl) onbxEl.addEventListener('change', () => { if(onbxEl.checked) lsSet('rp_onb', '1'); });
  // chatStart(true) je već napunio #chatLog s pozdravom + chipovima prije nego
  // je korisnik uopće mogao kliknuti (overlay ga samo vizualno prekriva). Bez
  // čišćenja ovdje, izbor iz onboardinga se samo NADODAJE na to — dvije žive,
  // međusobno nesinkronizirane niti razgovora s dijeljenim chat objektom, koje
  // izgledaju kao da je cijela stranica "zbagana" dok se ne osvježi stranica.
  const onbPick = fn => { const l = $('chatLog'); if(l) l.innerHTML = ''; fn(); };
  const pickWrite = $('onbPickWrite'); if(pickWrite) pickWrite.onclick = () => onbPick(() => chatMode('write'));
  const pickDone = $('onbPickDone'); if(pickDone) pickDone.onclick = () => onbPick(chatDoneMenu);
  const pickHelp = $('onbPickHelp'); if(pickHelp) pickHelp.onclick = () => onbPick(chatExplain);

  /* ----- Lijevak: tip rada → gdje si → rok -----
     Bez JS-a ostaje gornji markup: jedan ekran, tri izbora, <label for="onbx">
     ga zatvara. Kad JS postoji, isti overlay postaje lijevak od tri pitanja.
     Svako pitanje puni pravo polje (state.tip, chat mode, #dl_rok) — ništa se
     ne pita "za dojam". */
  const onbCard = $('onb') && $('onb').querySelector('.onb-card');
  const onbChoices = onbCard && onbCard.querySelector('.onb-choices');
  if(onbCard && onbChoices){
    const MODES = {
      write: ['✍️ Počinjem pisati', 'Nova tema — kreni od plana i programa', () => chatMode('write'), false],
      done:  ['📄 Imam draft ili gotov rad', 'Recenzija, poboljšanje ili priprema obrane', chatDoneMenu, false],
      help:  ['❓ Kako ovo radi?', 'Prvo pogledaj kako funkcionira', chatExplain, true]
    };
    const ONB = [
      { q:'Koji rad pišeš?', why:'Od toga ovise faze, opseg i interni rokovi.',
        opts:[['s','Seminarski',''], ['z','Završni',''], ['d','Diplomski','']],
        pick:v => setTip(v) },
      { q:'Gdje si s radom?', why:'',
        opts:Object.keys(MODES).map(k => [k, MODES[k][0], MODES[k][1]]),
        pick:v => { onbRun = MODES[v][2]; if(MODES[v][3]) onbStep = ONB.length; } },
      { q:'Kad je rok predaje?', why:'Iz roka Katedra računa interne rokove unatrag i postavlja vozni red.',
        opts:[[14,'Za dva tjedna',''], [30,'Za mjesec dana',''], [90,'Za tri mjeseca',''], [0,'Još ne znam','možeš ga upisati poslije u Indeksu']],
        pick:v => {
          if(!v) return;
          const el = $('dl_rok'); if(!el) return;
          el.value = new Date(Date.now() + v * 864e5).toISOString().slice(0, 10);
          el.dispatchEvent(new Event('input', { bubbles:true }));
        } }
    ];
    let onbStep = 0, onbRun = null;
    const onbFinish = () => {
      lsSet('rp_onb', '1');
      if(onbxEl) onbxEl.checked = true;
      const o = $('onb'); if(o) o.remove();
      onbPick(onbRun || (() => chatMode('write')));
    };
    const onbRender = () => {
      if(onbStep >= ONB.length){ onbFinish(); return; }
      const s = ONB[onbStep];
      const h2 = onbCard.querySelector('h2');
      const sub = onbCard.querySelector('.onb-sub');
      let cnt = onbCard.querySelector('.onb-count');
      if(!cnt){
        cnt = document.createElement('div'); cnt.className = 'onb-count';
        onbCard.insertBefore(cnt, h2);
      }
      cnt.innerHTML = 'Pitanje ' + (onbStep + 1) + ' od ' + ONB.length +
        '<span class="onb-dots">' + ONB.map((_, i) => '<i' + (i <= onbStep ? ' class="on"' : '') + '></i>').join('') + '</span>';
      if(h2) h2.textContent = s.q;
      if(sub) sub.textContent = s.why || '';
      if(sub) sub.style.display = s.why ? '' : 'none';
      onbChoices.innerHTML = '';
      s.opts.forEach(([v, label, desc]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'onb-choice' + (v === 'help' ? ' ghost' : '');
        b.innerHTML = '<b>' + escA(label) + '</b>' + (desc ? '<span>' + escA(desc) + '</span>' : '');
        b.onclick = () => { s.pick(v); onbStep++; onbRender(); };
        onbChoices.appendChild(b);
      });
    };
    onbRender();
  }
}

/* ---------- LEKTA HANDOFF — #lekta= prijemnik + Resolution Coach (Milestone 1) ---------- */
const lkq = { list: [], i: 0 };
function lkNorm(res){
  const sev = s => (s === 'critical' || s === 'error') ? 'critical' : (s === 'warning' || s === 'major') ? 'warning' : 'info';
  const issues = (res.issues || []).map((it, idx) => ({
    id: it.issueId || it.checkId || ('lk-' + idx),
    ruleId: it.ruleId || '',   // Lekta ne šalje ovo još — spremno za kad počne
    severity: sev(String(it.severity || 'warning').toLowerCase()),
    category: it.category || '',
    fixable: !!it.fixable,
    label: it.label || it.issueId || it.checkId || 'Nalaz',
    status: 'OPEN'
  }));
  return { v: res.v || 1, projectId: res.projectId || '', profileId: res.profileId || '',
           rulesetVersion: res.rulesetVersion || '', score: (typeof res.score === 'number') ? res.score : null,
           checkedAt: res.checkedAt || '', issues };
}
function lkParseHash(){
  const h = location.hash || '';
  if(h.indexOf('#lekta=') !== 0) return;
  let res = null;
  try{
    const raw = decodeURIComponent(h.slice(7));
    res = JSON.parse(decodeURIComponent(escape(atob(raw))));
  }catch(e){}
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  if(!res || !res.issues){ toast('⚠ Lekta poveznica nije čitljiva — pokreni check ponovno'); return; }
  lkStart(res);
}
function lkStart(raw){
  const res = lkNorm(raw);
  const prev = getManifest();
  const prevIds = prev ? (prev.lektaIssues || []).map(i => i.id) : [];
  const newIds = res.issues.map(i => i.id);
  const fixed = prevIds.filter(id => newIds.indexOf(id) === -1);
  const m = ensureManifest();
  if(res.projectId) m.projectId = res.projectId;
  if(res.profileId) m.profileId = res.profileId;
  if(res.rulesetVersion) m.rulesetVersion = res.rulesetVersion;
  if(res.score != null) m.lektaScore = res.score;
  m.lektaCheckedAt = res.checkedAt || new Date().toISOString();
  m.lektaIssues = res.issues;
  m.lektaFixedTotal = (m.lektaFixedTotal || 0) + fixed.length;
  saveManifest(m);
  renderLine();
  lkq.list = res.issues; lkq.i = 0;
  const crit = res.issues.filter(i => i.severity === 'critical').length;
  const warn = res.issues.filter(i => i.severity === 'warning').length;
  const inf = res.issues.length - crit - warn;
  let h = '<span style="display:inline-block;border:2px solid var(--stamp);color:var(--stamp);padding:2px 9px;font-weight:800;letter-spacing:.09em;transform:rotate(-1.5deg);font-size:11px;border-radius:3px">LEKTA · NALAZI PRIMLJENI</span>';
  h += '<br><b style="font-size:16px">' + (res.score != null ? '📐 ' + res.score + '/100' : '📐 Provjera dokumenta') + '</b>';
  const parts = [];
  if(crit) parts.push('🔴 ' + crit + ' kritičnih');
  if(warn) parts.push('🟡 ' + warn + ' upozorenja');
  if(inf) parts.push('ℹ️ ' + inf + ' napomena');
  if(parts.length) h += '<br>' + parts.join(' · ');
  if(fixed.length) h += '<br>✅ <b>' + fixed.length + '</b> iz prošlog kruga <b>potvrđeno riješeno</b> (Lekta re-check).';
  h += '<br><span style="font-size:12px;color:var(--mut)">Usklađenost dokumenta mjeri isključivo Lekta — ja pomažem razumjeti i riješiti nalaze, jedan po jedan. Rad ostaje kod tebe: ovamo su stigli samo ID-jevi nalaza, ni jedna rečenica.</span>';
  pushA(h);
  rpLog('Lekta handoff: ' + res.issues.length + ' nalaza' + (res.score != null ? ', score ' + res.score + '/100' : '') + (fixed.length ? ', ' + fixed.length + ' potvrđeno riješeno' : ''));
  if(!res.issues.length){
    pushA('🎉 <b>Nula otvorenih nalaza — dokument je po pravilima tvog fakulteta čist.</b> Idemo na sadržaj? 🧠 Recenzija ili 🎤 obrana.');
    chatModeChips(); return;
  }
  pushChips([
    ['▶ Idemo redom (' + res.issues.length + ')', () => { pushU('▶ Idemo redom'); lkNext(); }],
    ['⏭ Kasnije', () => { pushU('⏭ Kasnije'); pushA('Ok — nalazi su spremljeni u projekt (vidiš ih i u liniji gore). Kad budeš spreman, klikni 📄 Imam gotov rad.'); chatModeChips(); }, true]
  ]);
}
function lkNext(){
  if(lkq.i >= lkq.list.length) return lkFinish();
  const it = lkq.list[lkq.i];
  const ic = it.severity === 'critical' ? '🔴' : it.severity === 'warning' ? '🟡' : 'ℹ️';
  let h = '<b>' + ic + ' Nalaz ' + (lkq.i + 1) + '/' + lkq.list.length + '</b>';
  if(it.category) h += ' · <span style="font-size:11.5px;color:var(--mut2)">' + escA(it.category) + '</span>';
  if(it.ruleId) h += ' · <span style="font-size:11px;color:var(--mut2)">pravilo ' + escA(it.ruleId) + '</span>';
  h += '<br>' + escA(it.label);
  if(it.fixable) h += '<br><span style="font-size:12px;color:var(--ok)">⚙ Ovo Lekta zna popraviti automatski (AutoFix — forma, nikad rečenice).</span>';
  pushA(h);
  pushChips([
    ['💬 Objasni mi kako', () => lkExplain(it)],
    ['✔ Riješio sam', () => { pushU('✔ Riješio sam'); lkMark('USER_CHANGED'); }],
    ['⏭ Preskoči', () => { pushU('⏭ Preskoči'); lkMark('SKIPPED'); }, true],
    ['⏹ Dosta za sad', () => { pushU('⏹ Dosta za sad'); lkFinish(); }, true]
  ]);
}
function lkExplain(it){
  pushU('💬 Objasni mi kako');
  const p = 'Lekta (deterministički checker formata radova) našla je u mom dokumentu ovaj problem:\n'
    + '- Nalaz: ' + it.label + '\n'
    + (it.category ? '- Kategorija: ' + it.category + '\n' : '')
    + '- Ozbiljnost: ' + it.severity + '\n\n'
    + 'Objasni mi:\n'
    + '1. ŠTO točno ovaj nalaz znači (jednostavno, 2–3 rečenice)\n'
    + '2. KAKO ga ispravim u Wordu — konkretni koraci, izbornik po izbornik\n'
    + '3. NA ŠTO paziti da se ne vrati\n'
    + 'NE mijenjaj sadržaj mojih rečenica — ovo je formatna/tehnička stavka.';
  const d = pushA('<b>Uputa za Claude</b> — kopiraj u claude.ai ili pitaj odmah ovdje:');
  const bub = d.querySelector('.bub');
  const out = document.createElement('div'); out.className = 'prompt-out'; out.textContent = p; bub.appendChild(out);
  const cp = document.createElement('button'); cp.className = 'copy-btn'; cp.textContent = '📋 Kopiraj';
  cp.onclick = () => copyText(p, cp, []); bub.appendChild(cp);
  const lv = document.createElement('button'); lv.className = 'att-btn'; lv.style.marginTop = '8px'; lv.textContent = '▶ Pitaj ovdje';
  lv.onclick = () => liveBegin(p); bub.appendChild(lv);
  chatScroll();
  pushChips([
    ['✔ Riješio sam', () => { pushU('✔ Riješio sam'); lkMark('USER_CHANGED'); }],
    ['⏭ Preskoči', () => { pushU('⏭ Preskoči'); lkMark('SKIPPED'); }, true]
  ]);
}
function lkMark(status){
  const it = lkq.list[lkq.i];
  if(it){
    it.status = status;
    const m = getManifest();
    if(m){ const mi = (m.lektaIssues || []).find(x => x.id === it.id); if(mi) mi.status = status; saveManifest(m); }
  }
  lkq.i++; lkNext();
}
function lkFinish(){
  const done = lkq.list.filter(i => i.status === 'USER_CHANGED').length;
  const skip = lkq.list.filter(i => i.status === 'SKIPPED').length;
  const open = lkq.list.length - done - skip;
  let h = '<b>📋 Krug ispravaka gotov.</b><br>✔ Označeno riješeno: <b>' + done + '</b> · ⏭ preskočeno: ' + skip + ' · ostalo otvoreno: ' + open + '.';
  h += '<br><br>„Riješeno" postaje <b>službeno</b> tek kad Lekta ponovno provjeri dokument — otvori je istim projektom i vrati se s novim nalazima. Riješene stavke potvrdit ću ti ovdje. ✅';
  const d = pushA(h); const bub = d.querySelector('.bub');
  const acts = document.createElement('div'); acts.className = 'final-actions';
  const a = document.createElement('a'); a.className = 'fa p'; a.href = lektaLink(); a.target = '_blank'; a.rel = 'noopener'; a.textContent = '🔁 Ponovi Lekta Check ↗';
  acts.appendChild(a); bub.appendChild(acts); chatScroll();
  rpLog('Lekta krug ispravaka: ' + done + ' označeno riješeno, ' + skip + ' preskočeno, ' + open + ' otvoreno');
  renderLine();
  chatModeChips();
}
window.addEventListener('hashchange', lkParseHash);

loadState();
document.querySelectorAll('#tipSeg button').forEach(x => x.classList.toggle('on', x.dataset.tip === state.tip));
applyTipPlaceholders();
renderPhases();
applyMode();
buildAuto();
renderDeadlines();
renderWC();
chatStart(true);
buildLine();
renderLine();
renderIndeksHead();
updatePaper();
lkParseHash();
refreshAuthAndCredits();
handlePaymentReturn();

/* ---------- PWA / INSTALACIJA / VERZIJA ---------- */
try{
  const man = {
    name:'Katedra — kopilot za radove', short_name:'Katedra',
    start_url: location.href, display:'standalone',
    background_color:'#1e3a2f', theme_color:'#1e3a2f',
    icons:[{src: new URL('katedra-icon.png', location.href).href, sizes:'512x512', type:'image/png'}]
  };
  const l = document.createElement('link'); l.rel = 'manifest';
  l.href = URL.createObjectURL(new Blob([JSON.stringify(man)], {type:'application/manifest+json'}));
  document.head.appendChild(l);
}catch(e){}
let deferredInstall = null;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('btnInstall').style.display = ''; });
if(isIOS) $('btnInstall').style.display = '';
$('btnInstall').onclick = () => {
  if(deferredInstall){ deferredInstall.prompt(); deferredInstall = null; $('btnInstall').style.display = 'none'; }
  else toast(isIOS ? '📲 Safari: gumb Dijeli → „Dodaj na početni zaslon”' : '📲 Izbornik preglednika → „Instaliraj aplikaciju”');
};
if(location.protocol.indexOf('http') === 0){
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  fetch('version.json?t=' + Date.now()).then(r => r.json())
    .then(v => { if(v && v.version && v.version !== RP_VER) toast('🔄 Nova verzija Katedraa — osvježi stranicu'); })
    .catch(() => {});
}
}
