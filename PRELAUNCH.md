# Katedra — što treba prije prve prave naplate

Živi dokument, ne jednokratan izvještaj — ažuriraj kako se stavke rješavaju.
Stanje na 2026-08-04.

## 0. Blokira sve ostalo

- [ ] **Riješi GitHub Actions billing.** `gh pr checks 13` pada s "recent account
  payments have failed or your spending limit needs to be increased" —
  GitHub → Billing & plans. Dok se ne riješi, CI ne može potvrditi nijedan PR
  u ovom repou (ne samo #13).

## 1. Otvoreni PR-ovi i redoslijed spajanja

Redoslijed je bitan zbog FK ovisnosti — kolone iz reda 2 pucaju bez reda 1.

| # | Repo | Grana | Što | Ovisnost |
|---|---|---|---|---|
| 1 | Lekta | `claude/add-withdrawal-requests-table` | [PR #29](https://github.com/danielrisavi77-create/Lekta/pull/29) — `withdrawal_requests` tablica | — |
| 2 | Katedra | `claude/consumer-withdrawal-right` | [PR #14](https://github.com/danielrisavi77-create/katedra/pull/14) — `/racun` gumb + `/api/withdrawal` | čeka Lekta #29 (inače 500 na insertu) |
| 3 | Katedra | `claude/fix-entitlement-schema-mismatch` | [PR #13](https://github.com/danielrisavi77-create/katedra/pull/13) — popravak entitlements insert-a (KRITIČNO — bez ovoga svaka prava kupnja puca) | čeka billing (0.) |
| 4 | Lekta | `claude/add-katedra-pass-products` | [PR #31](https://github.com/danielrisavi77-create/Lekta/pull/31) — `katedra_pass_*` retci u products katalogu | — (samostalan, nije hitan) |

Nakon što #31 sleti: treba **zaseban follow-up Katedra PR** koji mijenja
`product_id: null` → `'katedra_pass_*'` u `app/api/webhook/route.js`. Namjerno
nije napravljen u istom koraku (FK bi pukao dok #31 nije spojen). Javi kad je
#31 spojen pa se to napravi.

## 2. Konfiguracija/tajne (nijedna nije postavljena)

- [ ] `RESEND_API_KEY` — za automatsku e-mail potvrdu raskida ugovora (zakonska
  obveza, ne "lijepo imati" — v. §3 dolje).
- [ ] `WITHDRAWAL_FROM_EMAIL` — verificirana `@katedra.hr` adresa u Resend
  dashboardu. Bez ovoga kod pada natrag na Resendov test domain
  (`onboarding@resend.dev`), koji **ne smije ići u produkciju**.
- [ ] Supabase env varijable (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — nedostaju u
  lokalnom `.env.local` koji sam imao dostupan; ako nedostaju i u produkcijskom
  deployu, ništa auth-gated ne radi.
- [ ] Stripe test-mode ključevi za stvarni end-to-end test checkouta prije
  produkcijskih ključeva.

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

- [ ] **PR6 — marketing landing stranica.** `/` i dalje odmah renderira
  onboarding wizard umjesto explainer stranice za hladne posjetitelje. Status
  nije ponovno provjeren otkad je zadnji veliki merge sletio — provjeri
  prije nego pretpostaviš da je i dalje otvoreno.
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
