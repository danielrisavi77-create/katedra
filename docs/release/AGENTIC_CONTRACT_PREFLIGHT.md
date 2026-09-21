# Agentic contract preflight

Katedra endpointi moraju ostati iza feature flagova dok canonical Lekta ugovor nije deployan i provjeren.

Lokalna implementacija sada ima provjerljivi artifact chain, Crossref DOI
provjeru, native vision adapter i konfigurirani research-gateway adapter. To
ne predstavlja production activation: gateway mora imati odobreni policy,
staging credentiale i E2E dokaz izvora prije uključivanja web researcha.

Lokalni razvoj bez tog ugovora mora ostati fail-closed: agent worker vraća
kontrolirani `503`, a scheduler i staging E2E ne smiju ispisati uspješan run.
Za operativni redoslijed koristi [Agent worker staging runbook](./AGENT_WORKER_RUNBOOK.md).

## Environment contract

`npm.cmd run preflight:agentic` requires an HTTPS `KATEDRA_WORKER_APP_URL`,
worker token and cron secret, approved agent model, both agentic flags set to
`true`, `KATEDRA_BILLING_RPC_CONTRACT=v2`, and
`KATEDRA_RATE_LIMIT_STORE=supabase`, plus an approved HTTPS independent
passage-verifier gateway (`KATEDRA_VERIFIER_PROVIDER_URL`, key, model and
`KATEDRA_VERIFIER_POLICY_APPROVED=true`). If `KATEDRA_MATERIALS_ENABLED=true`, it
also requires `KATEDRA_MATERIAL_DELETE_RPC_CONTRACT=v1`. The command reports only variable names;
it never prints secret values. Keep the feature flags disabled locally until
the canonical staging evidence below is complete.

## Read-only provjera

Na canonical Supabase projektu pokreni:

```sql
select to_regclass('public.academic_projects') as academic_projects,
       to_regclass('public.entitlements') as entitlements,
       to_regclass('public.katedra_project_locks') as project_locks,
       to_regclass('public.agent_runs') as agent_runs,
       to_regclass('public.agent_steps') as agent_steps,
       to_regclass('public.agent_payload_manifests') as agent_payload_manifests,
       to_regclass('public.katedra_wallets') as katedra_wallets,
       to_regclass('public.katedra_usage') as katedra_usage,
       to_regclass('public.katedra_request_reservations') as katedra_request_reservations,
       to_regclass('public.katedra_billing_attempts') as katedra_billing_attempts,
       to_regclass('public.products') as products;

select n.nspname as schema,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.proname in (
    'lock_paid_project',
    'create_agent_run',
    'activate_agent_run',
    'cleanup_stale_initializing_agent_run',
    'claim_agent_step',
    'complete_agent_step',
    'register_agent_payload',
    'attach_agent_payloads_to_run',
    'replace_agent_payloads_for_run',
    'tombstone_agent_payload',
    'list_active_agent_payloads',
    'cleanup_expired_agent_payloads',
    'pause_agent_run',
    'resume_agent_run',
    'cancel_agent_run',
    'katedra_reserve_request',
    'katedra_release_request',
    'katedra_consume',
    'katedra_mark_pending'
  )
order by 1, 2;

select id, kind, work_type, slots_total, purchase_window_days, price_eur, active
from public.products
where id in (
  'katedra_pass_seminarski',
  'katedra_pass_zavrsni',
  'katedra_pass_diplomski'
)
order by id;
```

Lokalne migracije nakon ovog pregleda uključuju `0072_harden_katedra_agent_scope.sql`,
`0077_agent_payload_tombstone.sql`, `0078_harden_agent_run_lifecycle.sql`,
`0079_fix_billing_daily_ceiling.sql`, `0080_list_active_agent_payloads.sql`,
`0081_harden_create_and_register_scope.sql`,
`0082_replace_agent_payloads_for_run.sql` i
`0083_billing_pending_marker.sql`, `0084_revoke_legacy_agent_payload_attach.sql`
i `0085_guard_locked_project_mutations.sql`.
One dodatno ograničavaju agent runove i privremene payloade na zaključani
projekt i odgovarajući aktivni Katedra Pass, vežu brisanje uz canonical
tombstone, vraćaju samo aktivne korisničke materijale iz canonical manifesta
te sprječavaju kasni worker completion, djelomično vezanje materijala i
potrošnju dnevnog limita na otpuštene rezervacije. `0085` dodatno štiti topic/
work type race u compatibility state write-pathu, direktne Storage čitanje/
upload/update/delete pozive i manifest putanje za materijale, run-context i
rezultate. Delete je dopušten samo za aktivni projektni Pass ili već tombstonirani
manifest i blokiran je dok je payload vezan uz aktivni run.
Te migracije još nisu deployane na canonical staging projekt.

Očekivanje je da su prisutne sve navedene projektne, agenticne i billing
tablice, da su svi navedeni RPC-i dostupni s ugovorenim parametrima i da su
sva tri Katedra Pass proizvoda aktivna u Lekta katalogu. Ako bilo što
nedostaje, ostavi:

```env
KATEDRA_PROJECT_LOCKS_ENABLED=false
KATEDRA_AGENT_RUNS_ENABLED=false
KATEDRA_MATERIALS_ENABLED=false
```

Release gate dodatno zahtijeva billing sloj: `katedra_request_reservations`,
`katedra_billing_attempts`, `katedra_reserve_request`,
`katedra_release_request`, `katedra_consume` i `katedra_mark_pending`.
Agenticni contract preflight ih provjerava zajedno s agent tablicama i RPC-ima;
nedostajuci billing ugovor uvijek ostavlja agenticni sustav fail-closed.

Read-only provjera 2026-08-14 pokazala je da canonical projekt još nema agent tablice ni traženi RPC set. Lokalne Lekta migracije `0067`–`0071` sada definiraju ugovor i Katedra Pass katalog, ali flagovi se ne uključuju dok isti ugovor ne bude deployan i provjeren na canonical staging projektu, uz RLS, lease claim, idempotentni cleanup i staging E2E.
