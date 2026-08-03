\set ON_ERROR_STOP on

-- Minimal Supabase-compatible bootstrap for exercising Katedra migrations on
-- vanilla PostgreSQL in CI. Only auth primitives referenced by the migrations
-- are modeled; production auth/session behavior is not simulated.
create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key
);
create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select null::uuid $$;

\i supabase/migrations/20260803000000_katedra_projects.sql
\i supabase/migrations/20260804000000_katedra_project_state.sql

insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003');

-- Seed legacy production-like rows before the shared migration exists.
insert into public.katedra_projects(user_id, guest_project_id, work_type, topic, checks) values
  ('00000000-0000-4000-8000-000000000001', 'klegacy-seminar', 's', 'legacy seminar', '{"f0_a":true}'::jsonb),
  ('00000000-0000-4000-8000-000000000001', 'klegacy-final',   'z', 'legacy final',   '{"f0_b":true}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'd', 'guest UUID graduate', '{"f1_a":true}'::jsonb),
  ('00000000-0000-4000-8000-000000000003', null, 'd', 'row UUID fallback', '{}'::jsonb);

create temp table foundation_baseline as
select count(*)::bigint as project_rows_before
from public.katedra_projects;

create temp table legacy_identity_snapshot as
select id, user_id, guest_project_id, topic
from public.katedra_projects;

\i supabase/migrations/20260805000000_academic_suite_foundation.sql

-- ---------------------------------------------------------------------------
-- Compatibility table safety
-- ---------------------------------------------------------------------------

do $$
declare
  before_count bigint;
  after_count bigint;
begin
  select project_rows_before into before_count from foundation_baseline;
  select count(*) into after_count from public.katedra_projects;
  if before_count <> after_count then
    raise exception 'foundation migration changed legacy row count: before %, after %', before_count, after_count;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from public.katedra_projects
    where project_id is null or project_id = ''
       or work_type_canonical is null or work_type_canonical = ''
       or contract_version is null or contract_version = ''
  ) then
    raise exception 'legacy compatibility columns contain null/empty values';
  end if;

  if exists (
    select 1 from public.katedra_projects
    where (work_type = 's' and work_type_canonical <> 'seminar')
       or (work_type = 'z' and work_type_canonical <> 'final')
       or (work_type = 'd' and work_type_canonical <> 'graduate')
  ) then
    raise exception 'legacy work type mapping is incorrect';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Shared Core backfill: every legacy row becomes one academic project
-- ---------------------------------------------------------------------------

do $$
declare
  legacy_count bigint;
  shared_count bigint;
begin
  select count(*) into legacy_count from public.katedra_projects;
  select count(*) into shared_count from public.academic_projects;
  if legacy_count <> shared_count then
    raise exception 'shared project backfill mismatch: legacy %, shared %', legacy_count, shared_count;
  end if;
end $$;

-- Legacy k... aliases receive the already-existing DB row UUID as canonical ID.
do $$
declare
  expected_id uuid;
  actual_id uuid;
begin
  select id into expected_id
  from legacy_identity_snapshot
  where guest_project_id = 'klegacy-seminar';

  select id into actual_id
  from public.academic_projects
  where user_id = '00000000-0000-4000-8000-000000000001'
    and legacy_client_project_id = 'klegacy-seminar';

  if actual_id is distinct from expected_id then
    raise exception 'legacy k... project did not migrate to row UUID: expected %, got %', expected_id, actual_id;
  end if;
end $$;

-- A UUID created by the guest client is already canonical and must survive exactly.
do $$
begin
  if not exists (
    select 1 from public.academic_projects
    where id = '11111111-1111-4111-8111-111111111111'
      and user_id = '00000000-0000-4000-8000-000000000002'
      and legacy_client_project_id = '11111111-1111-4111-8111-111111111111'
      and work_type = 'graduate'
  ) then
    raise exception 'guest UUID was not preserved as canonical academic project ID';
  end if;
end $$;

-- A row with no client alias safely uses its pre-existing DB UUID.
do $$
declare
  expected_id uuid;
begin
  select id into expected_id
  from legacy_identity_snapshot
  where topic = 'row UUID fallback';

  if not exists (
    select 1 from public.academic_projects
    where id = expected_id
      and user_id = '00000000-0000-4000-8000-000000000003'
      and legacy_client_project_id is null
  ) then
    raise exception 'row UUID fallback did not become shared canonical identity';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Katedra-owned state is split from shared project metadata
-- ---------------------------------------------------------------------------

do $$
begin
  if (select count(*) from public.katedra_project_state) <> (select count(*) from public.academic_projects) then
    raise exception 'katedra_project_state backfill count mismatch';
  end if;

  if not exists (
    select 1
    from public.katedra_project_state s
    join public.academic_projects p on p.id = s.project_id
    where p.legacy_client_project_id = 'klegacy-seminar'
      and s.checks @> '{"f0_a":true}'::jsonb
  ) then
    raise exception 'Katedra state was not split/backfilled correctly';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Compatibility mirror: current /api/state writes keep shared tables current
-- ---------------------------------------------------------------------------

update public.katedra_projects
   set topic = 'legacy seminar updated',
       checks = '{"f0_a":true,"f0_new":true}'::jsonb,
       lekta_score = 88
 where guest_project_id = 'klegacy-seminar';

do $$
begin
  if not exists (
    select 1
    from public.academic_projects p
    join public.katedra_project_state s on s.project_id = p.id
    where p.legacy_client_project_id = 'klegacy-seminar'
      and p.topic = 'legacy seminar updated'
      and s.lekta_score = 88
      and s.checks @> '{"f0_new":true}'::jsonb
  ) then
    raise exception 'legacy compatibility trigger did not mirror update into shared backbone';
  end if;
end $$;

-- New UUID-first Katedra rows must use that UUID in shared Core, not their random
-- compatibility-table primary key.
insert into public.katedra_projects(
  user_id, project_id, guest_project_id, work_type, work_type_canonical, topic
) values (
  '00000000-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222222',
  '22222222-2222-4222-8222-222222222222',
  'd', 'graduate', 'new UUID-first project'
);

do $$
begin
  if not exists (
    select 1 from public.academic_projects
    where id = '22222222-2222-4222-8222-222222222222'
      and user_id = '00000000-0000-4000-8000-000000000001'
      and topic = 'new UUID-first project'
  ) then
    raise exception 'UUID-first compatibility write did not create matching shared project';
  end if;
end $$;

-- UUID-shaped client project IDs are global identities and may not collide across users.
do $$
begin
  begin
    insert into public.katedra_projects(
      user_id, project_id, guest_project_id, work_type, work_type_canonical, topic
    ) values (
      '00000000-0000-4000-8000-000000000002',
      '22222222-2222-4222-8222-222222222222',
      'k-uuid-owner-b',
      'd', 'graduate', 'duplicate canonical UUID'
    );
    raise exception 'expected global canonical UUID unique violation was not raised';
  exception
    when unique_violation then null;
  end;
end $$;

-- Legacy non-UUID compatibility IDs may still be duplicated across owners.
insert into public.katedra_projects(
  user_id, project_id, guest_project_id, work_type, work_type_canonical, topic
) values
  ('00000000-0000-4000-8000-000000000001', 'k-cross-user-legacy', 'k-cross-user-a', 'z', 'final', 'legacy owner A'),
  ('00000000-0000-4000-8000-000000000002', 'k-cross-user-legacy', 'k-cross-user-b', 'z', 'final', 'legacy owner B');

-- Their shared IDs are still distinct UUIDs, proving the canonical registry itself
-- never has ambiguous project identity.
do $$
declare
  distinct_ids bigint;
begin
  select count(distinct id) into distinct_ids
  from public.academic_projects
  where legacy_client_project_id in ('k-cross-user-a', 'k-cross-user-b');
  if distinct_ids <> 2 then
    raise exception 'legacy cross-user aliases produced ambiguous shared project IDs';
  end if;
end $$;

-- Unsupported canonical work types remain rejected.
do $$
begin
  begin
    insert into public.katedra_projects(
      user_id, project_id, guest_project_id, work_type, work_type_canonical, topic
    ) values (
      '00000000-0000-4000-8000-000000000003',
      '33333333-3333-4333-8333-333333333333',
      'k-invalid-type',
      'd', 'essay', 'invalid shared type'
    );
    raise exception 'expected canonical work-type check violation was not raised';
  exception
    when check_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Lekta-owned history and entitlements share the same project/user backbone
-- ---------------------------------------------------------------------------

insert into public.lekta_checks(
  analysis_id, project_id, ruleset_id, profile_id, score, category_scores,
  issues, analyzed_at
) values (
  'smoke-analysis-1',
  '22222222-2222-4222-8222-222222222222',
  'fpzg:graduate:smoke',
  'fpzg-smoke',
  88,
  '[]'::jsonb,
  '[{"issueKey":"check:margins","checkId":"margins"}]'::jsonb,
  now()
);

insert into public.entitlements(
  user_id, project_id, scope, capabilities, source_product_id
) values (
  '00000000-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222222',
  'academic-pass',
  array['katedra.review.full','lekta.recheck'],
  'smoke-pass'
);

do $$
begin
  if not exists (
    select 1 from public.lekta_checks
    where analysis_id = 'smoke-analysis-1'
      and project_id = '22222222-2222-4222-8222-222222222222'
  ) then
    raise exception 'Lekta check did not attach to shared project';
  end if;

  if not exists (
    select 1 from public.entitlements
    where user_id = '00000000-0000-4000-8000-000000000001'
      and project_id = '22222222-2222-4222-8222-222222222222'
      and scope = 'academic-pass'
  ) then
    raise exception 'shared entitlement did not attach to account/project';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Schema / privacy invariants
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.academic_projects') is null
     or to_regclass('public.katedra_project_state') is null
     or to_regclass('public.lekta_checks') is null
     or to_regclass('public.entitlements') is null then
    raise exception 'one or more shared Academic Suite tables are missing';
  end if;

  if not exists (
    select 1 from pg_class
    where oid = 'public.academic_projects'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.katedra_project_state'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.lekta_checks'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.entitlements'::regclass and relrowsecurity
  ) then
    raise exception 'RLS is not enabled on every shared table';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('academic_projects','katedra_project_state','lekta_checks','entitlements')
      and column_name in (
        'docx', 'document', 'document_text', 'document_content', 'raw_document',
        'issue_detail', 'issue_location', 'mentor_comments', 'source_passages'
      )
  ) then
    raise exception 'shared foundation introduced forbidden document-content column';
  end if;
end $$;

select
  (select count(*) from public.academic_projects) as academic_projects,
  (select count(*) from public.katedra_project_state) as katedra_states,
  (select count(*) from public.lekta_checks) as lekta_checks,
  (select count(*) from public.entitlements) as entitlements;
