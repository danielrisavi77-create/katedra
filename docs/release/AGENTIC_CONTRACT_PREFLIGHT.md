# Agentic contract preflight

Katedra endpointi moraju ostati iza feature flagova dok canonical Lekta ugovor nije deployan.

## Read-only provjera

Na canonical Supabase projektu pokreni:

```sql
select to_regclass('public.katedra_project_locks') as project_locks,
       to_regclass('public.agent_runs') as agent_runs,
       to_regclass('public.agent_steps') as agent_steps,
       to_regclass('public.agent_payload_manifests') as agent_payload_manifests;

select n.nspname as schema,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.proname in (
    'lock_paid_project',
    'create_agent_run',
    'claim_agent_step',
    'complete_agent_step',
    'register_agent_payload',
    'cleanup_expired_agent_payloads',
    'pause_agent_run',
    'resume_agent_run',
    'cancel_agent_run'
  )
order by 1, 2;
```

Očekivanje je da su sve tri tablice prisutne i da se vrati svih pet funkcija s ugovorenim parametrima. Ako bilo što nedostaje, ostavi:

```env
KATEDRA_PROJECT_LOCKS_ENABLED=false
KATEDRA_AGENT_RUNS_ENABLED=false
KATEDRA_MATERIALS_ENABLED=false
```

Read-only provjera 2026-08-14 pokazala je da canonical projekt još nema nijednu od tri tablice ni traženi RPC set. Migracija mora nastati u Lekta repozitoriju, uz RLS, lease claim, idempotentni cleanup i staging E2E prije uključivanja flagova.
