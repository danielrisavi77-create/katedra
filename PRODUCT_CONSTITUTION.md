# Product Constitution — Katedra × Lekta

Katedra i Lekta su dva odvojena proizvoda unutar jednog akademskog workflowa. Svaki engine radi samo ono u čemu je najbolji; zajednički backend služi kontinuitetu korisnika/projekta, ne brisanju produktnih granica.

## Dvije nepregovorljive granice

**Katedra nikada ne proglašava dokument formalno usklađenim.** Katedra ne otvara `.docx`, ne broji Word polja i ne certificira marže, citate ni submission compliance. Kad spominje format/citate, to je coaching, ne verifikacija.

**Lekta nikada ne piše akademsku argumentaciju ni sadržaj rada.** Lekta deterministički mjeri dokument prema verificiranim pravilima; Katedra vodi proces, razmišljanje, semantičku recenziju i obranu.

## Podjela odgovornosti

| | Katedra | Lekta |
|---|---|---|
| | vodi proces | provjerava rezultat |
| | pomaže planirati | čita stvarni `.docx` |
| | radi s literaturom | uspoređuje dokument s pravilima |
| | AI copilot | deterministic checker |
| | semantički review | tehnički audit |
| | mentor feedback | faculty compliance |
| | priprema obrane | submission preflight |
| | AI usage ledger | AutoFix / re-check verification |

## Signal integritet

Katedra process score/progress i Lekta compliance score ostaju dva odvojena signala. Nikad ih ne spajamo u jedan “spremnost %”.

## Issue lifecycle

Canonical lifecycle:

`OPEN -> USER_CHANGED -> RECHECK_REQUIRED -> VERIFIED_FIXED`

Katedra može evidentirati da je student nešto promijenio. Samo novi Lekta check može potvrditi da je isti stabilni nalaz nestao. Ako se vrati, ponovno je `OPEN`. Legacy finding ID-jevi se ne auto-verificiraju.

## Privatnost

Raw `.docx` ostaje u local-first Lekta workflowu.

Shared backend ne smije spremati:

- raw `.docx`;
- document body text;
- free-form document-derived `detail` / `location`;
- mentor comments;
- source passages.

Smiju se spremati samo strukturirani workflow metapodaci: account/project ID, ruleset/profile reference, score i sanitizirani finding metadata.

## Akademska pravila

Lekta Academic Core je jedini normative source of truth. Katedra koristi read-only coach projection (`katedra-pack` ili budući versioned export/API) i ne održava paralelnu fakultetsku rule bazu.

## Jedan account i jedan backend

**Existing Lekta Supabase project (`zrrjttizjyfcxmcpgzml`) je canonical Academic Suite backend.**

Katedra nema zaseban Supabase authority niti zasebnu production migration history.

Canonical identiteti:

- `auth.users.id` = account;
- `academic_projects.id` = akademski rad/projekt.

```text
LEKTA SUPABASE
│
├── auth.users
├── academic_projects
│   ├── katedra_project_state
│   └── lekta_checks
│
├── products
├── entitlements
│   └── document_slots
│
└── katedra_wallets / katedra_topups / katedra_usage
```

Database migrations za shared Core i Katedra-owned tablice žive samo u Lekta repou.

## Commerce

Academic Suite **ne stvara drugi entitlement sustav**.

Existing Lekta authority ostaje:

`products -> entitlements -> document_slots`

Foundation ga proširuje s vezom na `academic_projects.id`, tako da postojeći Lekta Pass/slot može biti vezan uz isti projekt koji Katedra koristi.

Katedra wallet je zaseban AI compute-cost accounting i nije access-right authority.

## Katedra persistence compatibility

Foundation v0.1 privremeno zadržava `katedra_projects` jer postojeći `/api/state` očekuje taj shape. DB trigger u Lekta Supabaseu zrcali ga u `academic_projects + katedra_project_state`.

To je migracijski most, ne trajni shared model. Nakon observation windowa `/api/state` se prebacuje direktno na Shared Core, a compatibility tablica se umirovljuje kroz Lekta migration history.

## Cross-domain SSO

Jedan Supabase Auth znači isti account, ali ne automatski isti browser cookie na `katedra.hr` i `lekta.hr`. Seamless SSO/session exchange dolazi kasnije i ne mijenja identity decision.

## Database authority rule

Ako Katedri treba nova tablica/kolona/RLS funkcija:

1. promjena se dizajnira cross-product;
2. production DDL ide u Lekta `supabase/migrations/`;
3. Katedra repo ažurira contracts/runtime consumer code;
4. Katedra ne uvodi competing migration copy.

## Brand

Katedra: *“Od teme do obrane.”*

Lekta: *“Provjeri prije predaje.”*

Obje ostaju zasebni proizvodi; shared backend je infrastruktura, ne treći javni brand.
