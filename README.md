# Katedra

AI kopilot za seminarske, završne i diplomske radove na hrvatskom: procesni wizard, prompt generator, streaming chat s Claudeom, akademski workflow i integracija s [Lektom](https://lektahr.netlify.app), determinističkim provjeriteljem formalne usklađenosti rada.

Katedra i Lekta ostaju **odvojene aplikacije i proizvodi**, ali od foundation v0.1 dijele jedan Academic Suite backend. Postojeći Katedra Supabase projekt je odabran kao zajednički identity/data backbone za oba proizvoda.

- Katedra: vodi proces, planiranje, pisanje, semantičku recenziju i pripremu obrane.
- Lekta: čita stvarni `.docx`, provjerava verificirana pravila i jedina smije deterministički potvrditi da je nalaz riješen.
- Shared Supabase: isti account, isti akademski projekt i zajednički entitlementi.
- Raw `.docx` i tekst rada ne ulaze u shared backend.

Za nepregovorljive produktne granice vidi `PRODUCT_CONSTITUTION.md`. Za shared bazu vidi `docs/architecture/SHARED_SUPABASE_SCHEMA.md`.

## Arhitektura

### Aplikacijski sloj

```text
Korisnik ──JWT──► /api/chat ──► provjera kredita ──► Anthropic API
                                      │ stream
                  ◄───────────────────┘
                  na kraju: katedra_consume(input + 5×output)

Uplata: /api/checkout → Stripe Checkout → /api/webhook → katedra_grant
Lekta:  project/unit/work → Lekta → #lekta=<sanitized result> → Katedra coach
```

### Shared Supabase

```text
auth.users
    └── academic_projects          SHARED CORE
          ├── katedra_project_state KATEDRA-OWNED
          ├── lekta_checks          LEKTA-OWNED
          └── entitlements          SHARED COMMERCE
```

Canonicalni identiteti:

- korisnik: `auth.users.id`
- akademski rad/projekt: `academic_projects.id` (UUID)

`katedra_projects` i dalje postoji u foundation v0.1, ali više nije dugoročni canonical shared model. Trenutačni `/api/state` nastavlja pisati u postojeću tablicu radi sigurnog rollouta, a DB trigger mirrorira podatke u `academic_projects` i `katedra_project_state`.

```text
Katedra /api/state
      ↓
katedra_projects                temporary compatibility write-path
      ↓ DB mirror
academic_projects + katedra_project_state
```

Nakon stabilnog produkcijskog observation perioda `/api/state` se može prebaciti na izravne shared-table writeove, a compatibility tablica kasnije umiroviti zasebnom migracijom.

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

Za Katedra ↔ Lekta koristi se **jedan Supabase projekt**. Ne stvaraj drugi Supabase samo za Lektu.

Kopiraj u `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` mora ostati isključivo server-side.

### 2. Migracije

Za potpuno novi projekt primijeni redom:

```text
supabase/migrations/20260802000000_katedra_credits.sql
supabase/migrations/20260803000000_katedra_projects.sql
supabase/migrations/20260804000000_katedra_project_state.sql
supabase/migrations/20260805000000_academic_suite_foundation.sql
supabase/migrations/20260805010000_academic_suite_foundation_hardening.sql
```

Za postojeću produkcijsku Katedra bazu prije dvije Academic Suite migracije obavezno prođi preflight/postcheck iz:

`docs/architecture/ACADEMIC_SUITE_RELEASE_CHECKLIST.md`

Nemoj ručno mijenjati produkcijski SQL pri pasteanju. Ako migraciju treba promijeniti, promijeni committed file i ponovno pusti CI.

### 3. Stripe

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

Katedrin postojeći wallet (`katedra_wallets`, `katedra_topups`, `katedra_usage`) ostaje AI compute-cost accounting. Cross-product pristupna prava koriste zasebni shared `entitlements` model.

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

Lekta reverse handoff podržava `VITE_KATEDRA_URL`. Katedrin legacy vanilla engine trenutačno još koristi postojeći `https://lektahr.netlify.app` kao Lekta production URL; prije budućeg domain cutovera taj URL treba izvući u konfiguraciju i testirati, a ne mijenjati ad hoc tijekom releasea.

## Razvoj

```bash
npm install
npm run dev
```

Default lokalno: `http://localhost:3000`.

Bez pravih Supabase env vrijednosti statične stranice se mogu renderirati, ali auth/kredit/chat funkcionalnosti neće raditi normalno.

## Struktura

```text
app/
  page.jsx
  katedra-engine.js
  katedra-body.js
  katedra-scoped.css
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

supabase/migrations/
  20260802000000_katedra_credits.sql
  20260803000000_katedra_projects.sql
  20260804000000_katedra_project_state.sql
  20260805000000_academic_suite_foundation.sql
  20260805010000_academic_suite_foundation_hardening.sql

scripts/
  academic-suite-browser-e2e.mjs
  foundation-db-smoke.sql
  foundation-db-hardening-smoke.sql

public/
  katedra-pack.json
  katedra-pack.meta.json
```

## Persistence model

### Guest

Gost radi preko `localStorage` i dobiva UUID `projectId` prije registracije. Login attach-a ownership; ne bi trebao stvarati novi identitet projekta.

### Prijavljeni korisnik — compatibility faza v0.1

Aplikacijski `/api/state` još koristi `katedra_projects` radi kompatibilnosti sa starim engineom. Shared migration automatski mirrorira zapis u:

- `academic_projects` — canonical project metadata;
- `katedra_project_state` — Katedra-owned process state.

Za stare `k...` projekte canonical shared UUID postaje već postojeći `katedra_projects.id`; stari `k...` ostaje `legacy_client_project_id`.

Za nove UUID-first projekte isti UUID se čuva kao `academic_projects.id`.

## Shared commerce

`entitlements` je zajednički cross-product authority za stvari poput:

- `lekta-check`
- `lekta-fix`
- `katedra-pro`
- `academic-pass`
- `academic-pass-plus`

Foundation v0.1 uvodi schema/ownership pravila, ali puni Diplomski Pass checkout/UX još nije implementiran.

Katedrin token wallet i shared entitlementi imaju različite svrhe:

- wallet = koliko AI compute troška korisnik može potrošiti;
- entitlement = koje capabilityje/proizvode korisnik ima pravo koristiti.

## Shared account i SSO

Jedan Supabase znači jedan underlying account (`auth.users.id`) za Katedru i Lektu.

To **ne znači automatski seamless session** između dvije različite root domene. Ako su aplikacije na `katedra.hr` i `lekta.hr`, kasnije je potreban centralni auth/session-exchange flow za iskustvo “prijavljen sam u jednoj pa sam odmah prijavljen i u drugoj”.

To je UX/auth transport problem; identitet je već zajednički.

## Academic rules source of truth

Katedra ne smije održavati konkurentsku fakultetsku rules bazu.

`public/katedra-pack.json` je coach projection Lektinih verificiranih profila/rules podataka. Dugoročno može biti zamijenjen verzioniranim paketom/API exportom, ali authority ostaje Lekta Academic Core.

## CI / release gates

Foundation branch ima tri važna Katedra gatea:

1. **Foundation check** — TypeScript + lint + Next production build.
2. **Foundation DB migration** — PostgreSQL 16, stvarna primjena legacy + shared + hardening migracija i invarianti.
3. **Academic Suite browser E2E** — production Katedra build + stvarni deployed Lekta PR preview + stvarni `.docx` file chooser/analyzer + sanitized handoff natrag.

DB smoke između ostalog provjerava:

- backfill legacy projekata;
- UUID/legacy identitet;
- mirror trigger;
- RLS;
- privacy invariant;
- zabranu cross-user project takeovera;
- zabranu entitlementa na tuđi projekt.

Produkcijske migracije se i dalje primjenjuju eksplicitno/ručno ili kroz već povezani Supabase CLI; CI ih testira na PostgreSQLu, ali ne dira produkcijsku bazu.

## Trenutačno namjerno odgođeno

- seamless cross-domain SSO;
- prebacivanje `/api/state` direktno na shared tablice;
- retirement `katedra_projects` compatibility tablice;
- full cross-device rich Lekta resolution history;
- runtime Academic/Diplomski Pass purchase UX;
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

Za detaljni charter vidi `VIZIJA.md`, a za release korake `docs/architecture/ACADEMIC_SUITE_RELEASE_CHECKLIST.md`.
