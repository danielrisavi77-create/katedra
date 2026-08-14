# Agentic contract preflight

Katedra endpointi moraju ostati iza feature flagova dok canonical Lekta ugovor nije deployan i provjeren.

## Environment contract

`npm.cmd run preflight:agentic` requires an HTTPS `KATEDRA_WORKER_APP_URL`,
worker token and cron secret, approved agent model, both agentic flags set to
`true`, `KATEDRA_BILLING_RPC_CONTRACT=v2`, and
`KATEDRA_RATE_LIMIT_STORE=supabase`. The command reports only variable names;
it never prints secret values. Keep the feature flags disabled locally until
the canonical staging evidence below is complete.

## Read-only provjera

Na canonical Supabase projektu pokreni:

```sql
select to_regclass('public.katedra_project_locks') as project_locks,
       to_regclass('public.agent_runs') as agent_runs,
       to_regclass('public.agent_steps') as agent_steps,
       to_regclass('public.agent_payload_manifests') as agent_payload_manifests,
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
    'cleanup_expired_agent_payloads',
    'pause_agent_run',
    'resume_agent_run',
    'cancel_agent_run'
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

Lokalne migracije nakon ovog pregleda ukljucuju i `0072_harden_katedra_agent_scope.sql`,
koji dodatno ogranicava agent run i privremene payloade na zakljucani projekt i
odgovarajuci aktivni Katedra Pass. Ta migracija jos nije deployana na canonical
staging projekt.

Očekivanje je da su sve četiri agent tablice prisutne, da su svi navedeni RPC-i dostupni s ugovorenim parametrima i da su sva tri Katedra Pass proizvoda aktivna u Lekta katalogu. Ako bilo što nedostaje, ostavi:

```env
KATEDRA_PROJECT_LOCKS_ENABLED=false
KATEDRA_AGENT_RUNS_ENABLED=false
KATEDRA_MATERIALS_ENABLED=false
```

Read-only provjera 2026-08-14 pokazala je da canonical projekt još nema agent tablice ni traženi RPC set. Lokalne Lekta migracije `0067`–`0071` sada definiraju ugovor i Katedra Pass katalog, ali flagovi se ne uključuju dok isti ugovor ne bude deployan i provjeren na canonical staging projektu, uz RLS, lease claim, idempotentni cleanup i staging E2E.
