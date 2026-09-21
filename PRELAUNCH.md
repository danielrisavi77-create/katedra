# Katedra — što treba prije prve prave naplate

Živi dokument, ne jednokratan izvještaj — ažuriraj kako se stavke rješavaju.
Povijesni checklist u nastavku započet je 2026-08-13; aktualni lokalni snapshot
je 2026-08-16.

## Aktualni release snapshot

- Lokalni typecheck, lint, testovi, build, dependency audit i browser smoke
  testovi prolaze; detalji su u
  [`docs/release/LOCAL_VERIFICATION_2026-08-16.md`](docs/release/LOCAL_VERIFICATION_2026-08-16.md).
- Legacy string-rendered `/pisi` engine je uklonjen; aktivni workspace je React
  komponentni sloj.
- Stvarni paid/agentic launch i dalje je blokiran canonical Lekta/Supabase
  migracijama, RPC/RLS/worker deploymentom, staging credentialima i punim
  authenticated money-flow dokazom; detalji su u
  [`docs/autonomous/BLOCKERS.md`](docs/autonomous/BLOCKERS.md).
- Ne označavati lokalne `BLOCKED_EXTERNAL` testove kao uspješan production
  checkout ili agentic run.

## 0. Blokira sve ostalo

- [x] **Riješi GitHub Actions billing.** ~~`gh pr checks 13` pada s "recent
  account payments have failed..."~~ — riješeno 2026-08-04, CI ponovno radi
  (rerun na PR #13 prošao čisto).

## 1. PR-ovi

**Spojeno u Katedra `master` (2026-08-04):**

- [x] [PR #13](https://github.com/danielrisavi77-create/katedra/pull/13) — popravak entitlements insert-a (KRITIČNO)
- [x] [PR #14](https://github.com/danielrisavi77-create/katedra/pull/14) — `/racun` gumb + `/api/withdrawal`
- [x] [PR #15](https://github.com/danielrisavi77-create/katedra/pull/15) — ovaj dokument

**Još otvoreno, čeka pregled na Lekta strani** (Katedra strana ih ne može sama spojiti):

- [ ] [Lekta PR #29](https://github.com/danielrisavi77-create/Lekta/pull/29) — `withdrawal_requests` tablica. Dok ovo ne sleti, `/api/withdrawal` vraća 500 na insertu — PR #14 je kod-gotov, ali funkcionalno neispravan bez ovoga.
- [ ] [Lekta PR #31](https://github.com/danielrisavi77-create/Lekta/pull/31) — `katedra_pass_*` retci u products katalogu (samostalan, nije hitan).
- [ ] Lekta billing contract v2 — `katedra_consume` mora biti idempotentan po
  `(user_id, request_id)` i primati canonical `project_id`.
- [ ] Lekta atomic access/rate-limit contract — implementirati
  `katedra_authorize_project_ai`, `katedra_reserve_request` i
  `katedra_release_request` prije uključivanja production flagova.

Nakon što #31 sleti: treba **zaseban follow-up Katedra PR** koji mijenja
`product_id: null` → `'katedra_pass_*'` u `app/api/webhook/route.js`. Namjerno
nije napravljen u istom koraku (FK bi pukao dok #31 nije spojen). Javi kad je
#31 spojen pa se to napravi.

## 2. Konfiguracija/tajne (nijedna nije potvrđena za produkciju)

Za aktualne environment reference i lokalne verification rezultate vidi [stabilizacijski report](docs/stabilization-report.md) i [stabilizacijski checklist](docs/stabilization-checklist.md).

- [ ] `RESEND_API_KEY` — za automatsku e-mail potvrdu raskida ugovora (zakonska
  obveza, ne "lijepo imati" — v. §3 dolje).
- [ ] `WITHDRAWAL_FROM_EMAIL` — verificirana `@katedra.hr` adresa u Resend
  dashboardu. U produkciji bez ove vrijednosti endpoint fail-closed; lokalni
  development fallback na Resendov test domain ne smije ići u produkciju.
- [ ] Supabase env varijable (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — nedostaju u
  lokalnom `.env.local` koji sam imao dostupan; ako nedostaju i u produkcijskom
  deployu, ništa auth-gated ne radi.
- [ ] Stripe test-mode ključevi za stvarni end-to-end test checkouta prije
  produkcijskih ključeva.
- [ ] `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY` i `STRIPE_WEBHOOK_SECRET` —
  protected deployment vrijednosti nisu potvrđene u ovom audit okruženju.
- [ ] `KATEDRA_BILLING_RPC_CONTRACT=v2` — uključiti tek nakon Lekta v2 RPC
  rollouta; bez toga production chat namjerno fail-closed.
- [ ] `KATEDRA_RATE_LIMIT_STORE=supabase` — uključiti tek nakon atomic Lekta
  reservation RPC rollouta; process-local `Map` nije production-safe.

## 3. Pravni zahtjevi

- [ ] **Pravnik mora pregledati `/privatnost` i `/uvjeti`** prije prve
  naplate — oba su označena kao NACRT, istražena i ojačana konkretnim
  izvorima (v. "Izvori" odjeljak na dnu svake stranice), ali nisu pravni
  savjet.
- [ ] `/racun` gumb za jednostrani raskid ugovora (Zakon o zaštiti potrošača,
  NN 59/2026, čl. 81.a, na snazi od 19.6.2026) — kod je gotov (PR #14), ali
  funkcionalno neispravan dok Lekta #29 i Resend konfiguracija ne slegnu (v.
  gore).
- [ ] Popuni sva `[PRAVNI NAZIV OBRTA/TVRTKE]`, `[OIB]`, `[ADRESA]`
  placeholdere u `/privatnost` i `/uvjeti`.
- [ ] PDV status (paušalni obrt prag 60.000 € / EU OSS prag 10.000 € —
  već napisano u `/uvjeti` §4, treba samo potvrdu koji status stvarno vrijedi).

## 4. Poznato, ali nije riješeno u ovom krugu

- [x] **PR6 — marketing landing stranica.** `/` sada renderira explainer
  landing za hladne posjetitelje s jasnim ulazom u besplatni tok i Completion
  Scan. Lokalni smoke i landing testovi potvrđuju rutu; preostaje samo
  kontinuirana vizualna provjera.
- [ ] **Puni autentificirani E2E test.** Checkout (Stripe test mode), chat s
  AI capability gateom, .docx upload — sve provjereno strukturno (kod je
  ispravan), ali ne i uživo kroz stvarni prijavljeni nalog. Treba prave
  Supabase/Stripe kredencijale koje agent nema.
- [ ] **Neusklađena paralelna grana** (`claude/ledger-merge-v1` linija —
  Audit 2 moat foundations, Faza 3/4 MVP) — bila je odvojena od glavne
  razvojne linije, otad spojena u master preko PR #11. Ako se pojavi još
  neka nepovezana grana, provjeri `git log --oneline --all --graph` prije
  pretpostavke da je sve sinkronizirano.

## 5. Poslovne odluke (ne kod)

- [ ] **Pronađi 10 stvarnih studenata** (5 završnih, 5 diplomskih) i pokušaj
  naplatiti barem trojici — izvorni north star iz strateškog audita, još
  nije adresiran jer je fokus bio na tehničkim/pravnim blokerima.
- [ ] Potvrdi da cijena Katedra Passa (€29,90–129,90) svjesno stoji uz Lekta
  pojedinačnu provjeru (€3,99–24,99) — razlika je očito zato što Pass nosi
  cijeli Katedra proces, ne samo Lekta provjeru, ali vrijedi svjesna potvrda,
  ne samo da se to dogodilo slučajno.
