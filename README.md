# Katedra

AI kopilot za pisanje seminarskih, završnih i diplomskih radova na hrvatskom —
wizard + prompt generator + streaming chat s Claudeom, plaćen kreditima, plus
integracija s [Lekta](https://lektahr.netlify.app) (deterministički provjeritelj
formalne usklađenosti radova s pravilima fakulteta).

Samostalna Next.js aplikacija — vlastiti Supabase projekt (korisnici, baza),
vlastiti Stripe, vlastiti Anthropic ključ. Ne dijeli ništa s maturiraj.hr.

**Buduće:** ovaj Supabase projekt je kandidat da postane zajednički
account backend za Katedru ↔ Lektu (jedna prijava, oba proizvoda) — odluka
je donesena, migracija još nije napravljena (Lekta danas nema prijavu). Vidi
`PRODUCT_CONSTITUTION.md` → "Zajednički account (buduće)" za detalje i
otvorena pitanja (koji Supabase projekt, cross-domain SSO, zajednički
entitlementi).

**Buduće (arhitektura chata):** `future/appstarter-v2/` čuva nacrt za pravi
Anthropic tool-calling + Postgres shemu s DB-ograničenjima (npr. zamjerka
mentora ne može se zatvoriti bez dokaza) koja bi zamijenila današnji
model "jedan generirani prompt + jednostavan streaming chat". Namjerno
odgođeno (rebuild core chata, ne staje u 2–3 tjedna) — vidi `NOTES.md` ondje
za točan status i za razdiobu Katedra/Lekta odgovornosti unutar predloženog
`run_checks` alata prije nego se ikad ožiči.

## Arhitektura

```
Korisnik ──JWT──► /api/chat ──► provjera kredita ──► Anthropic API (tvoj ključ)
                                      │ stream
                  ◄── SSE natrag ─────┘
                  na kraju: katedra_consume(input + 5×output)

Uplata: /api/checkout → Stripe Checkout → /api/webhook → katedra_grant → krediti
Lekta:  #lekta=<base64> u URL hashu → lkParseHash() → chat coach (lk* funkcije)
Stanje: saveState/pushHist/rpLog/saveManifest → /api/state (PUT, prijavljeni) →
        katedra_projects redak; localStorage ostaje gost/cache sloj
```

Wizard/chat/generator (`app/katedra-engine.js`, `app/katedra-body.js`) je
gotovo bajt-točan port HTML referentne implementacije ("Katedra v10.3-chat") —
poslovna logika (prompt builderi, checklist pravila, Lekta coach flow) nije
prepisivana, samo su putanje/auth/perzistencija prilagođeni ovoj app-i (pravi
`/api/chat` umjesto BYOK-a, `/api/state` umjesto samo-lokalnog stanja, pravi
`/katedra-pack.json` fetch umjesto ugrađenog "lite" packa).

## Postavljanje od nule

1. **Supabase projekt** — [supabase.com/dashboard](https://supabase.com/dashboard) → New project.
   Kopiraj `Project URL`, `anon public` ključ i `service_role` ključ u `.env.local`.
2. **Migracije** — Supabase dashboard → SQL editor → zalijepi redom
   `supabase/migrations/20260802000000_katedra_credits.sql` pa
   `supabase/migrations/20260803000000_katedra_projects.sql` pa
   `supabase/migrations/20260804000000_katedra_project_state.sql` (ili
   `supabase db push` ako imaš CLI povezan).
3. **Stripe** — [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API keys →
   `STRIPE_SECRET_KEY` u `.env.local`. Zatim Developers → Webhooks → Add endpoint:
   `https://<tvoja-domena>/api/webhook`, event `checkout.session.completed` →
   kopiraj `whsec_...` u `STRIPE_WEBHOOK_SECRET`.
   **Prije lansiranja provjeri cijene u `app/api/checkout/route.js` (`PACKAGES`)** —
   trenutne su kalkulirane na ~2,5× trošak Anthropic tokena, provjeri jesu li još
   točne za model koji koristiš.
4. **Anthropic** — [console.anthropic.com](https://console.anthropic.com) → API Keys →
   `ANTHROPIC_API_KEY` u `.env.local`. **Odmah postavi mjesečni spend limit**
   (Settings → Limits) — zaštita od buga koji bi mogao potrošiti kredit
   nekontrolirano.
5. **Domena / `NEXT_PUBLIC_APP_URL`** — postavi na stvarnu produkcijsku domenu
   (koristi se za Stripe redirect i watermark u generiranim promptovima).
6. **Lekta koordinacija** — kad imaš pravu domenu, javi timu koji održava Lekta
   repo da promijeni `KATEDRA_URL` u njihovom "Riješi u Katedri" CTA-u da
   pokazuje na tvoju domenu (to je njihov kod, ne ovaj repo).

## Razvoj

```
npm install
npm run dev      # http://localhost:3000 (ili sljedeći slobodan port)
```

Dok `.env.local` nema prave Supabase vrijednosti, statične stranice se i dalje
renderiraju (middleware ima guard), ali sve auth/kredit/chat funkcionalnosti
vraćaju grešku dok ne postaviš pravi projekt (koraci 1–4 gore).

## Struktura

```
app/
  page.jsx                    tanak wrapper — samo montira vanilla engine
  katedra-engine.js           cijeli vanilla-JS engine (wizard, chat, generator,
                              Lekta handoff/coach, server-sync stanja)
  katedra-body.js             statični HTML shell (JSON-escaped string)
  katedra-scoped.css          dizajn sustav (tokeni + 8 koža), skopiran na .katedra-page
  prijava/, registracija/,
  zaboravljena-lozinka/,
  reset-lozinke/              auth stranice
  auth/callback/route.js      PKCE code exchange
  api/chat/                   streaming Anthropic proxy + naplata
  api/checkout/                Stripe Checkout (3 paketa kredita)
  api/webhook/                 Stripe webhook → krediti
  api/balance/                  stanje kredita (header + proaktivni paywall)
  api/state/                    server-side sync cijelog stanja čarobnjaka
                              (checklist, generator, povijest, dnevnik, Lekta
                              manifest) — GET najnoviji redak, PUT upsert
lib/
  supabase/                   client/server/admin Supabase helperi
  hooks/useAuth.js            auth context (user, loading)
  stripe.js, limits.js        Stripe singleton, MIN_BALANCE
supabase/migrations/          katedra_credits, katedra_projects,
                              katedra_project_state (proširenje za /api/state)
public/katedra-pack.json     Lekta baza pravila (130 jedinica/395 profila) —
                              osvježi ručno kad Lekta objavi novu verziju
```

**Izgled i profil studija.** `katedra-scoped.css` drži sve boje u tokenima;
koža je `data-skin` na `#katedra-root` (8 komada, zadana `kreda`, mijenja se
gumbom "Izgled" u zaglavlju). Izbor kože je **samo lokalan** (`rp_skin`) jer
`/api/state` validira `{tip, checks, gen}` — prijenos na server ide uz sljedeću
migraciju stanja. Izbor smjera (`rp_profile`) se, za razliku od toga, **sinkronizira**:
`profileId` je već postojao u manifestu i shemi, samo ga se dosad nije moglo
postaviti.

Cijelo stanje čarobnjaka (checklist, generator polja, povijest promptova,
dnevnik procesa, Lekta projekt manifest) živi u `katedra_projects` retku po
korisniku — server je izvor istine za prijavljene korisnike. Gosti (bez
prijave) i dalje rade isključivo preko `localStorage` (bez sync-a); prvi put
kad se prijave, njihovo trenutno lokalno stanje migrira se na server (ako
server još nema ništa za taj račun). `katedra-engine.js` debounce-a čest zapis
(generator polja, checklist — `syncServerDebounced`, ~1.5 s) i odmah šalje
rijetke, diskretne promjene (novi prompt, dnevnik zapis, Lekta nalaz —
`syncServerNow`).

## Usklađenost s VIZIJA.md

`VIZIJA.md` (charter v1) je filter za svaku buduću odluku. Status snapshot —
mijenja se kako gradimo, za razliku od charter-a samog:

**Već usklađeno:**

- Anti-scope lista (detekcija plagijata, vlastita gramatika, "rad jednim
  klikom" bez procesa, matura/prijemni sadržaj, LMS, zajednica, B2B Campus)
  — ništa od toga nije izgrađeno; `buildAuto()`-ov Autopilot i dalje forsira
  Plan i program prije ijednog poglavlja, pa ni to ne krši "bez procesa".
- "Jedan aktivan projekt u v1" — baza tehnički dopušta više redaka po
  korisniku, ali nema UI-a za upravljanje/prebacivanje projekata i
  `GET /api/state` uvijek vraća samo zadnji — proizvod se već ponaša kao v1.
- Lekta ostaje besprijekorno besplatan, nepaywall-an link iz Katedre
  (`lektaLink()`) — "Lekta Check besplatan zauvijek" već vrijedi s naše strane.
- AI ledger temelj (`rpLog`/`exportDnevnik`/`izjavaStart`) već postoji —
  charter ga zove "core differentiator, produbiti nakon M1".

**Stvarni nedostaci (potvrđeno čitanjem koda):**

- Kaskada fakultet → studij → smjer nudi SVE jedinice iz `katedra-pack.json`,
  bez filtera po `status === 'verified'`. Charter traži "tvrdu ogradu" (samo
  verified fakulteti), ali u kodu stoji suprotna, izričito obrazložena odluka
  (`lpRenderUnits()`: šira lista, status vidljiv umjesto skrivanja). **Dvije
  dokumentirane odluke koje si proturječe — treba odluka osnivača, ne tiho
  rješenje.** Do tada: status (potvrđen / tehnički) piše na svakom retku,
  i za sastavnicu i za pojedini profil.
- Nema model-tier routinga (coach na jeftinom modelu, poglavlja na top
  modelu) — svaki AI poziv danas ide na isti default model.
- Nema demo-cap za goste (charter: "demo pisanja do 1.500 riječi") —
  "Piši ovdje" je 100% iza prijave+kredita, bez ikakvog anonimnog pregleda.
- Nema slanja podsjetnika na rok (retention) — Rok kalkulator samo prikazuje
  datume, ništa se aktivno ne šalje.
- `aiPolicy` (FOI 0–4, FPZG izjava) blokirano na Lektinoj strani — nijedan
  profil u packu danas nema aiPolicy-oblikovano polje.
- "Povijest verzija radova" — vjerojatno već pokriveno kroz `rp_hist` +
  dnevnik + izjava generator, samo ne pod jednom "priča o autorstvu"
  etiketom; pravo verzioniranje SADRŽAJA rada sudaralo bi se s ".docx nikad
  ne napušta uređaj" obećanjem. Preporuka, ne odluka — provjeriti s
  osnivačem prije gradnje bilo čega novog ovdje.
- Monetizacija: charter traži Pass model (Seminarski/Završni/Diplomski Pass,
  jedna kupnja pokriva i Lektu) umjesto sadašnjeg token-kredit novčanika.
  Odluka: **repriceati postojeća 3 paketa na charter-ove cijene, zadržati
  novčanik ispod** (brzina do prve naplate važnija od punog redizajna sada);
  "Pass pokriva i Lektu" čeka zajedničke entitlemente (V3, vidi
  `PRODUCT_CONSTITUTION.md`).

## Poznata ograničenja

- `npm audit` javlja 3 "high" upozorenja u Next.js-ovim vlastitim tranzitivnim
  ovisnostima (postcss/sharp) — predloženi fix vraća Next na v9 (drastičan
  downgrade), namjerno nije primijenjen.
- Nema automatiziranog CI/deploy pipelinea za migracije — primjenjuju se ručno.
- `/api/state` sync nema pravi merge: kad se prijavljeni korisnik javi s
  praznim lokalnim stanjem, server pobjeđuje (povlači se zadnje spremljeno).
  Ako lokalno već postoji nešto (npr. gost upravo nešto upisao pa se odmah
  prijavio), lokalno se NE gazi — sljedeći save ga šalje na server, potencijalno
  kao zaseban redak (dedup je po `guest_project_id`, ne po sadržaju).
