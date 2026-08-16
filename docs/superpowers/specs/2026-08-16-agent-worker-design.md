# Agent worker sustav Katedre

## Cilj

Omogućiti da agenticni run nastavi raditi nakon zatvaranja browsera, uz strogu
kontrolu vlasništva, zaključanog projekta, leasea, billing ishoda i najviše tri
pokušaja po koraku.

Worker nije novi korisnički editor i ne mijenja lokalni rukopis bez postojećeg
run/quality-gate toka. U prvoj produkcijskoj verziji izvršava jedan sekvencijalni
agent step po HTTP pozivu.

## Odabrana arhitektura

Koristi se split model:

```text
Supabase/Lekta cron
  -> Lekta Edge Function: katedra-agent-worker
  -> privatni Katedra POST /api/internal/agent-worker
  -> claim_agent_step
  -> provider + billing reservation
  -> verifier
  -> private result payload
  -> complete_agent_step
```

Lekta je scheduler i canonical owner shared run statea. Katedra je izvršitelj
AI koraka jer već posjeduje provider router, kontekst rukopisa, billing adapter
i verifikatore. Service-role ključ nikad ne napušta Lekta Edge Function.

Alternativa s cijelim izvršavanjem u Lekti nije odabrana jer bi duplicirala
Katedrin provider/context sloj i povećala broj mjesta na kojima bi se morali
štititi AI i billing ključevi. Vanjski queue servis nije potreban dok jedan
worker korak traje unutar serverless timeouta i Supabase leasea.

## Invarijante

- `KATEDRA_AGENT_RUNS_ENABLED` i `KATEDRA_PROJECT_LOCKS_ENABLED` moraju biti
  `true` prije obrade bilo kojeg koraka.
- Worker prihvaća samo konfigurirani `KATEDRA_AGENT_WORKER_TOKEN` i nikad ne
  koristi korisnički session token kao worker autorizaciju.
- Lekta dispatcher prihvaća samo zaseban
  `KATEDRA_AGENT_WORKER_CRON_SECRET` kroz `Authorization: Bearer`.
- `claim_agent_step` je jedini način preuzimanja koraka.
- Jedan korak ima samo jedan aktivni lease; istekli lease može preuzeti drugi
  worker.
- Provider poziv, verifikacija i spremanje rezultata završavaju prije
  `complete_agent_step`.
- Pokušaji su ograničeni na `1`, `2` i `3`; treći neuspjeh prelazi u
  `blocked` kada je rezultat potrebno popraviti.
- Billing ishod je uvijek `settled`, `released` ili
  `pending_reconciliation`. Nepoznat billing ishod se ne retrya slijepo.
- Rezultat se sprema kao privatni payload i u run state ulazi samo manifest
  pointer/verifikacijski sažetak.
- Worker ne zapisuje prompt, rukopis, upload ili puni AI odgovor u logove.
- Terminalni runovi (`completed`, `blocked`, `failed`, `cancelled`) ne dobivaju
  nove pokušaje.

## Komponenta 1: Lekta dispatcher

Datoteka: `Lekta/supabase/functions/katedra-agent-worker/index.ts`.

Edge Function radi sljedeće:

1. provjerava cron secret constant-time metodom;
2. fail-closed odbija poziv bez staging URL-a ili worker tokena;
3. dohvaća ograničeni batch najstarijih `pending` i `running` runova;
4. poziva Katedrin privatni endpoint s `runId` i worker tokenom;
5. pozivi su sekvencijalni, s početnim batchom od 4 i apsolutnim batch limitom
   10;
6. koristi callback timeout od 180 sekundi i bilježi samo `runId` i HTTP status;
7. vraća `502` ako je barem jedan callback transportno neuspješan, kako bi
   cron ponovio tick;
8. vraća uspješan odgovor kada su callbacki prihvaćeni, čak i kada je pojedini
   run prešao u `retrying`, `blocked` ili `failed` stanje.

Dispatcher ne označava run dovršenim i ne pokušava sam izvršavati AI logiku.
Ponovljeni dispatch istog runa mora biti siguran jer DB claim odlučuje koji
worker stvarno dobiva korak.

## Komponenta 2: Katedra izvršitelj

Datoteka: `app/api/internal/agent-worker/route.js`.

Endpoint:

- provjerava feature flagove, worker token, Anthropic konfiguraciju i canonical
  billing/rate-limit konfiguraciju;
- učitava samo `run_id`, `user_id`, `project_id`, `source_policy` i `status`;
- terminalni run vraća idempotentni no-op;
- stvara provider executor sa server-side provider routingom;
- izvršava najviše jedan korak po pozivu;
- sprema rezultat prije completion RPC-a;
- ne vraća akademski tekst u dispatcher odgovor;
- vraća status i broj obrađenih koraka bez osjetljivog payload-a.

Provider timeout je 150 sekundi, callback timeout 180 sekundi, a canonical
lease ostaje pet minuta. Transportni timeout ili prekid procesa ostavlja lease
da istekne; sljedeći dispatcher tick tada može sigurno pokušati korak ponovno.
Completion nakon isteka leasea mora biti odbijen kao stale, bez prepisivanja
rezultata drugog workera.

## Statusi i retry

| Situacija | DB rezultat | Sljedeća akcija |
|---|---|---|
| verificiran rezultat | `verified` | idući korak ili `completed` |
| popravljiv provider/verifier neuspjeh, pokušaj 1 ili 2 | `failed` + `p_requeue=true` | sljedeći cron tick |
| treći popravljivi neuspjeh | `blocked` | korisnik dobiva razlog i akciju |
| trajna konfiguracijska/provider capability greška | `blocked` ili `failed` | nema slijepog retrya |
| settled billing, ali payload spremanje ne uspije | `failed` uz `settled` | operativna reconciliacija, bez ponovne naplate |
| nepoznata billing finalizacija | `failed` uz `pending_reconciliation` | reconciliacija prije novog pokušaja |
| pause/cancel tijekom obrade | backend kontrolni status | nema novih claimova |

Retry ne smije stvarati novi billing request ID za isti pokušaj. Novi pokušaj
koristi novi attempt identitet, ali ponavljanje istog HTTP poziva mora ostati
idempotentno na completion/billing sloju.

## Observability i operativna sigurnost

Svaki dispatcher callback i Katedra worker poziv ima `requestId`. Strukturirani
log smije sadržavati samo:

- `requestId`, `runId`, `stepId` ako postoji;
- worker ID;
- agent/verifier ID;
- attempt;
- provider/model ID;
- latency i HTTP/RPC status;
- billing state;
- terminalni razlog ili kod greške.

Ne logiraju se `messages`, `output`, `extractedText`, source passages, tokeni,
session cookieji ni worker tokeni. Metrike za alarmiranje su callback 5xx,
lease expiry, `pending_reconciliation`, blocked rate, provider 429/5xx i
neuspjeli completion RPC.

## Testni ugovor

### Unit i contract testovi

- cron secret: bez tajne, pogrešna tajna i ispravna tajna;
- dispatcher bira samo `pending/running` i poštuje batch limit;
- dispatcher nikad ne šalje service-role header Katedri;
- callback timeout i 5xx vraćaju retryable dispatcher rezultat;
- terminalni run se ne dispatcha ponovno;
- Katedra endpoint je zatvoren bez flagova, tokena ili billing ugovora;
- worker claim/complete redoslijed ostaje točan;
- dva callbacka za isti run ne mogu dobiti isti korak;
- istekli lease može preuzeti sljedeći worker;
- stale completion ne mijenja korak drugog workera;
- retry se zaustavlja nakon trećeg pokušaja;
- pause/cancel ne dobiva nove korake;
- settled i pending reconciliation stanje ostaju zapisani ako spremanje
  rezultata padne;
- log payload ne sadrži rukopis ili AI tekst.

### Staging browser E2E

1. pokrenuti plaćeni zaključani projekt;
2. dodati materijale i run context;
3. aktivirati run;
4. zatvoriti browser;
5. cron dispatcher nastavlja run do terminalnog checkpointa;
6. simulirati provider 429/500 i provjeriti najviše tri pokušaja;
7. pauzirati i nastaviti run;
8. pokrenuti dva dispatcher ticka istodobno;
9. provjeriti billing reconciliation i privatni payload TTL;
10. potvrditi da lokalni rukopis nije spremljen u shared state.

## Deployment gate

Prije uključivanja flagova moraju biti deployane i staging-testirane Lekta
migracije, uključujući `0085_guard_locked_project_mutations.sql`, canonical
RPC-i i `katedra-agent-worker` Edge Function. Obavezne varijable su:

```text
KATEDRA_WORKER_APP_URL
KATEDRA_AGENT_WORKER_TOKEN
KATEDRA_AGENT_WORKER_CRON_SECRET
KATEDRA_AGENT_MODEL
KATEDRA_AGENT_RUNS_ENABLED=true
KATEDRA_PROJECT_LOCKS_ENABLED=true
KATEDRA_BILLING_RPC_CONTRACT=v2
KATEDRA_RATE_LIMIT_STORE=supabase
```

Ako bilo koja vrijednost nedostaje ili je legacy, preflight mora pasti, a
Katedra endpoint mora ostati na `503`. Production se ne smatra spremnim dok
ne prođe authenticated checkout → webhook → lock → worker → verifier →
billing → DOCX/Lekta handoff.

Worker se okida najmanje jednom u minuti kroz Supabase `pg_cron` ili ekvivalentni
staging scheduler. Scheduler poziva Edge Function s
`Authorization: Bearer <KATEDRA_AGENT_WORKER_CRON_SECRET>` iz secret storea.
Secret se ne zapisuje u migraciju, Git ili browser. Nakon deploya mora postojati
read-only provjera rasporeda i barem jedan uspješan `cron.job_run_details`
zapis prije uključivanja feature flagova.

## Izvan opsega prve verzije

- Redis/Cloud Tasks ili drugi novi queue servis;
- paralelna obrada poglavlja;
- worker koji sam mijenja lokalni rukopis bez postojećeg odobrenja/autonomous
  ugovora;
- cross-device sinkronizacija punog rukopisa;
- automatsko zaobilaženje source gatea, AI policyja ili Lekta provjere.
