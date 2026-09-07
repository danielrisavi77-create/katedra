# Katedra

AI kopilot za seminarske, završne i diplomske radove na hrvatskom: lokalno-first manuscript workspace, Completion Scan, kontekstualni streaming chat, agentički workflow i integracija s [Lektom](https://lektahr.netlify.app), determinističkim provjeriteljem formalne usklađenosti rada.

Katedra i Lekta ostaju **odvojene aplikacije i proizvodi**, ali od foundation v0.1 dijele jedan Academic Suite backend. **Postojeći Lekta Supabase projekt (`zrrjttizjyfcxmcpgzml`) je canonical identity/data backend za oba proizvoda.** Katedra nema zaseban Supabase authority niti zasebnu migration history.

- Katedra: vodi proces, planiranje, pisanje, semantičku recenziju i pripremu obrane.
- Lekta: čita stvarni `.docx`, provjerava verificirana pravila i jedina smije deterministički potvrditi da je nalaz riješen.
- Lekta Supabase: isti account, isti akademski projekt, postojeći Lekta commerce i Katedra-owned workflow/AI-credit tablice.
- Tekst rada ne ulazi u `/api/state` ni zajedničke logove. Postojeći privremeni privatni Storage za agentičke sadržaje zahtijeva usklađivanje s ustavom proizvoda prije aktivacije; granica i opcije opisane su u [aktualnoj arhitekturi](docs/architecture/CURRENT_ARCHITECTURE.md).

Lokalni manuskript je canonical sadržaj uređivanja. Agenticni runovi, uploadi i
plaćeni project-lock tok ostaju fail-closed dok canonical Lekta ugovor, worker,
RLS i staging money-flow ne budu deployani i dokazani; aktualni status je u
[`docs/release/CURRENT_STATUS.md`](docs/release/CURRENT_STATUS.md), uz
[aktualne lokalne provjere](docs/release/LOCAL_VERIFICATION_2026-09-07.md)
i [`docs/autonomous/BLOCKERS.md`](docs/autonomous/BLOCKERS.md).

Raniji zapisi pod `docs/release/`, uključujući provjeru od 2026-08-16, ostaju
povijesni dokazi. Nijedan lokalni PASS sam po sebi nije odobrenje aktivacije.

Za nepregovorljive produktne granice vidi `PRODUCT_CONSTITUTION.md`. Database authority i migracije žive u `danielrisavi77-create/Lekta/supabase/`.

## Arhitektura

### Aplikacijski sloj

```text
Korisnik ──JWT──► /api/chat ──► provjera kredita ──► Anthropic API
                                      │ stream
                  ◄───────────────────┘
                  na kraju: katedra_consume(input + 5×output)

Uplata Katedra AI kredita: /api/checkout → Stripe → /api/webhook → katedra_grant
Lekta: project/unit/work → Lekta → #lekta=<sanitized result> → Katedra coach
```

### Lekta Supabase = Shared Academic Suite backend

```text
auth.users                         EXISTING LEKTA AUTH
    └── academic_projects          SHARED CORE
          ├── katedra_project_state KATEDRA-OWNED
          └── lekta_checks          LEKTA-OWNED

products                           EXISTING LEKTA CATALOG
entitlements                       EXISTING LEKTA COMMERCE, project-aware
    └── document_slots             EXISTING LEKTA DOCUMENT BINDING

katedra_wallets/topups/usage       KATEDRA AI-COMPUTE ACCOUNTING
```

Canonicalni identiteti:

- korisnik: `auth.users.id`
- akademski rad/projekt: `academic_projects.id` (UUID)

Postojeći Lekta `entitlements`, `products` i `document_slots` ostaju authority za kupnje/Pass. Academic Suite foundation ih **proširuje**, ne zamjenjuje drugim entitlement sustavom.

`katedra_projects` postoji samo kao foundation-v0.1 compatibility write-path jer postojeći `/api/state` još koristi taj shape. DB trigger u Lekta Supabaseu mirrorira ga u `academic_projects` + `katedra_project_state`.

```text
Katedra /api/state
      ↓
katedra_projects                temporary compatibility write-path
      ↓ DB mirror
academic_projects + katedra_project_state
```

Nakon stabilnog produkcijskog observation perioda `/api/state` se može prebaciti na izravne shared-table writeove, a compatibility tablica kasnije umiroviti zasebnom **Lekta** migracijom.

### Privacy boundary

Shared foundation ne sprema:

- raw `.docx`;
- tekst rada;
- free-form document-derived issue `detail` / `location`;
- mentorove bilješke;
- source passages.

`lekta_checks` je predviđen samo za sanitiziranu strukturiranu povijest provjera. Lekta analiza dokumenta ostaje local-first.

## Lekta × Katedra lifecycle

Canonical issue lifecycle:

```text
OPEN → USER_CHANGED → RECHECK_REQUIRED → VERIFIED_FIXED
```

- `Riješio sam` u Katedri znači samo da je korisnik nešto promijenio.
- Novi Lekta re-check jedini može potvrditi nestanak stabilnog nalaza.
- Ako se isti `issueKey` vrati, nalaz se ponovno otvara.
- Legacy finding ID-jevi se tijekom migracije ne auto-verificiraju.

Shared result koristi stabilne identitete poput:

```text
rule:<ruleId>
rule:<ruleId>:check:<checkId>
check:<checkId>
```

## Postavljanje od nule

### 1. Supabase

Katedra mora koristiti **postojeći Lekta Supabase**, ne novi projekt.

Project ref:

```text
zrrjttizjyfcxmcpgzml
```

Katedra deploy env mora sadržavati vrijednosti tog projekta:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` mora ostati isključivo server-side. Za novi frontend setup preferiraj Supabase publishable key gdje Katedrin trenutni client API to dopušta; legacy anon key ostaje kompatibilan dok ga aplikacija još očekuje.

### 2. Database migrations

**Katedra repo ne smije sadržavati production DDL kao authority.**

`supabase/migrations/20260805010000_academic_suite_foundation_hardening.sql` u ovom repozitoriju je deprecated/no-op migration-history marker. Sadrži samo komentare i nije production DDL; authoritative migration mora nastati i biti primijenjena iz Lekta repozitorija.

Authoritative migrations su u Lekta repou. Academic Suite foundation trenutno čine:

```text
Lekta/supabase/migrations/0035_academic_suite_foundation.sql
Lekta/supabase/migrations/0036_academic_suite_rls_hardening.sql
```

`0035`:

- stvara `academic_projects`, `katedra_project_state`, `lekta_checks`;
- dodaje Katedra wallet/topup/usage tablice u isti Lekta Supabase;
- dodaje Katedra compatibility `katedra_projects` write-path;
- proširuje postojeće Lekta `entitlements` i `document_slots` s `academic_project_id`;
- zadržava postojeći Lekta `products`/Thesis Pass model;
- dodaje ownership i privacy granice.

`0036` sužava postojeće privatne commerce RLS policyje na `authenticated` korisnike.

Za schema promjenu otvori migration u Lekta repou; nemoj dodavati konkurentsku migraciju ovdje.

### 3. Stripe / Katedra AI krediti

Postavi:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Webhook:

```text
https://<tvoja-domena>/api/webhook
```

Event: `checkout.session.completed`.

Katedrin wallet (`katedra_wallets`, `katedra_topups`, `katedra_usage`) ostaje AI compute-cost accounting. On nije authority za Lekta/Academic Pass prava.

### 4. Anthropic

Postavi:

```text
ANTHROPIC_API_KEY
```

Preporučeno je imati account-level spend limit kao zaštitu od nekontroliranog troška.

### 5. Aplikacijska domena

Postavi:

```text
NEXT_PUBLIC_APP_URL
```

na stvarnu produkcijsku Katedra domenu.

Lekta reverse handoff podržava `VITE_KATEDRA_URL`. Katedrin handoff adapter
trenutačno koristi postojeći `https://lektahr.netlify.app` kao Lekta production
URL; prije budućeg domain cutovera taj URL treba izvući u konfiguraciju i
testirati, a ne mijenjati ad hoc tijekom releasea.

## Razvoj

```bash
npm ci
npm run dev
```

Default lokalno: `http://localhost:3000`.

Bez pravih Lekta Supabase env vrijednosti statične stranice se mogu renderirati, ali auth/kredit/chat funkcionalnosti neće raditi normalno.

Za ponovljivu provjeru prije PR-a koristi [stabilizacijski report](docs/stabilization-report.md) i [stabilizacijski checklist](docs/stabilization-checklist.md).

## Struktura

```text
app/
  page.jsx
  katedra-scoped.css
  pisi/
    page.jsx
    pisi.css
    components/
  prijava/
  registracija/
  zaboravljena-lozinka/
  reset-lozinke/
  auth/callback/route.js
  api/chat/
  api/checkout/
  api/webhook/
  api/balance/
  api/state/

lib/
  manuscript/

lib/
  academic-suite/             shared contracts/adapters/reconciliation
  supabase/
  hooks/useAuth.js
  stripe.js
  limits.js

docs/architecture/
  SHARED_SUPABASE_SCHEMA.md
  ACADEMIC_SUITE_RELEASE_CHECKLIST.md
  ADR_001_SHARED_IDENTITY.md
  LEKTA_KATEDRA_CROSS_REPO_COMPATIBILITY.md

supabase/
  README.md                    pointer to Lekta schema authority
  migrations/                 no-op history markers only; no production DDL authority

scripts/
  academic-suite-browser-e2e.mjs

public/
  katedra-pack.json
  katedra-pack.meta.json
```

## Persistence model

### Guest

Gost radi preko `localStorage` i dobiva UUID `projectId` prije registracije. Login attach-a ownership; ne bi trebao stvarati novi identitet projekta.

### Prijavljeni korisnik — compatibility faza v0.1

Aplikacijski `/api/state` još koristi `katedra_projects` radi kompatibilnosti sa starim engineom. Lekta Supabase foundation automatski mirrorira zapis u:

- `academic_projects` — canonical project metadata;
- `katedra_project_state` — Katedra-owned process state.

Za stare `k...` projekte canonical shared UUID postaje DB UUID compatibility retka; stari `k...` ostaje samo legacy alias.

Za nove UUID-first projekte isti UUID se čuva kao `academic_projects.id`.

## Shared commerce

Katedra ne uvodi drugi entitlement model.

Existing Lekta authority ostaje:

```text
products → entitlements → document_slots
```

Aktivni Lekta katalog već uključuje `pass_zavrsni`, `pass_diplomski` i `pass_semestralni`. Foundation dodaje opcionalni `academic_project_id` na `entitlements` i `document_slots` tako da se postojeća kupnja/Pass može vezati na isti projekt koji Katedra koristi.

Katedrin token wallet i Lekta entitlementi imaju različite svrhe:

- wallet = koliko AI compute troška korisnik može potrošiti u Katedri;
- entitlement = postojeće Lekta purchase/slot/Pass pravo, sada project-aware.

Katedrin contextual Pass UX i project-aware server provjere postoje, ali puna
produkcijska aktivacija i dalje ovisi o canonical Lekta commerce/RPC ugovoru,
staging checkoutu i authenticated E2E dokazu. Foundation ne predstavlja
neovisni commerce backend.

## Shared account i SSO

Jedan Lekta Supabase znači jedan underlying account (`auth.users.id`) za Katedru i Lektu.

To **ne znači automatski seamless session** između dvije različite root domene. Ako su aplikacije na `katedra.hr` i `lekta.hr`, kasnije je potreban centralni auth/session-exchange flow za iskustvo “prijavljen sam u jednoj pa sam odmah prijavljen i u drugoj”.

To je UX/auth transport problem; identitet je već zajednički.

## Academic rules source of truth

Katedra ne smije održavati konkurentsku fakultetsku rules bazu.

`public/katedra-pack.json` je coach projection Lektinih verificiranih profila/rules podataka. Dugoročno može biti zamijenjen verzioniranim paketom/API exportom, ali authority ostaje Lekta Academic Core.

## CI / release gates

Katedra branch ima tri relevantna gatea:

1. **Foundation check** — TypeScript + lint + Next production build.
2. **DB authority guard** — Katedra ne smije ponovno uvesti production DDL; schema authority je Lekta repo.
3. **Academic Suite browser E2E** — production Katedra build + stvarni deployed Lekta PR preview + stvarni `.docx` file chooser/analyzer + sanitized handoff natrag.

**DB migration smoke sada živi u Lekta CI-ju**, zajedno s migration authorityjem.

Produkcijske migracije primjenjuju se na Lekta Supabase iz Lekta migration historyja.

Lokalni Katedra SQL marker nije zamjena za Lekta migration history i ne smije se koristiti kao production schema authority.

## Trenutačno namjerno odgođeno

- seamless cross-domain SSO;
- prebacivanje `/api/state` direktno na shared tablice;
- retirement `katedra_projects` compatibility tablice;
- full cross-device rich Lekta resolution history;
- runtime cross-product Thesis/Diplomski Pass UX;
- Lekta cloud persistence u `lekta_checks`;
- model-tier routing;
- aktivni deadline reminders;
- potpuni AI-policy projection iz Lekte.

## Važne produktne ograde

- Nema plagijat detektora kao core featurea.
- Nema “napiši cijeli rad jednim klikom” proizvoda bez procesa.
- Katedra ne certificira formalnu usklađenost.
- Lekta ne piše akademsku argumentaciju.
- Procesni score i Lekta compliance score ostaju dva odvojena signala.
- Raw dokument ne ulazi u shared Supabase foundation.

Za detaljni charter vidi `VIZIJA.md`. Database release authority i migration history su u Lekta repou.
