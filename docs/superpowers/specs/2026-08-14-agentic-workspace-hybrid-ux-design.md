# Hibridni agenticni workspace za `/pisi`

## Status

Design approved by user on 2026-08-14. This document defines the UX and
interaction model before implementation. It does not change application code.

## Cilj

`/pisi` treba korisniku pomoći izraditi akademski rad kroz tri povezana
načina rada:

1. pripremu materijala i parametara projekta;
2. vođeni ili potpuno autonomni agenticni tijek;
3. uređivanje i potvrđivanje rezultata u stvarnom rukopisu.

Korisnik ne smije morati razumjeti internu arhitekturu agenata da bi izradio
rad. Agenti, verifikatori i checkpointi trebaju biti vidljivi tek toliko da
korisnik razumije što se događa, zašto je korak blokiran i što može napraviti.

## Neće se mijenjati

- postojeća papir–tinta paleta;
- serifni identitet Katedre;
- plava boja za strukturu i aktivne kontrole;
- žuta boja za Katedrin identitet, upozorenja i potvrđene rezultate;
- local-first rukopis;
- pravilo da AI ne mijenja glavni rukopis bez korisnikove potvrde;
- Lekta kao DOCX/compliance authority.

## Model stanja workspacea

`/pisi` je state-based workspace. Ne prikazuje sve funkcije istodobno, nego
prikazuje ekran koji odgovara trenutnoj fazi projekta.

### 1. Priprema rada

Otvara se nakon uspješne naplate i aktivnog Passa za projekt.

Sadržaj:

- široki naslov `Pripremi svoj rad`;
- upload postojećeg rada, literature, mentorovih uputa, pravila i bilješki;
- status ekstrakcije i upozorenja za svaki materijal;
- zaključani sažetak projekta: tema, vrsta rada, fakultet/smjer i Pass;
- odabir source policyja;
- odabir načina rada: vođeni, ubrzani ili autonomni;
- sažetak uključenih agenata i verifikatora;
- glavna akcija `Pokreni izradu rada`.

Početni ekran ne prikazuje chat kao primarnu funkciju. Korisnik prvo priprema
kontekst iz kojeg će rad nastati.

### 2. Autonomni tijek

Nakon pokretanja, pripremni ekran prelazi u živi agenticni dashboard.

Na dashboardu su vidljivi:

- timeline agenata i verifikatora;
- aktivni agent, aktivni verifikator i njihov zadatak;
- status svakog koraka: čeka, radi, verificirano, za reviziju, blokirano;
- pokušaj `1/3`, `2/3` ili `3/3`;
- read-only pregled privremene radne verzije rukopisa;
- korišteni i provjereni izvori;
- pauza, nastavak i otkazivanje gdje je dopušteno;
- indikator da se rad izvršava u pozadini i da zatvaranje preglednika ne prekida
  run.

Autonomni run radi nad privremenom radnom verzijom. Glavni lokalni rukopis se
ne prepisuje tijekom rada.

### 3. Intervencija

Ako verifikator blokira korak, dashboard ulazi u intervencijsko stanje.

Korisnik tada vidi:

- jasan razlog blokade;
- agenta i verifikatora koji su uključeni;
- konkretne nedostajuće ili neprovjerene izvore;
- materijale koji su uzrok problema;
- plan ili outline koji se može urediti;
- akcije za dodavanje, uklanjanje ili zamjenu materijala;
- `Nastavi`, `Ponovi` i `Zaustavi` prema stanju runa.

Uređivanje plana ili materijala stvara novu reviziju konteksta. Prethodni
rezultat ostaje u povijesti, a prijedlozi koji više ne odgovaraju novom
kontekstu označavaju se kao zastarjeli.

### 4. Pregled rezultata

Nakon završetka runa verificirane sekcije ulaze u privremenu radnu verziju i
čekaju korisnikovu potvrdu.

Korisnik može:

- kliknuti `Prihvati sve provjerene`;
- pregledati sekciju po sekciju;
- prihvatiti pojedinu sekciju;
- urediti ili odbaciti prijedlog;
- vidjeti izvore, dokaze i status verifikacije uz sekciju.

`Prihvati sve provjerene` smije prihvatiti samo sekcije sa statusom
`verified`. Blokirane, neprovjerene ili zastarjele sekcije ostaju izvan
glavnog rukopisa.

### 5. Radni prostor

Nakon prihvaćanja korisnik dolazi u klasični editor:

- outline rada lijevo;
- uređivi rukopis u sredini;
- Katedra kao kontekstualni urednik desno;
- lokalno spremanje, verzije, undo/redo i DOCX izvoz.

Ovaj ekran je primarni prostor za ručno uređivanje, a agenticni dashboard se
može ponovno otvoriti iz projektnog izbornika.

## Desktop layout

### Priprema

Početni workspace koristi dvije funkcionalne zone:

- lijevo: materijali i njihovi extraction statusi;
- desno: zaključani projekt, način rada, source policy i glavna akcija.

Hijerarhija se postiže tipografijom i linijama, a ne nizom zaobljenih kartica.

### Autonomni tijek

Koriste se tri zone:

- lijevo: timeline agenata/verifikatora;
- sredina: read-only rukopis koji se puni uživo;
- desno: aktivni korak, izvori, verifikacija i intervencijske akcije.

### Pregled

- lijevo: sekcije sa statusima;
- sredina: odabrana sekcija;
- desno: izvori, dokaz i akcije prihvaćanja.

## Read-only live preview

Read-only preview prikazuje privremenu radnu verziju dok autonomni run radi.

Pravila:

- korisnik može čitati, pretraživati i prebacivati prikaz između sekcija;
- korisnik ne može izravno tipkati u preview dok run traje;
- novi tekst se kratko označi žutim highlightom;
- status uz sekciju pokazuje je li tekst samo generiran ili i verificiran;
- promjena glavnog rukopisa tijekom runa ne briše privremenu verziju;
- nakon korisnikove promjene aktivni prijedlog može postati `stale`.

## Mobile layout

Na ekranima ispod 800 px vidljiv je samo jedan glavni kontekst:

- `Priprema`;
- `Tijek`;
- `Rukopis`;
- `Pregled`.

Donja navigacija mijenja kontekst. Intervencija se otvara kao full-height
panel. Upload, pauza, nastavak i export ostaju dostupni iz project menija.

## Visual and motion system

- papirna pozadina i svjetliji papir za dokument;
- tamna tinta za tekst;
- plava linija za aktivni korak i strukturu;
- žuti marker za Katedrine rezultate i potvrđene promjene;
- minimalni radius i tanke borders;
- nema stalnog pulsiranja, dekorativnog 3D-a ni tramvaja;
- prijelazi stanja traju približno 180–240 ms;
- paneli klize samo pri otvaranju i zatvaranju;
- `prefers-reduced-motion` uklanja neobavezne transformacije i animacije.

Motion treba objasniti promjenu stanja, a ne glumiti AI magiju.

## State and data behavior

Svaki run ima:

- `runId`;
- privremenu radnu reviziju;
- status agenata i verifikatora;
- pokušaj i verification evidence;
- checkpoint za pauzu i nastavak;
- poveznice na privremene materijale s TTL-om.

Glavni rukopis ostaje lokalna canonical kopija. Agenticni rezultat se u njega
upisuje samo nakon korisnikove potvrde. Zatvaranje preglednika ne prekida
server-side run, a reload vraća korisnika u zadnji poznati state.

## Accessibility and failure behavior

Obavezno:

- keyboard navigacija za timeline, sekcije i intervenciju;
- focus management pri otvaranju panela;
- `aria-live` za promjenu statusa agenta;
- čitljive tekstualne oznake uz ikone i boje;
- dark mode s dovoljnim kontrastom;
- reduced-motion podrška;
- jasna poruka za provider error, billing error, istekao Pass, blokadu izvora
  i nedostupnu lokalnu pohranu.

Capability koji nije konfiguriran ne smije tiho pasti na pogrešan provider.
Korak se prikazuje kao blokiran s objašnjenjem i opcijom intervencije.

## Acceptance criteria

UX redizajn je uspješan kada korisnik može:

1. nakon naplate dodati materijale i odabrati način rada;
2. pokrenuti guided, accelerated ili autonomous run;
3. pratiti agente i verifikatore uz read-only rukopis uživo;
4. zatvoriti preglednik i vratiti se na zadnji checkpoint;
5. urediti plan ili materijale nakon blokade i nastaviti run;
6. prihvatiti sve verificirane ili samo pojedine sekcije;
7. uređivati potvrđeni rad u glavnom editoru;
8. izvesti DOCX i poslati ga u Lektu;
9. nikada ne izgubiti ili tiho prepisati izvorni rukopis.

## Out of scope

- automatsko slanje rada bez korisnikove potvrde;
- collaborative editing;
- zamjena Worda za fusnote, tablice i finalno formatiranje;
- shared backend spremanje punog teksta rukopisa;
- nova database schema izvan Lekta authority repozitorija.
