# Agent worker staging runbook

Ovaj runbook vrijedi samo za staging. Production flagovi ostaju isključeni
dok cijeli tok nije dokazan na izoliranom projektu i testnim podacima.

## Vlasništvo tajni

- `KATEDRA_AGENT_WORKER_CRON_SECRET` postoji samo u scheduler/Supabase secret
  storeu i koristi se za pozivanje Lekta Edge Functiona.
- `KATEDRA_AGENT_WORKER_TOKEN` postoji u Lekta Edge Functionu i u server-side
  Katedrinoj konfiguraciji. Njime se autentificira callback prema Katedri.
- `SUPABASE_SERVICE_ROLE_KEY` ostaje samo u Lekta Edge Function okruženju; ne šalje service-role ključ Katedri niti browseru.
- `KATEDRA_AGENT_MODEL`, billing contract i rate-limit store su server-side
  konfiguracija. Nijedna od tih vrijednosti ne smije biti `NEXT_PUBLIC_*`.

## Redoslijed deploya

1. U staging Lekta projektu primijeni i read-only provjeri migracije `0077` do
   `0085`. Provjeri tablice, RPC potpise, RLS, lease, payload namespace i
   tombstone cleanup prema [agentic contract preflightu](./AGENTIC_CONTRACT_PREFLIGHT.md).
2. Deployaj Edge Function `katedra-agent-worker` s `--no-verify-jwt`:

   ```powershell
   supabase functions deploy katedra-agent-worker `
     --project-ref <staging-project-ref> `
     --no-verify-jwt
   ```

   JWT provjera nije zamjena za `KATEDRA_AGENT_WORKER_CRON_SECRET` niti za
   `KATEDRA_AGENT_WORKER_TOKEN`.
3. Postavi cron secret u Supabase secret store, a worker token u Lekta i
   Katedrin server-side environment. Nikad ih ne zapisuj u repo, log ili
   client bundle.
4. Scheduler pokreni svakih jednu minutu. Svaki tick poziva
   `katedra-agent-worker`; Edge Function bira samo najstarije pending/running
   runove, dispatcha ih sekvencijalno i vraća `502` ako callback ne uspije.
5. Pokreni read-only provjere schema/RPC/storage ugovora. Ako nedostaje ijedan
   ugovor, flagovi ostaju `false`.
6. Prođi staging tok: checkout → webhook → project lock → run context → worker
   → verifier → billing reconciliation → DOCX/Lekta handoff.
7. Nakon testa pregledaj `cron.job_run_details`, worker request ID-jeve,
   `pending_reconciliation` zapise i TTL cleanup. Ne prihvaćaj rezultat bez
   verified koraka i billing ishoda.
8. Tek nakon uspješnog dokaza uključi:

   ```env
   KATEDRA_PROJECT_LOCKS_ENABLED=true
   KATEDRA_AGENT_RUNS_ENABLED=true
   ```

   `KATEDRA_MATERIALS_ENABLED=true` uključuje se tek nakon provjere deletion
   RPC-a i privatnog storage policyja.

## Read-only release checks

Provjeri da postoji funkcija `katedra-agent-worker`, da cron pozivi ne šalju
service-role ključ Katedri, da su `claim_agent_step` i
`complete_agent_step` worker-only RPC-i te da su svi temporary payloadi vezani
uz user/project/run namespace i TTL. Provjeri i da duplicate callback ne
stvara drugi completion ili drugi billing attempt.

Lokalno, bez canonical Lekta ugovora i potrebnih environment varijabli,
`/api/internal/agent-worker` mora ostati na kontroliranom `503`. To nije
greška lokalnog razvoja i ne smije se zaobilaziti ručnim service-role pozivom.

## Rollback

Ako bilo koja provjera padne, prvo postavi oba feature flaga na `false`,
zaustavi scheduler tick i sačuvaj request ID/reconciliation tragove. Ne briši
run state niti rukopis kao dio rollbacka. Nakon toga popravi canonical Lekta
ugovor ili konfiguraciju, ponovi read-only provjere i tek onda ponovno pokreni
staging test. Production se ne uključuje samo zato što je worker endpoint
vratio HTTP 200; mora postojati verificirani terminalni run.
