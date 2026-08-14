# Katedra staging money-flow runbook

Deploy redoslijed za agenticni dispatcher nalazi se u
[AGENTIC_STAGING_DEPLOY.md](./AGENTIC_STAGING_DEPLOY.md).

Ovaj runbook je obavezan dokaz prije paid beta lansiranja. Lokalni testovi i
guest browser E2E ne zamjenjuju ovaj tok. Koristi zaseban staging Supabase,
Stripe test-mode, Anthropic test ključ i Resend staging sender. Nikada ne
koristi stvarni studentski rad ili production credentials.

## Preduvjeti

Staging deployment mora imati:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` i
  `SUPABASE_SERVICE_ROLE_KEY` iz istog Lekta Supabase projekta;
- `ANTHROPIC_API_KEY`, Stripe test-mode secret i webhook secret;
- `RESEND_API_KEY` i verified staging sender;
- `NEXT_PUBLIC_APP_URL` koji pokazuje točno na staging origin;
- `KATEDRA_BILLING_RPC_CONTRACT=v2`;
- `KATEDRA_RATE_LIMIT_STORE=supabase`;
- deployane Lekta funkcije `katedra_consume`,
  `katedra_reserve_request`, `katedra_release_request` i
  `katedra_authorize_project_ai`;
- deployane `katedra_reserve_withdrawal` i
  `katedra_release_withdrawal` i `katedra_commit_withdrawal` prema
  [withdrawal reservation contractu](../architecture/KATEDRA_WITHDRAWAL_RESERVATION_CONTRACT.md).
- za agenticni worker: `KATEDRA_WORKER_APP_URL`,
  `KATEDRA_AGENT_WORKER_TOKEN` i `KATEDRA_AGENT_WORKER_CRON_SECRET`;
  tokeni moraju biti jednaki odgovarajućim staging secretima i nikad se ne
  ispisuju u log.
- `KATEDRA_AGENT_MODEL` mora biti eksplicitno odobreni model koji staging
  provider podržava; ne oslanjaj se na aplikacijski fallback.

Pokreni preflight u deployment okruženju:

```powershell
npm.cmd run preflight:production
```

Za agenticni release gate dodatno pokreni:

```powershell
npm.cmd run preflight:agentic
```

Preflight mora proći bez ispisivanja vrijednosti tajni.

## Osnovni tok

1. Kreiraj dedicated test account i prijavi se.
2. Kreiraj projekt s canonical UUID-em i provjeri da se isti project ID vidi u
   Katedri i Lekti.
3. Otvori checkout za odgovarajući tip rada.
4. Dovrši Stripe test checkout i provjeri da success redirect ne predstavlja
   entitlement; entitlement smije nastati tek nakon webhooka.
5. Pošalji isti `checkout.session.completed` webhook ponovno.
6. Provjeri jedan entitlement za projekt i jedan wallet grant za Stripe session.
7. Pokreni chat i potvrdi da stream vraća `x-katedra-request-id`.
8. Provjeri da `katedra_consume` prima canonical project ID, request ID i
   observed input/output usage.
9. Ponovi isti billing settlement s istim request ID-em i provjeri
   `already_settled` bez drugog debita.
10. Reloadaj `/pisi`, provjeri lokalni rukopis i otvori Lekta handoff s istim
    project ID-em.
11. Pošalji withdrawal test zahtjev i potvrdi verified sender te `requested_at`.
12. Ponovi withdrawal s istim reference ID-em i provjeri da durable contract
    vraća duplicate bez drugog zahtjeva.

Očekivani billing trag za jedan AI pokušaj je točno jedan od:

- `settled`;
- `already_settled`;
- `released`;
- `pending_reconciliation` s operativnim retry/reconciliation tragom.

Ne prihvaćaj “uspješan odgovor bez billing traga”.

## Obavezni failure matrix

| Scenarij | Očekivanje |
|---|---|
| duplicirani webhook | bez drugog entitlementa ili wallet debita |
| dvije checkout sesije za isti projekt | Lekta atomic ugovor odlučuje; drugi grant mora biti odbijen, automatski refundiran idempotentnim Stripe refundom i označen za reconciliation ako refund ne uspije |
| refresh/zatvoren browser u checkoutu | webhook i entitlement ostaju jedini source of truth |
| istekao Pass | project access nije dopušten |
| prazan wallet | HTTP 402 prije Anthropic poziva |
| tuđi project ID | HTTP 404, bez walleta/provider poziva |
| blokirana AI policy | HTTP 403 i nema generiranja zabranjenog tipa |
| deveti paralelni zahtjev | atomic rate limit vraća HTTP 429 |
| treći aktivni stream | HTTP 429 |
| prekinuti stream | reservation se oslobađa; billing ostaje točno jednom reconciliation ishodu |
| Anthropic 500/429 | kontrolirani HTTP/provider error, bez lažnog uspješnog billing traga |
| Supabase timeout tijekom consume | `pending_reconciliation`, bez slijepog ponovnog debita |
| malformed/prevelik DOCX | odbijanje prije Mammoth extraction |
| dva taba s istim računom | limit se primjenjuje preko oba taba i svih instanci |

## Verifikacija privatnosti

Nakon testa provjeri shared state zapise. Ne smiju sadržavati:

- tekst rukopisa;
- sirovi `.docx` ili base64 prilog;
- AI prompt/response tekst;
- slobodne mentorove komentare.

IndexedDB rukopis ostaje local-only u ovoj verziji. Export JSON backup prije
brisanja testnog profila.

## Dokaz i čišćenje

Zabilježi datum, staging URL, pseudonim testnog accounta, Stripe test session
ID, project ID, request ID-eve i rezultat svakog scenarija. Ne zabilježiti
passworde, tokene, API ključeve ili sadržaj studentskog rada.

Nakon testa:

- refundiraj ili poništi Stripe test session prema staging proceduri;
- ukloni testni account, projekte, entitlement/wallet testne retke i
  reconciliation ostatke;
- provjeri da nema aktivnih reservationa;
- spremi rezultat u release checklist i označi neuspjele scenarije kao release
  blockere.

## Release gate

Paid beta nije odobrena dok ovaj tok i cijeli failure matrix nisu izvedeni u
stagingu s dokazom iz Supabase, Stripea i server logova. Ako Lekta RPC ugovor
nije dostupan ili je rezultat ambiguous, Katedra mora ostati fail-closed.

Automatizirani authenticated browser gate pokreće se ručno iz GitHub Actionsa
nakon što su postavljeni `KATEDRA_INTEGRATION_URL`,
`KATEDRA_AUTH_E2E_EMAIL` i `KATEDRA_AUTH_E2E_PASSWORD`. Skripta
`scripts/authenticated-money-flow-e2e.mjs` provjerava prijavu, projekt,
lokalni rukopis, AI prijedlog, `x-request-id` i opcionalni Stripe checkout
ulaz. Webhook, settlement i failure matrix i dalje se moraju potvrditi u
staging logovima i Supabaseu; browser prolaz sam po sebi nije dokaz RPC
idempotencije.

Agenticni browser gate pokreće se nakon potvrđenog Passa:

```powershell
npm.cmd run test:e2e:agentic
```

Na GitHubu je isti test ukljuÄŤen u manualni `Academic Suite browser E2E`
workflow i izvrĹˇava se nakon authenticated money-flow gatea. Ako staging
provider ili worker nije konfiguriran, rezultat ostaje release blocker.

`scripts/agentic-workflow-e2e.mjs` provjerava da se run kreira s lokalnim
snapshotom rukopisa i da agenticni tijek dođe do verificiranog terminalnog
stanja. Ako staging provider ili worker nije konfiguriran, test mora ostati
release blocker; ne označava se kao prolazan samo zato što je UI otvoren.
UI release gate za hibridni `/pisi` workspace pokreće se zasebno:

```powershell
npm.cmd run test:e2e:agentic-ui
```

Provjerava prijavu, ulaz u `Agenti`, fazni label, horizontalni overflow na
390/768/1440 px i dark/light temu. Sam UI smoke test ne dokazuje worker,
verifier, billing ili Lekta tok.
