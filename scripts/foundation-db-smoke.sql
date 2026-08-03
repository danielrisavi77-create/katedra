\set ON_ERROR_STOP on

-- Minimal Supabase-compatible bootstrap for exercising Katedra migrations on
-- vanilla PostgreSQL in CI. We only model the auth primitives referenced by the
-- project-table migrations; no production auth behavior is simulated here.
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

-- Exercise all three legacy work types, a legacy `k...` project, a UUID-shaped
-- guest project, and a row without any guest alias (must fall back to row UUID).
insert into public.katedra_projects(user_id, guest_project_id, work_type, topic) values
  ('00000000-0000-4000-8000-000000000001', 'klegacy-seminar', 's', 'legacy seminar'),
  ('00000000-0000-4000-8000-000000000001', 'klegacy-final',   'z', 'legacy final'),
  ('00000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'd', 'guest UUID graduate'),
  ('00000000-0000-4000-8000-000000000003', null, 'd', 'row UUID fallback');

create temp table foundation_baseline as
select count(*)::bigint as project_rows_before
from public.katedra_projects;

\i supabase/migrations/20260805000000_academic_suite_foundation.sql

-- No existing projects may disappear.
do $$
declare
  before_count bigint;
  after_count bigint;
begin
  select project_rows_before into before_count from foundation_baseline;
  select count(*) into after_count from public.katedra_projects;
  if before_count <> after_count then
    raise exception 'foundation migration changed row count: before %, after %', before_count, after_count;
  end if;
end $$;

-- Canonical columns must be complete after migration.
do $$
begin
  if exists (
    select 1 from public.katedra_projects
    where project_id is null or project_id = ''
       or work_type_canonical is null or work_type_canonical = ''
       or contract_version is null or contract_version = ''
  ) then
    raise exception 'canonical foundation columns contain null/empty values';
  end if;
end $$;

-- Legacy vocabulary must map exactly.
do $$
begin
  if exists (
    select 1 from public.katedra_projects
    where (work_type = 's' and work_type_canonical <> 'seminar')
       or (work_type = 'z' and work_type_canonical <> 'final')
       or (work_type = 'd' and work_type_canonical <> 'graduate')
  ) then
    raise exception 'legacy work type mapping is incorrect';
  end if;
end $$;

-- Guest IDs survive; a missing guest ID falls back to the row primary-key UUID.
do $$
begin
  if not exists (
    select 1 from public.katedra_projects
    where guest_project_id = 'klegacy-seminar'
      and project_id = 'klegacy-seminar'
  ) then
    raise exception 'legacy project identity was not preserved';
  end if;

  if exists (
    select 1 from public.katedra_projects
    where guest_project_id is null
      and project_id <> id::text
  ) then
    raise exception 'row UUID fallback did not become canonical project identity';
  end if;
end $$;

-- Required indexes and constraint must exist.
do $$
begin
  if to_regclass('public.katedra_projects_user_project_idx') is null then
    raise exception 'missing per-owner project index';
  end if;
  if to_regclass('public.katedra_projects_canonical_uuid_idx') is null then
    raise exception 'missing global canonical UUID index';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.katedra_projects'::regclass
      and conname = 'katedra_projects_work_type_canonical_check'
  ) then
    raise exception 'missing canonical work type constraint';
  end if;
end $$;

-- UUID-shaped canonical IDs are ecosystem identities: they must collide across
-- users. Catching the expected unique_violation proves the partial global index
-- is enforcing the contract rather than merely existing in pg_indexes.
do $$
begin
  begin
    insert into public.katedra_projects(
      user_id, project_id, guest_project_id, work_type, work_type_canonical, topic
    ) values (
      '00000000-0000-4000-8000-000000000001',
      '22222222-2222-4222-8222-222222222222',
      'k-uuid-owner-a',
      'd', 'graduate', 'canonical UUID owner A'
    );

    insert into public.katedra_projects(
      user_id, project_id, guest_project_id, work_type, work_type_canonical, topic
    ) values (
      '00000000-0000-4000-8000-000000000002',
      '22222222-2222-4222-8222-222222222222',
      'k-uuid-owner-b',
      'd', 'graduate', 'canonical UUID owner B duplicate'
    );

    raise exception 'expected global canonical UUID unique violation was not raised';
  exception
    when unique_violation then
      null;
  end;
end $$;

-- Legacy non-UUID project IDs remain compatible across different owners.
insert into public.katedra_projects(
  user_id, project_id, guest_project_id, work_type, work_type_canonical, topic
) values
  ('00000000-0000-4000-8000-000000000001', 'k-cross-user-legacy', 'k-cross-user-a', 'z', 'final', 'legacy owner A'),
  ('00000000-0000-4000-8000-000000000002', 'k-cross-user-legacy', 'k-cross-user-b', 'z', 'final', 'legacy owner B');

-- Canonical vocabulary must reject unsupported values.
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
    when check_violation then
      null;
  end;
end $$;

-- Foundation migration must not introduce content-bearing academic-document
-- columns. This is intentionally a narrow contract check, not a generic ban on
-- all future project metadata.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'katedra_projects'
      and column_name in (
        'docx', 'document', 'document_text', 'document_content',
        'issue_detail', 'issue_location', 'mentor_comments', 'source_passages'
      )
  ) then
    raise exception 'foundation migration introduced forbidden document-content column';
  end if;
end $$;

select
  count(*) as smoke_project_rows,
  count(*) filter (where work_type_canonical = 'seminar') as seminars,
  count(*) filter (where work_type_canonical = 'final') as finals,
  count(*) filter (where work_type_canonical = 'graduate') as graduates
from public.katedra_projects;
