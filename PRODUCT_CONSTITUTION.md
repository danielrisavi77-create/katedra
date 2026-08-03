# Product Constitution — Katedra × Lekta

Katedra i Lekta su dva odvojena proizvoda unutar jednog akademskog workflowa.
Ne grade se kao dvije aplikacije s hrpom featurea — svaki engine radi samo ono
u čemu je najbolji. Ovaj dokument definira gdje je ta granica, prije nego što
je ijedno od dvoje pokuša prijeći.

**Roditeljski dokument: `VIZIJA.md`** (charter v1, 2. 8. 2026) — puna poslovna
vizija (identitet, north star, brend, korisnik, scope, monetizacija, rast).
Ovaj dokument (`PRODUCT_CONSTITUTION.md`) je uži i timeless: granica
odgovornosti Katedra ↔ Lekta i zajednički sistemski temelji koji tu granicu
čine provedivom.

## Dvije nepregovorljive granice

**Katedra nikada ne proglašava dokument formalno usklađenim.**
Katedra ne otvara `.docx`, ne broji Word polja, ne provjerava marže ni citatnu
mehaniku deterministički. Kad Katedra spomene format, citate ili strukturu
dokumenta, to je preporuka ili podsjetnik — nikad tvrdnja "ovo je usklađeno".
Jedina rečenica koju Katedra smije reći o formalnoj usklađenosti je: "to
provjeri Lekta".

**Lekta nikada ne piše argumentaciju ni sadržaj rada.**
Lekta ne predlaže tezu, ne piše rečenice, ne ocjenjuje kvalitetu argumenta.
Lekta mjeri ono što stroj može izmjeriti (format, citatna mehanika, struktura
dokumenta, Word polja) — deterministički, po verificiranim pravilima
fakulteta. Sadržajnu kvalitetu rada ocjenjuje Katedra (uz mentora).

## Podjela odgovornosti

| | Katedra | Lekta |
|---|---|---|
| | vodi proces | provjerava rezultat |
| | pomaže planirati | čita stvarni `.docx` |
| | radi s literaturom | uspoređuje dokument s pravilima |
| | AI copilot | deterministic checker |
| | semantički review (teza, argumentacija) | tehnički audit (format, citati) |
| | mentor feedback | faculty compliance |
| | priprema obrane | submission preflight |
| | AI usage ledger | AutoFix |

## Signal integritet — "dva signala, nikad jedan"

Katedra prikazuje **proces izrade** (checklist %, koliko je faza dovršeno).
Lekta prikazuje **tehničku usklađenost** (score/100, po pravilima fakulteta).
Ova dva broja se **nikad ne zbrajaju niti prikazuju kao jedan "spremnost %"**.

## Issue lifecycle — samo Lekta smije reći "riješeno"

Canonical lifecycle:

`OPEN -> USER_CHANGED -> RECHECK_REQUIRED -> VERIFIED_FIXED`

Katedra smije evidentirati korisnikovu promjenu i zatražiti re-check. Samo novi
Lekta check može potvrditi da je isti stabilni nalaz nestao. Ako se nalaz vrati,
ponovno je `OPEN`. Legacy finding ID-jevi se tijekom migracije ne smiju
automatski proglasiti riješenima.

## Privatnost — dokument nikad ne ulazi u shared backend

Rad (`.docx`) ostaje na studentovom uređaju u local-first Lekta workflowu.
Između proizvoda i u shared Supabase smiju putovati samo strukturirani
metapodaci potrebni za workflow: project ID, ruleset/profile reference, score i
sanitizirani issue ID-jevi/metapodaci.

Shared foundation ne smije spremati:

- raw `.docx`;
- tekst rada;
- free-form document-derived `detail` / `location`;
- mentorove bilješke;
- source passages.

## Zajednički izvor akademskih pravila

Katedra ne smije održavati vlastitu konkurentsku bazu fakultetskih normativnih
pravila. Pravila dolaze iz Lekte / Academic Corea (`katedra-pack` ili njegov
budući verzionirani API/package export). Lekta je source of truth za verificirane
normativne rule entryje; Katedra ih koristi samo kao coach projection.

## Jedan account i jedan Supabase — odluka zaključana

Katedra i Lekta ostaju dvije zasebne aplikacije/domene, ali dijele **jedan
korisnički račun i jedan Supabase project backend**.

Katedrin postojeći Supabase projekt postaje **Academic Suite identity/data
backbone**. Lekta ne smije uvoditi zaseban paralelni Supabase Auth/user store.

Canonical identiteti:

- korisnik: `auth.users.id`;
- akademski projekt: `academic_projects.id` (UUID).

Shared schema ownership:

```text
auth.users
    └── academic_projects          SHARED CORE
          ├── katedra_project_state KATEDRA-OWNED
          ├── lekta_checks          LEKTA-OWNED
          └── entitlements          SHARED COMMERCE
```

Katedrini `katedra_wallets` / token credits ostaju zaseban AI cost-accounting
mehanizam; oni nisu autoritet za ecosystem access prava.

### Trenutačno stanje implementacije

- shared Supabase schema migration je napisana;
- PostgreSQL 16 migration smoke je dio CI-ja;
- legacy `katedra_projects` ostaje privremeni compatibility write-path;
- DB trigger zrcali Katedra writeove u `academic_projects` i
  `katedra_project_state`;
- `lekta_checks` i `entitlements` postoje u shared foundation modelu;
- produkcijski Supabase još nije migriran dok se eksplicitno ne prođu release
  preflight/postcheck koraci.

Dakle odluka više nije "buduća". **Infrastrukturni model je zaključan sada;
produkcijska primjena migracije je release korak.**

### Cross-domain SSO je odvojeni problem

Shared Supabase Auth znači isti `user_id`, ali ne znači automatski da dvije
različite root domene dijele browser cookie/session. Seamless
`katedra.hr -> lekta.hr` SSO kasnije zahtijeva centralni auth/session exchange
ili drugi eksplicitni cross-domain flow. To ne mijenja odluku o jednom accountu.

## Entitlements

Cross-product proizvodi poput `academic-pass` / `academic-pass-plus` žive u
shared `entitlements` tablici i mogu biti vezani uz korisnika i/ili jedan
`academic_projects.id`.

Time ista kupnja može otključati Katedra i Lekta capabilityje bez paralelnih
baza kupnji ili međusobnog "dokazivanja" kupnje između aplikacija.

## Brand

Katedra: *"Od teme do obrane."* Lekta: *"Provjeri prije predaje."* Obje
stranice smiju diskretno spomenuti da su dio istog akademskog workflow
sustava. Nema trećeg javnog branda dok se ne dokaže da je potreban.
