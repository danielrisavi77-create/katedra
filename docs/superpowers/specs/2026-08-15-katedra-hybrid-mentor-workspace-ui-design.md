# Katedra hybrid mentor workspace — UI design

**Status:** odobren dizajnerski smjer 2026-08-15  
**Scope:** korisničko iskustvo i vizualni sustav cijele aplikacije, s `/pisi` kao središnjim radnim prostorom  
**Out of scope:** promjena cijena, poslovnog modela, Katedra–Lekta ownershipa, canonicalnih Supabase migracija i AI providera

## 1. Cilj

Katedra treba djelovati kao jedan projektni mentor, a ne kao skup odvojenih AI funkcija. Korisnik u svakom trenutku mora moći odgovoriti na dva pitanja:

1. Gdje sam u izradi rada?
2. Što je moj sljedeći konkretan korak?

Glavni UX model je **hybrid mentor workspace**:

- projektni pregled daje kontekst i preporučeni sljedeći korak;
- rukopis je dostupan jednim klikom;
- plan, literatura, mentor, revizija, agenti i Lekta otvaraju se prema potrebi;
- korisnik može raditi vođeno, ubrzano ili autonomno;
- agenti rade u pozadini, ali rezultat nikad ne mijenjaju rukopis bez jasno dopuštenog ponašanja i lokalne verzije.

## 2. Zaključene dizajnerske odluke

- Novi korisnik počinje kratkim hibridnim onboardingom, ne dugim administrativnim čarobnjakom.
- Nakon onboardinga prikazuje se Completion Scan i projektni pregled.
- Povratni korisnik prvo vidi projektni pregled, s direktnim ulazom u zadnju aktivnu fazu.
- Projektni pregled ističe samo jednu primarnu akciju: **Tvoj sljedeći korak**.
- Desktop koristi tanku lijevu navigaciju usmjerenu na ciljeve studenta.
- Mobilni prikaz koristi tri glavna konteksta: Pregled, Rukopis i Katedra.
- Agenticni proces prikazuje se kao pozadinski tijek; korisnik može nastaviti raditi dok se rezultat priprema.
- Rezultat agenta dolazi kao prijedlog s pregledom, prihvaćanjem, uređivanjem, umetanjem ili odbijanjem.
- Vizualni smjer je hibrid: topla editorial atmosfera za rukopis i čisti utility elementi za kontrole.
- Papir–tinta paleta, serifni identitet, plava struktura i žuta Katedra ostaju.
- Interni pojmovi poput Generator, Autopilot i Agent dashboard nisu primarna navigacija.

## 3. Glavni korisnički tijek

```text
Landing
  → kratki hibridni onboarding
  → Completion Scan
  → projektni pregled
       → Tvoj sljedeći korak
       → Nastavi pisati
       → Pripremi projekt
       → relevantni alat
  → radni prostor
```

### 3.1 Hibridni onboarding

Onboarding prikazuje samo informacije potrebne za kvalitetan početak:

1. novi rad ili postojeći tekst;
2. vrsta rada;
3. fakultet, smjer i institucijska pravila;
4. tema, rok i mentor;
5. postojeći materijali.

Korisnik ne mora ispuniti nepoznata polja. Nakon toga Katedra prikazuje Completion Scan koji sažima:

- što korisnik već ima;
- što nedostaje;
- procijenjenu fazu;
- tri najvažnija sljedeća koraka;
- što je dostupno besplatno;
- koja funkcija eventualno zahtijeva Pass.

Za gosta se relevantni projektni identitet, metapodaci i lokalni plan spremaju lokalno. Registracija nastavlja isti `projectId`.

### 3.2 Projektni pregled

Projektni pregled je početna točka projekta, ne prazan editor. Sadrži:

- naziv rada, vrstu rada i fakultet;
- aktivnu fazu;
- istaknutu preporuku **Tvoj sljedeći korak**;
- jednu primarnu akciju;
- završene i otvorene korake;
- status materijala;
- rok i mentora;
- status Passa;
- zadnji Katedra ili Lekta rezultat;
- aktivni agenticni run, ako postoji.

Ne prikazuje se jedinstveni postotak spremnosti. Šira putanja prikazuje se kao fazni slijed:

```text
Tema → Plan → Literatura → Pisanje → Revizija → Lekta → Predaja
```

Za završne i diplomske radove relevantne faze, poput metodologije i obrane, pojavljuju se prema vrsti rada.

## 4. Navigacija

### 4.1 Desktop

Tanka lijeva navigacija prikazuje ciljeve studenta:

- Početna;
- Plan;
- Literatura;
- Pisanje;
- Mentor;
- Revizija;
- Provjera u Lekti;
- Obrana, samo kada je relevantna;
- Povijest.

Aktivna stavka koristi plavu strukturalnu oznaku. Navigacija ne koristi veliku pill traku ni konkurentne primarne CTA-ove.

### 4.2 Mobilni prikaz

Na širinama ispod 800 px vidljiv je samo jedan glavni kontekst:

- **Pregled** — projektni status i sljedeća akcija;
- **Rukopis** — uređivač;
- **Katedra** — kontekstualni AI panel.

Ostali sadržaj otvara se u draweru ili full-height sheetu. Rukopis je zadani mobilni ekran nakon ulaska u radni prostor. Nema slaganja cijelog desktopa u jednu dugu stranicu.

### 4.3 Gornja traka

Gornja traka prikazuje samo:

- naziv projekta;
- status lokalnog spremanja;
- diskretan status Passa;
- broj riječi;
- izvoz DOCX;
- račun i temu.

Faza, agent i dodatne akcije ostaju sekundarne i ne smiju širiti traku izvan ekrana.

## 5. Radni prostor `/pisi`

### 5.1 Tri desktop zone

**Lijevo — struktura rada**

- poglavlja i podpoglavlja;
- status sekcije;
- broj riječi;
- dodavanje i premještanje sekcija;
- jasno označena aktivna sekcija.

**Sredina — rukopis**

- stvarna papirnata površina;
- naslov aktivnog poglavlja;
- uređivi akademski tekst;
- diskretni toolbar;
- broj riječi, undo/redo i pretraživanje;
- nenametljiv status lokalnog spremanja.

**Desno — Katedra**

Panel dobiva samo potreban kontekst aktivne sekcije ili označenog teksta. Nudi, među ostalim:

- Napiši nacrt sekcije;
- Razradi odlomak;
- Poboljšaj argument;
- Skrati označeno;
- Provjeri logiku i izvore;
- Postavi mi pitanja;
- Pripremi sljedeći korak.

### 5.2 AI prijedlog

Tijek prijedloga:

1. korisnik bira sekciju ili označava tekst;
2. Katedra priprema ograničeni relevantni kontekst;
3. rezultat se streama u panel;
4. prijedlog dobiva status spremnosti i evidence upozorenja;
5. korisnik bira Prihvati, Uredi, Umetni ispod ili Odbaci;
6. prihvaćanje stvara lokalni snapshot i zapis u lokalnoj povijesti;
7. promjena rukopisa nakon nastanka prijedloga označava prijedlog kao zastario.

Autonomni način može automatski prihvaćati rezultate samo unutar prethodno odobrenog opsega i nakon verifikacije, source gatea, quality gatea i snapshot-a.

## 6. Materijali i agenticni proces

Materijali su dio projekta, ne zaseban tehnički proizvodni ekran. Korisnik može dodati:

- postojeći rad;
- literaturu;
- mentorove upute;
- pravila fakulteta;
- bilješke;
- skenove i slike.

Za svaki materijal prikazuje se razumljiv status: pročitan, djelomično pročitan, nečitak ili potreban pregled. Puni tekst ostaje izvan tehničkih logova, a rukopis ostaje lokalna canonicalna kopija.

Agenticni tijek prikazuje se kao fazna putanja:

```text
Analiza materijala
→ Literatura
→ Struktura
→ Plan
→ Pisanje
→ Provjera
```

Korisnik vidi aktivnog agenta, aktivnog verifikatora, pokušaj `1/3`, `2/3` ili `3/3`, izvore, upozorenja, potrošnju i razlog blokade. Ne mora razumjeti niti ručno pokretati pojedinačne interne agente.

Dok agent radi, projektni pregled prikazuje napredak, a korisnik može nastaviti uređivati druge dijelove. Terminalni rezultat uvijek ima jasnu akciju pregleda.

## 7. Passovi, paywall i račun

Paywall se prikazuje kontekstualno, tek pri pokušaju plaćene funkcije. Prikazuje samo Pass relevantan za postojeći tip rada i objašnjava:

- što je već dostupno besplatno;
- što se otključava;
- da je plaćanje jednokratno za taj projekt;
- da postojeći projekt i plan ostaju sačuvani;
- da se tema i plaćeni opseg nakon kupnje zaključavaju.

`Moj račun` je zaseban account center s korisničkim podacima, projektima, Passovima, kupnjama, potrošnjom, Lekta statusima i privatnosnim kontrolama. Billing informacije ne smiju preuzeti glavni radni prostor.

## 8. Vizualni sustav

### 8.1 Površine i boje

- topla papirnata pozadina za aplikacijski kontekst;
- svjetlija papirnata površina za rukopis;
- tamna tinta za glavni tekst;
- plava za navigaciju, strukturu i aktivne kontrole;
- žuta za Katedrin identitet i kratki naglasak potvrđenih prijedloga.

### 8.2 Tipografija i oblici

- serifna tipografija nosi akademski sadržaj i rukopis;
- sans-serif ostaje za kontrole, statuse i pomoćni tekst;
- hijerarhiju stvaraju veličina, razmak i tanke linije;
- border radius koristi se samo kada kontrola funkcionalno treba jasno odvajanje;
- uklanjaju se višak kartica, ponavljajući pillovi, skinovi, tramvaj i dekorativni AI elementi.

### 8.3 Motion

- prijelazi faza traju približno 180–240 ms;
- paneli klize samo pri otvaranju i zatvaranju;
- novi prijedlog kratko dobiva žuti naglasak i zatim se smiruje;
- nema beskonačnog pulsiranja ni dekorativnog pomicanja;
- `prefers-reduced-motion` uklanja sve neobavezne transformacije.

## 9. Stanja i oporavak

Svaki važan ekran mora imati eksplicitna stanja za učitavanje, prazno, spremljeno, spremanje, grešku, zaključano i potrebnu korisničku akciju.

Greške moraju objasniti problem i ponuditi sljedeći potez. Ne prikazuje se uspjeh ako agent, billing ili Lekta nisu stvarno završili. Prekid browsera ne smije stvoriti lažan status niti izgubiti lokalni rukopis.

Primjer jezika:

> Nismo uspjeli učitati materijal. Pokušaj ponovo ili dodaj drugi format.

## 10. Tehničke granice implementacije

- Redizajn se implementira kroz postojeće React komponente, bez novog HTML injection sloja.
- `WorkspaceShell`, `ProjectHome`, `OutlinePanel`, `ManuscriptEditor`, `AssistantPanel`, `MaterialLibrary`, `AgentRunPanel`, `ProjectDrawer` i `MobileWorkspaceNav` ostaju jasne komponente s jednom odgovornošću.
- Rukopis ostaje local-only canonical sadržaj i ne ulazi u `/api/state` payload.
- Postojeći auth, entitlement, checkout, Lekta handoff i legal tokovi ostaju funkcionalno nepromijenjeni.
- UI može prikazivati agenticni status, ali feature flagovi i dalje ostaju fail-closed dok canonicalni Lekta ugovori nisu staging-dokazani.

## 11. Faze implementacije

1. Normalizirati brand tokene, tipografiju, spacing i površine za light/dark temu.
2. Srediti globalnu navigaciju i gornju traku bez promjene backend ponašanja.
3. Preoblikovati `/pisi` u projektni pregled s jasnim sljedećim korakom.
4. Uskladiti desktop tri-zone workspace i mobilna tri konteksta.
5. Uvesti jedinstvene empty/error/locked/saving statuse.
6. Uskladiti agenticni panel i materijalni drawer s mentor mentalnim modelom.
7. Uskladiti paywall, račun, landing i auth s istim vizualnim sustavom.
8. Pokrenuti browser provjeru na localhostu za desktop, tablet, mobitel, light i dark mode.
9. Tek nakon vizualnog i funkcionalnog pariteta čistiti zastarjele pisi stilove.

## 12. Prihvatni kriteriji

Redizajn je prihvaćen kada:

- novi korisnik razumije što treba napraviti nakon onboardinga;
- povratni korisnik odmah vidi stanje projekta i jedan sljedeći korak;
- korisnik može jednim klikom doći do rukopisa;
- glavni UI ne koristi interne AI pojmove kao mentalni model;
- desktop navigacija i mobilni konteksti ostaju jasni bez horizontalnog overflowa;
- agenticni rezultat ne prepisuje rukopis bez odobrenog ponašanja i verzije;
- light/dark mode imaju čitljiv kontrast i ne cure kontrole iz layouta;
- paywall prikazuje relevantan Pass, a račun ostaje odvojen od pisanja;
- landing, prijava, registracija, pravne stranice i checkout nemaju regresiju;
- `prefers-reduced-motion` uklanja neobavezne animacije;
- relevantni unit, component, browser i postojeći quality gateovi prolaze.
