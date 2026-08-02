# VIZIJA — Katedra × Lekta (charter v1)

> Izvor: 100/100 odgovora osnivača, 2. 8. 2026. Ovo je filter za svaku buduću ideju:
> **ako nije u skladu s ovim dokumentom, ne gradi se** — ili se prvo mijenja charter, svjesno.

## Jedna rečenica

**Katedra je mentor koji te vodi od teme do obrane — a Lekta dokaz da je dokument
spreman za predaju.** (Ušteda vremena, sigurnosna mreža i „AI legalno" su benefiti
u copyju — identitet je mentor + ekosustav.)

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

- **Seminarski Pass ~€29 · Završni Pass ~€79 · Diplomski Pass ~€129** (A/B test nakon prvih 20 kupaca; donja granica: nikad ispod 19/49/99).
- **Pass Plus = Pass + AutoFix (+€20).** AutoFix zasebno ~€19 za check-only korisnike.
- **Free tier: Plan i program potpuno besplatan** + demo pisanja do **1.500 riječi** (okus, ne obrok).
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

## Dodatak: konkurencija (prvi scan, produbiti u tjednu 1)

- **Globalni AI academic-writing alati** (Jenni, Thesify, Paperpal, ThesisAI, Paperguide…):
  engleski fokus, generička akademija — **nitko nema hrvatska fakultetska pravila,
  deterministički .docx check, obranu, ni AI ledger.** Naša obrana: lokalizacija + loop + dokaz procesa.
- **Domaće sivo tržište pisanja radova**: cjenovno sidro i izvor kupaca; ne konkuriramo cijenom nego legalnošću i kvalitetom.
- Akcija: puni battlecard (tjedan 1) — značajke, cijene, pozicioniranje, poruke.

*Charter v1 · 2. kolovoza 2026. · mijenja se samo svjesnom odlukom osnivača, ne usput.*
