# Product Constitution — Katedra × Lekta

Katedra i Lekta su dva odvojena proizvoda unutar jednog akademskog workflowa.
Ne grade se kao dvije aplikacije s hrpom featurea — svaki engine radi samo ono
u čemu je najbolji. Ovaj dokument definira gdje je ta granica, prije nego što
je ijedno od dvoje pokuša prijeći.

**Roditeljski dokument: `VIZIJA.md`** (charter v1, 2. 8. 2026) — puna poslovna
vizija (identitet, north star, brend, korisnik, scope, monetizacija, rast).
Ovaj dokument (`PRODUCT_CONSTITUTION.md`) je uži i timeless: samo granica
odgovornosti Katedra ↔ Lekta. Za trenutačno stanje izgradnje naspram charter-a
(što je već usklađeno, što nedostaje) vidi `README.md` → "Usklađenost s
VIZIJA.md" — to je status snapshot i mijenja se kako gradimo; ovaj dokument
mijenja se samo svjesnom odlukom, kao i sam charter.

## Dvije nepregovorljive granice

**Katedra nikada ne proglašava dokument formalno usklađenim.**
Katedra ne otvara `.docx`, ne broji Word polja, ne provjerava marže ni citatnu
mehaniku deterministički. Kad Katedra spomene format, citate ili strukturu
dokumenta, to je uvijek preporuka ili podsjetnik — nikad tvrdnja "ovo je
usklađeno". Jedina rečenica koju Katedra smije reći o formalnoj usklađenosti
je: "to provjeri Lekta".

**Lekta nikada ne piše argumentaciju ni sadržaj rada.**
Lekta ne predlaže tezu, ne piše rečenice, ne ocjenjuje kvalitetu argumenta.
Lekta mjeri ono što stroj može izmjeriti (format, citatna mehanika, struktura
dokumenta, Word polja) — deterministički, po verificiranim pravilima
fakulteta. Sadržajnu kvalitetu rada ocjenjuje isključivo Katedra (uz mentora).

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
Ova dva broja se **nikad ne zbrajaju niti prikazuju kao jedan "spremnost %"**
— to bi sakrilo razliku između "napisao sam rad" i "rad je formalno
ispravan". Vidi `renderLine()`/`window.__pct` u `app/katedra-engine.js` za
gdje se ovo trenutno poštuje.

## Issue lifecycle — samo Lekta smije reći "riješeno"

Kad Lekta preda nalaz Katedri (`#lekta=<base64 JSON>` hash), svaki nalaz nosi
status. Katedra smije nalaz označiti kao:

- `USER_CHANGED` — student kaže da je nešto promijenio
- `SKIPPED` — student je preskočio

Katedra **ne smije** nalaz označiti kao `VERIFIED_FIXED`. Tu potvrdu daje
isključivo novi Lekta re-check (novi `#lekta=` hash s ažuriranim nalazima).
Vidi `lkMark()` u `app/katedra-engine.js` — funkcija namjerno nema granu za
`VERIFIED_FIXED`.

## Privatnost — dokument nikad ne napušta studentov uređaj

Rad (`.docx`) ostaje na studentovom uređaju. Između Katedre i Lekte putuju
samo ID-jevi nalaza i metapodaci (projectId, unitId, profileId, score,
issues bez teksta rada) — nikad sadržaj dokumenta. Ovo je i tehnički
enforced: `katedra_projects` (Supabase) sprema `lekta_issues` kao jsonb
metapodataka, ne sadržaj rada.

## Zajednički izvor akademskih pravila

Katedra ne smije hardkodirati fakultetska pravila (citatni stil, opseg,
format). Ta pravila dolaze isključivo iz Lekte (`public/katedra-pack.json`,
generiran iz `lekta data/profiles/verified-profiles.json`) — Katedra ih samo
prikazuje i koristi za savjetovanje (`lpInit/lpRender/lpToGen`), Lekta ih
koristi za stvarnu provjeru. Kad se pravila razlikuju od onoga što je u
packu, Lekta je izvor istine — pack se ažurira, ne Katedrin kod.

## Zajednički account (buduće) — odluka donesena, migracija još ne

Katedra i Lekta ostaju dvije zasebne aplikacije/domene, ali dijele **jedan
korisnički račun**. Student se registrira jednom (bilo gdje) i isti account
vrijedi u obje aplikacije — uklj. kasnije zajedničke entitlemente (npr.
"Diplomski Pass" koji otključava i Katedra Pro i Lekta Full odjednom).

**Ovo formalno poništava raniju odluku** iz faze kad je Katedra izdvojena u
samostalnu aplikaciju (tada odabrano "potpuno odvojeno" za Supabase/auth) —
ta ranija odluka odnosila se na odvajanje od **Maturiraja**, nepovezanog
proizvoda, i ostaje točna. Ova nova odluka je o Katedri ↔ Lekti, drugom paru,
koji ovaj dokument već tretira kao jedan ekosustav.

**Trenutačno stanje: odluka je donesena, migracija nije napravljena.** Lekta
danas nema nikakve korisničke račune (anonimno: uploadaj dokument, dobij
score). Dok to ostaje istina, nema hitne akcije — Katedrina Supabase shema je
već oblikovana za ovo (svaka tablica ima `user_id references auth.users(id)`
te `katedra_` prefiks bez rizika kolizije imena u dijeljenoj bazi), pa nije
potrebna nikakva migracija sheme. Kad Lekta bude spremna dodati prijavu:

- **Kandidat za zajednički Supabase projekt: Katedrin postojeći** — već je
  izgrađen i popunjen pravom shemom; Lekta danas nema ništa za migrirati.
- **Pravi single sign-on (klik "Otvori u Katedri" bez ponovne prijave)
  zahtijeva ili zajedničku roditeljsku domenu** (Supabase-ova SSR cookie
  sesija dijeli se samo preko poddomena iste domene, ne preko dvije potpuno
  odvojene top-level domene) **ili token-relay handshake** nalik OAuth
  "connect" flowu. Nije problem localStorage-a (dvije domene svejedno ne bi
  dijelile localStorage) — problem je cookie/session domena. Neriješeno.
- **Zajednički entitlementi (Diplomski Pass) ne postoje još** — Katedrina
  naplata danas je token-kredit novčanik (`katedra_wallets`), ne entitlement
  flag koji bi Lekta mogla čitati. Prirodna buduća evolucija, ne redizajn
  potreban danas.

## Brand

Katedra: *"Od teme do obrane."* Lekta: *"Provjeri prije predaje."* Obje
stranice smiju diskretno spomenuti da su dio istog akademskog workflow
sustava. Nema trećeg branda dok se ne dokaže integracija.
