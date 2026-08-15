# Agenticni staging deploy

Ovaj postupak služi samo za zasebni staging. Ne koristiti production
Supabase projekt, production Stripe podatke ili stvarne studentske radove.

## 1. Lekta Edge Function

U Lekta repozitoriju, nakon što je staging Supabase spreman, deployaj funkciju
iz `supabase/functions/katedra-agent-worker/index.ts`:

```powershell
supabase functions deploy katedra-agent-worker `
  --project-ref bnyemcnsphlitjradrst `
  --no-verify-jwt
```

Funkcija ima vlastitu constant-time provjeru
`x-katedra-agent-worker-token`, zato se Supabase JWT provjera ne koristi kao
zamjena za worker token.

## 2. Secrets za Edge Function

Postavi ih u staging Secret Storeu, nikad u Git ili browser:

```text
KATEDRA_WORKER_APP_URL=https://<staging-katedra-origin>
KATEDRA_AGENT_WORKER_TOKEN=<random-long-secret>
KATEDRA_AGENT_WORKER_CRON_SECRET=<random-long-secret>
```

Edge Function mora imati i standardne Supabase varijable
`SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY`. Worker token mora biti potpuno
isti u Edge Functionu i Katedrinoj server-side konfiguraciji. Cron secret se
koristi samo za poziv Edge Functiona.

## 3. Katedra staging environment

U server-side deployment environment postavi:

```text
KATEDRA_PROJECT_LOCKS_ENABLED=true
KATEDRA_AGENT_RUNS_ENABLED=true
KATEDRA_MATERIALS_ENABLED=true
KATEDRA_AGENT_WORKER_TOKEN=<isti-worker-secret>
KATEDRA_AGENT_MODEL=<odobreni-model-koji-provider-podrzava>
KATEDRA_BILLING_RPC_CONTRACT=v2
KATEDRA_RATE_LIMIT_STORE=supabase
```

`KATEDRA_MATERIAL_DELETE_RPC_CONTRACT` se namjerno ne postavlja u ovoj fazi.
Postavlja se tek nakon što Lekta deploya i staging-testira canonical
deletion-tombstone RPC; bez njega `DELETE /api/materials/:materialId` mora
ostati na kontroliranom `503`.

Uz to moraju postojati postojeći Supabase, Anthropic, Stripe, Resend i app
URL secrets iz [staging money-flow runbooka](./STAGING_MONEY_FLOW.md).

Prije deploya pokreni:

```powershell
npm.cmd run preflight:production
npm.cmd run preflight:agentic
```

Oba preflighta moraju proći u deployment environmentu. Vrijednosti tajni se
ne ispisuju.

## 4. GitHub manualni release gate

Postavi sljedeće GitHub Actions secrets:

- `KATEDRA_INTEGRATION_URL`
- `KATEDRA_AUTH_E2E_EMAIL`
- `KATEDRA_AUTH_E2E_PASSWORD`
- `KATEDRA_AGENT_WORKER_TOKEN`
- `KATEDRA_AGENT_WORKER_CRON_SECRET`

Postavi repository variable:

- `KATEDRA_AGENT_MODEL`
- `KATEDRA_AGENT_RUNS_ENABLED=true`
- `KATEDRA_PROJECT_LOCKS_ENABLED=true`

Zatim ručno pokreni workflow `Academic Suite browser E2E`. On mora proći
sljedećim redom:

1. guest/browser smoke test;
2. authenticated money-flow;
3. agentic staging preflight;
4. agenticni run do verificiranog terminalnog stanja.

Ako dispatcher nije deployan, worker token nije jednak na obje strane ili
provider nije konfiguriran, workflow mora ostati neuspješan.

## 5. Read-only provjera nakon deploya

Provjeri da staging funkcije uključuju `katedra-agent-worker`, zatim pokreni
agenticni browser gate:

```powershell
npm.cmd run test:e2e:agentic
```

Nakon testa provjeri da shared state ne sadrži tekst rukopisa, raw upload,
prompt ili AI odgovor. Privremeni payloadi moraju imati TTL, a lokalni
rukopis mora ostati u IndexedDB-u.

Production ostaje isključen dok cijeli tok checkout → webhook → entitlement →
worker → provider → verifier → billing → DOCX/Lekta handoff ne prođe na
stagingu.
Za vizualni i accessibility gate pokreni i:

```powershell
npm.cmd run test:e2e:agentic-ui
```

Gate provjerava hibridni `/pisi` workspace na mobilnoj, tablet i desktop
širini, dark/light temu i fazni status. Ne zamjenjuje authenticated
worker/verifier test.
