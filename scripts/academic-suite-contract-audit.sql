-- Read-only release audit for the shared Lekta Supabase project.
-- This is NOT a migration and must never be applied as DDL.

-- 1. Canonical project/state tables and withdrawal storage.
select to_regclass('public.academic_projects') as academic_projects,
       to_regclass('public.katedra_project_state') as katedra_project_state,
       to_regclass('public.katedra_projects') as katedra_compatibility,
       to_regclass('public.withdrawal_requests') as withdrawal_requests,
       to_regclass('public.katedra_project_locks') as katedra_project_locks,
       to_regclass('public.agent_runs') as agent_runs,
       to_regclass('public.agent_steps') as agent_steps,
       to_regclass('public.agent_payload_manifests') as agent_payload_manifests,
       to_regclass('public.products') as products;

-- 2. Required v2 functions and their exact signatures.
select n.nspname as schema_name,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as result_type,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'katedra_consume',
    'katedra_reserve_request',
    'katedra_release_request',
    'katedra_authorize_project_ai',
    'katedra_reserve_withdrawal',
    'katedra_release_withdrawal',
    'katedra_commit_withdrawal'
    ,'lock_paid_project'
    ,'create_agent_run'
    ,'claim_agent_step'
    ,'complete_agent_step'
    ,'register_agent_payload'
    ,'attach_agent_payloads_to_run'
    ,'replace_agent_payloads_for_run'
    ,'tombstone_agent_payload'
    ,'list_active_agent_payloads'
    ,'cleanup_expired_agent_payloads'
    ,'pause_agent_run'
    ,'resume_agent_run'
    ,'cancel_agent_run'
  )
order by p.proname, arguments;

-- 2b. Katedra product ids used by strict project capability checks.
select id, kind, work_type, slots_total, purchase_window_days, price_eur, active
from public.products
where id in ('katedra_pass_seminarski', 'katedra_pass_zavrsni', 'katedra_pass_diplomski')
order by id;

-- 3. Compatibility-to-canonical project trigger.
select c.relname as table_name,
       t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and c.relname in ('academic_projects', 'katedra_projects', 'katedra_project_state')
order by c.relname, t.tgname;

-- 4. Ownership/RLS policy presence for the core tables.
select schemaname,
       tablename,
       policyname,
       cmd,
       qual,
       with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('academic_projects', 'katedra_projects', 'katedra_project_state', 'entitlements')
order by tablename, policyname;
