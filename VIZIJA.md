# VIZIJA — Katedra × Lekta (charter v1)

> Izvor: 100/100 odgovora osnivača, 2. 8. 2026. Ovo je filter za svaku buduću ideju:
> **ako nije u skladu s ovim dokumentom, ne gradi se** — ili se prvo mijenja charter, svjesno.

## Jedna rečenica

**Katedra je mentor koji te vodi od teme do obrane — a Lekta dokaz da je dokument
spreman za predaju.** (Ušteda vremena i sigurnosna mreža su benefiti u copyju —
identitet je mentor + ekosustav. NE „AI legalno": AI politika nije binarna
[legalno/ilegalno] nego institucija/program/kolegij-specifična — obećavamo da
pokazujemo aktualno objavljeno pravilo tvog fakulteta i njegov izvor, ne pravnu
ocjenu.)

## North star i 90 dana

- North star metrika: **broj DOVRŠENIH radova kroz cijeli loop** („Napiši → Provjeri → Predaj").
- Sljedećih 90 dana samo jedno: **prvi plaćeni korisnik.**
- Okidač skaliranja (novac/ljudi): **1.000 kupaca.** Cilj 12 mj: 10k registriranih → 1.000 kupaca → €5k+/mj.

## Identitet i brend

- Dvije aplikacije, obitelj brendova, **jedan račun tek u V3**. Poseban brend od maturiraj.hr
  (tamo samo reklama — srednja škola ≠ fakultet).
- Brend je pola proizvoda: paper/ink sustav; **Katedra toplija, Lekta tehničkija**.
- Domena: **katedra.hr** (kupiti odmah). Loop se javno zove **„Napiši → Provjeri → Predaj"**.
- Hero proizvod: ovisi o kanalu — Lekta za „imam rad, je li spreman?", Katedra za „počinjem".

## Korisnik

- Široko (sve razine, svi studiji) — **ali tvrda ograda: nudimo samo fakultete s Lekta
  `verified` pravilima.** To je mehanizam fokusa umjesto biranja persone.
- Geografija: HR 12 mj → regija → EN (brzo, ali tim redom). Jezik radova v1: hrvatski.
- Desktop-first (radovi se pišu na laptopu); mobitel = coach i podsjetnici kasnije.
- Sezonalnost je prihvaćena: **naplata po radu, ne pretplata.** Churn nakon predaje = OK.
- Mentori i profesori: publika kojoj se aktivno predstavljamo (smjernice, statistika).

## Scope v1 (SaaS, cilj: live za 2–3 tjedna)

Chat + krediti + Lekta loop (minimum iz MASTER-PLAN Milestone 1) + svih 6 modova kao
prompt-modovi (jeftin port) + podsjetnici na rok (retention) + povijest verzija radova
(priča o autorstvu) + AI ledger (core differentiator — produbiti odmah nakon M1 kroz Fazu H).

## Scope OUT (s razlogom — ovo je anti-širenje lista)

| Što | Status | Zašto |
|---|---|---|
| Detekcija plagijata | **nikad** | nije naš posao |
| Vlastita gramatika | **nikad** | Lekta (forma) + LLM (jezik) |
| „Rad jednim klikom" bez procesa | **nikad** | ustav §7 + jedina obranjiva pozicija |
| Bahat ton prema korisniku | **nikad** | osnivačeva lista |
| Matura/prijemni sadržaj | **nikad ovdje** | to je maturiraj.hr |
| Citation manager | lite u sklopu literature | ne gradimo Zotero |
| LMS/tečajevi | ne; kratki vodiči = content marketing | |
| Zajednica u aplikaciji | **V3+, nakon 1.000 kupaca** | osnivač je želi; ne stane u 3 tjedna |
| Dijeljenje s mentorom | V2 | |
| Više projekata | V2 (jedan aktivan u v1) | |
| Literatura (Crossref/HRČAK) | nakon prve naplate; **Lekta provjerava, Katedra prikazuje** | ustav §4 |
| B2B Campus | ništa dok B2C ne radi | |
| Konkurenti scan | tjedan 1 (v. dodatak) | |

## Lekta integracija — zaključani principi

1. Jedna kupnja pokriva obje: **Pass = Katedra + Lekta za taj rad.**
2. Ulazna točka novog korisnika: **Lekta free check → nalazi bole → Katedra.** Lekta Check besplatan zauvijek.
3. **.docx ostaje lokalan u automatskim provjerama — zauvijek (brend obećanje).**
   Iznimka: **AutoFix na serveru isključivo uz izričitu privolu i jasnu komunikaciju** (ustav §6, v1.1).
4. Objašnjenja nalaza: **Lekta „ŠTO je pravilo", Katedra „KAKO za tvoj rad" (AI).**
5. AutoFix: zasebna jednokratna kupnja + uključen u Pass Plus; obje ga aplikacije guraju.
6. Pack refresh automatski uz svaki Lekta release (CI drift test). Nove fakultete bira **potražnja** (mjerimo odabire unita).
7. aiPolicy (FOI 0–4, FPZG izjava) odmah nakon Milestone 1 (Faza H).
8. Handoff URL-om dok nema računa; backend sync uz SSO u V3; URL ostaje fallback.
9. Rizik #1 = kompleksnost dva alata → lijek: handoff bez copy-pastea, jedna kupnja, kasnije jedan račun.

## Monetizacija — premium pozicioniranje

Sidro nije SaaS pretplata nego **sivo tržište pisanja radova** (seminarski ~€50,
završni ~€150, diplomski €200–300+). Mi smo **legalna, transparentna i bolja** alternativa —
cijena mora signalizirati vrijednost, ne jeftinoću (odluka osnivača).

- **Seminarski Pass ~€29 · Završni Pass ~€79 · Diplomski Pass ~€129** (donja granica: nikad ispod
  19/49/99). Prvih 20 kupaca = **price discovery cohort**, ne pravi A/B test (bilježi
  abandonment/prigovore/cjenovne usporedbe umjesto samo konverzije) — pravi A/B tek uz dovoljno
  prometa (Audit 4).
- **Pass = pravo pristupa Katedri i Lekti za taj konkretan rad**, vezano uz `academic_project_id`
  (Audit 4). Pass Plus/AutoFix **nije launch SKU** — tip ostaje modeliran
  (`academic-pass-plus`/`lekta.fix` u `lib/academic-suite/contracts.ts`), ali se ne prodaje na
  checkoutu dok postoji contextualni upsell nakon Lekta checka i privacy/legal review AutoFixa
  (v1.1).
- **Free tier: Completion Scan/Plan potpuno besplatan** (deterministički, bez AI troška) + Lekta
  Check besplatan zauvijek + jedna kontekstualna Katedra AI intervencija po projektu (Audit 4 —
  zamjenjuje raniju "demo pisanja do 1.500 riječi" poziciju, koja demonstrira commodity AI writing,
  ne Katedrin proces/intelligence layer).
- Krediti prikazani **apstraktno** („AI zadaci"), tvrdo pravilo: **AI nikad „neograničeno"**;
  Lekta re-checkovi u Passu slobodno neograničeni (deterministički, lokalni — nula troška).
- Stripe (kartice + Apple/Google Pay). Povrat samo kod tehničkog problema. **Naplata od prvog dana rada SaaS-a.**

## Ekonomika modela (korekcija odluke #83)

„Uvijek najjeftiniji model" **direktno ruši strah #88** („rad mora biti točan i savršen svaki put").
Pravilo umjesto toga: **najjeftiniji model koji prolazi prag kvalitete po zadatku** —
coach/objašnjenja na jeftinom modelu, poglavlja na top modelu dok benchmark na hrvatskim
akademskim tekstovima ne dokaže drugačije. Multi-provider abstrakcija u proxyju: da. Slijepo rezanje troška: ne.

## Etika i pozicioniranje

- Javna poruka (prerađeno iz odgovora #71 — original je PR rizik, v. napomenu u chatu):
  **„Većina studenata već koristi AI. Katedra je način da to radiš dobro — s procesom,
  tvojim odlukama i dokazom autorstva."**
- Ledger se uvijek vodi; student bira hoće li izjavu priložiti. Process-only mod za fakultete
  koji brane AI. TOS 18+. Anonimna statistika za marketing uz jasnu politiku privatnosti.
- **PR paket unaprijed** (odgovor na „essay mill" prozivku) — deliverable prije launcha.
- Content o AI pravilima faksova (blog/TikTok) = SEO i awareness motor.

## Rast

Kanali: FB/WhatsApp grupe godišta (primarni) + TikTok + Reddit + IG. Partner #1: **kopirnice**
(uvez radova). Oba sezonska peaka, različite poruke (rujan: teme/plan; ožujak–lipanj: predaja/provjera).
€0 oglasa do trakcije; referral kasnije; PR s brojkama; build-in-public možda.

## Ti

Full-time; budžet €500–1.500 / 6 mj; solo + Claude Code. Podrška: IG/WhatsApp DM prvo.
Analitika: vlastiti eventi u Supabase. Statični HTML ostaje (offline/PWA + demo).
**Stop-loss:** nema profitabilnosti/korisnika, zabrana od fakulteta ili nestanak radova kao forme.

## Dodatak: konkurencija (Audit 2, 3. 8. 2026. — nadomješta prvi scan)

- **Svaki pojedinačni dio već postoji kod nekog konkurenta**: Claude/ChatGPT (Projects,
  file upload, DOCX), Jenni/Paperpal (writing + citations na ogromnoj skali), Thesify
  (AI+Human provenance), ThesisAI (pay-per-thesis) — a **Skrivora** posebno upozorava:
  gotovo identičan "thesis completion" UX koncept, lokaliziran za drugo tržište.
  Trenutačni moat: **2/5**.
- **Moat zato nije popis featurea nego akumulirani sustav**: verificirani Academic
  Rules Graph (pravila fakulteta, s izvorom i datumom provjere) → deterministički
  Lekta checkovi mapirani na ta pravila → project state koji zna institucionalni
  kontekst → mentor feedback loop → completion podaci koji rastu sa svakim dovršenim
  radom → lokalni trust/distribution. Svaki sloj konkurent mora zasebno kopirati.
  Potencijalni moat uz svjesnu izgradnju: **4/5**.
- **AI ledger je dio sustava, ne headline moat** — Thesify već ima provenance; ledger
  postaje jak tek vezan uz strukturiran AI-policy podatak po instituciji.
- **Domaće sivo tržište pisanja radova**: cjenovno sidro i izvor kupaca; ne
  konkuriramo cijenom nego legalnošću, kvalitetom i dokazom procesa.
- Detalji: Audit 2 (market/positioning/moat), 3. 8. 2026.

*Charter v1 · 2. kolovoza 2026. · mijenja se samo svjesnom odlukom osnivača, ne usput.*
