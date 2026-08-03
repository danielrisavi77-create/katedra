-- ============================================================
-- ACADEMIC SUITE — shared Supabase foundation v0.1
--
-- One Supabase project, two products:
--   - Katedra owns process/coaching state
--   - Lekta owns deterministic check history
--   - Academic Suite Core owns account/project/entitlement identity
--
-- This migration is additive and intentionally keeps `katedra_projects` as a
-- temporary compatibility write-path. A trigger mirrors every Katedra write into
-- the new canonical shared tables, so production can migrate without a big-bang
-- API rewrite or loss of rollback safety.
--
-- Raw DOCX/document content is NOT stored in any table introduced here.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. Legacy Katedra compatibility columns
-- ---------------------------------------------------------------------------

alter table public.katedra_projects
  add column if not exists project_id text,
  add column if not exists work_type_canonical text,
  add column if not exists contract_version text not null default '0.1';

update public.katedra_projects
   set project_id = coalesce(nullif(project_id, ''), nullif(guest_project_id, ''), id::text)
 where project_id is null or project_id = '';

update public.katedra_projects
   set work_type_canonical = case work_type
     when 's' then 'seminar'
     when 'z' then 'final'
     when 'd' then 'graduate'
     else work_type_canonical
   end
 where work_type_canonical is null or work_type_canonical = '';

alter table public.katedra_projects
  alter column project_id set not null,
  alter column work_type_canonical set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'katedra_projects_work_type_canonical_check'
      and conrelid = 'public.katedra_projects'::regclass
  ) then
    alter table public.katedra_projects
      add constraint katedra_projects_work_type_canonical_check
      check (work_type_canonical in (
        'seminar', 'final', 'graduate', 'specialist', 'doctoral', 'article', 'project'
      ));
  end if;
end $$;

-- Legacy aliases stay unique per owner. UUID-shaped client project IDs are already
-- canonical ecosystem IDs and therefore must be globally unique.
create unique index if not exists katedra_projects_user_project_idx
  on public.katedra_projects (user_id, project_id);

create unique index if not exists katedra_projects_canonical_uuid_idx
  on public.katedra_projects (project_id)
  where project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

comment on column public.katedra_projects.project_id is
  'Compatibility project identity carried by Katedra v1. UUID values map 1:1 to academic_projects.id; legacy k... values map through legacy_client_project_id.';
comment on column public.katedra_projects.work_type_canonical is
  'Compatibility copy of the shared semantic work type.';
comment on column public.katedra_projects.contract_version is
  'Shared Lekta×Katedra contract version used by this compatibility row.';

-- ---------------------------------------------------------------------------
-- 1. Shared Core: one academic work = one canonical project UUID
-- ---------------------------------------------------------------------------

create table if not exists public.academic_projects (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  legacy_client_project_id text,
  title                    text,
  topic                    text not null default '',
  institution_id           text,
  unit_id                  text not null default '',
  program_id               text,
  profile_id               text,
  work_type                text not null check (work_type in (
    'seminar', 'final', 'graduate', 'specialist', 'doctoral', 'article', 'project'
  )),
  academic_year            text,
  mentor_name              text,
  deadline                 date,
  stage                    text not null default 'topic' check (stage in (
    'topic', 'research', 'plan', 'writing', 'mentor-review', 'katedra-review',
    'lekta-preflight', 'revision', 'submission', 'defense', 'completed'
  )),
  ruleset_id               text,
  ruleset_version          text,
  contract_version         text not null default '0.1',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists academic_projects_user_updated_idx
  on public.academic_projects (user_id, updated_at desc);
create unique index if not exists academic_projects_user_legacy_idx
  on public.academic_projects (user_id, legacy_client_project_id)
  where legacy_client_project_id is not null and legacy_client_project_id <> '';

alter table public.academic_projects enable row level security;
create policy "academic projects: select own" on public.academic_projects
  for select using (auth.uid() = user_id);
create policy "academic projects: insert own" on public.academic_projects
  for insert with check (auth.uid() = user_id);
create policy "academic projects: update own" on public.academic_projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "academic projects: delete own" on public.academic_projects
  for delete using (auth.uid() = user_id);

create or replace function public.academic_projects_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists academic_projects_touch on public.academic_projects;
create trigger academic_projects_touch
  before update on public.academic_projects
  for each row execute function public.academic_projects_touch();

-- ---------------------------------------------------------------------------
-- 2. Katedra-owned state: process/coaching/cache data only
-- ---------------------------------------------------------------------------

create table if not exists public.katedra_project_state (
  project_id                uuid primary key references public.academic_projects(id) on delete cascade,
  checks                    jsonb not null default '{}'::jsonb,
  gen                       jsonb not null default '{}'::jsonb,
  hist                      jsonb not null default '[]'::jsonb,
  log                       jsonb not null default '[]'::jsonb,
  logf                      jsonb not null default '[]'::jsonb,
  lekta_score               int check (lekta_score between 0 and 100),
  lekta_checked_at          timestamptz,
  lekta_issues              jsonb not null default '[]'::jsonb,
  lekta_fixed_total         int not null default 0 check (lekta_fixed_total >= 0),
  latest_lekta_analysis_id  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.katedra_project_state enable row level security;
create policy "katedra state: select own" on public.katedra_project_state
  for select using (exists (
    select 1 from public.academic_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));
create policy "katedra state: insert own" on public.katedra_project_state
  for insert with check (exists (
    select 1 from public.academic_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));
create policy "katedra state: update own" on public.katedra_project_state
  for update using (exists (
    select 1 from public.academic_projects p
    where p.id = project_id and p.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.academic_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));
create policy "katedra state: delete own" on public.katedra_project_state
  for delete using (exists (
    select 1 from public.academic_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));

create or replace function public.katedra_project_state_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists katedra_project_state_touch on public.katedra_project_state;
create trigger katedra_project_state_touch
  before update on public.katedra_project_state
  for each row execute function public.katedra_project_state_touch();

-- ---------------------------------------------------------------------------
-- 3. Lekta-owned history: sanitized deterministic analysis records
-- ---------------------------------------------------------------------------

create table if not exists public.lekta_checks (
  analysis_id          text primary key,
  project_id           uuid not null references public.academic_projects(id) on delete cascade,
  ruleset_id           text not null,
  profile_id           text,
  score                int not null check (score between 0 and 100),
  score_label          text,
  profile_status       text,
  category_scores      jsonb not null default '[]'::jsonb,
  issues               jsonb not null default '[]'::jsonb,
  document_fingerprint text,
  coverage_tier        int,
  analyzed_at          timestamptz not null,
  contract_version     text not null default '0.1',
  created_at           timestamptz not null default now()
);

create index if not exists lekta_checks_project_time_idx
  on public.lekta_checks (project_id, analyzed_at desc);

alter table public.lekta_checks enable row level security;
create policy "lekta checks: select own" on public.lekta_checks
  for select using (exists (
    select 1 from public.academic_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));
-- No client write policy: production Lekta persistence will use a trusted server
-- path/service role. The browser-local DOCX analyzer remains local-first.

-- ---------------------------------------------------------------------------
-- 4. Shared commerce rights: separate from Katedra token-cost accounting
-- ---------------------------------------------------------------------------

create table if not exists public.entitlements (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  project_id        uuid references public.academic_projects(id) on delete set null,
  scope             text not null check (scope in (
    'lekta-check', 'lekta-fix', 'katedra-pro', 'academic-pass', 'academic-pass-plus'
  )),
  capabilities      text[] not null default '{}'::text[],
  valid_from        timestamptz not null default now(),
  valid_until       timestamptz,
  usage_limit       int check (usage_limit is null or usage_limit >= 0),
  usage_count       int not null default 0 check (usage_count >= 0),
  status            text not null default 'active' check (status in (
    'active', 'consumed', 'expired', 'revoked', 'refunded'
  )),
  source_product_id text not null,
  provider_ref      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from)
);

create index if not exists entitlements_user_status_idx
  on public.entitlements (user_id, status, valid_until);
create index if not exists entitlements_project_idx
  on public.entitlements (project_id) where project_id is not null;

alter table public.entitlements enable row level security;
create policy "entitlements: select own" on public.entitlements
  for select using (auth.uid() = user_id);
-- No client insert/update/delete policy. Billing/webhook/server code remains the
-- authority for purchased rights.

create or replace function public.entitlements_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists entitlements_touch on public.entitlements;
create trigger entitlements_touch
  before update on public.entitlements
  for each row execute function public.entitlements_touch();

-- ---------------------------------------------------------------------------
-- 5. Backfill existing Katedra rows into the shared backbone
-- ---------------------------------------------------------------------------

-- Canonical UUID rule during migration:
--   * a UUID-shaped existing client project ID remains the ecosystem UUID;
--   * a legacy k... project receives the already-existing katedra_projects.id UUID;
--     and keeps k... only as legacy_client_project_id.
insert into public.academic_projects (
  id, user_id, legacy_client_project_id, topic, unit_id, profile_id, work_type,
  deadline, ruleset_version, contract_version, created_at, updated_at
)
select
  case
    when kp.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then kp.project_id::uuid
    else kp.id
  end,
  kp.user_id,
  nullif(kp.guest_project_id, ''),
  kp.topic,
  kp.unit_id,
  nullif(kp.profile_id, ''),
  kp.work_type_canonical,
  kp.deadline,
  nullif(kp.ruleset_version, ''),
  kp.contract_version,
  kp.created_at,
  kp.updated_at
from public.katedra_projects kp
on conflict (id) do update set
  user_id = excluded.user_id,
  legacy_client_project_id = excluded.legacy_client_project_id,
  topic = excluded.topic,
  unit_id = excluded.unit_id,
  profile_id = excluded.profile_id,
  work_type = excluded.work_type,
  deadline = excluded.deadline,
  ruleset_version = excluded.ruleset_version,
  contract_version = excluded.contract_version,
  updated_at = excluded.updated_at;

insert into public.katedra_project_state (
  project_id, checks, gen, hist, log, logf,
  lekta_score, lekta_checked_at, lekta_issues, lekta_fixed_total,
  created_at, updated_at
)
select
  case
    when kp.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then kp.project_id::uuid
    else kp.id
  end,
  kp.checks, kp.gen, kp.hist, kp.log, kp.logf,
  kp.lekta_score, kp.lekta_checked_at, kp.lekta_issues, kp.lekta_fixed_total,
  kp.created_at, kp.updated_at
from public.katedra_projects kp
on conflict (project_id) do update set
  checks = excluded.checks,
  gen = excluded.gen,
  hist = excluded.hist,
  log = excluded.log,
  logf = excluded.logf,
  lekta_score = excluded.lekta_score,
  lekta_checked_at = excluded.lekta_checked_at,
  lekta_issues = excluded.lekta_issues,
  lekta_fixed_total = excluded.lekta_fixed_total,
  updated_at = excluded.updated_at;

-- ---------------------------------------------------------------------------
-- 6. Compatibility mirror: current Katedra writes keep shared Core current
-- ---------------------------------------------------------------------------

create or replace function public.sync_katedra_project_to_academic_suite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_id uuid;
begin
  canonical_id := case
    when new.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then new.project_id::uuid
    else new.id
  end;

  insert into public.academic_projects (
    id, user_id, legacy_client_project_id, topic, unit_id, profile_id, work_type,
    deadline, ruleset_version, contract_version, created_at, updated_at
  ) values (
    canonical_id, new.user_id, nullif(new.guest_project_id, ''), new.topic,
    new.unit_id, nullif(new.profile_id, ''), new.work_type_canonical,
    new.deadline, nullif(new.ruleset_version, ''), new.contract_version,
    new.created_at, new.updated_at
  )
  on conflict (id) do update set
    user_id = excluded.user_id,
    legacy_client_project_id = excluded.legacy_client_project_id,
    topic = excluded.topic,
    unit_id = excluded.unit_id,
    profile_id = excluded.profile_id,
    work_type = excluded.work_type,
    deadline = excluded.deadline,
    ruleset_version = excluded.ruleset_version,
    contract_version = excluded.contract_version,
    updated_at = excluded.updated_at;

  insert into public.katedra_project_state (
    project_id, checks, gen, hist, log, logf,
    lekta_score, lekta_checked_at, lekta_issues, lekta_fixed_total,
    created_at, updated_at
  ) values (
    canonical_id, new.checks, new.gen, new.hist, new.log, new.logf,
    new.lekta_score, new.lekta_checked_at, new.lekta_issues, new.lekta_fixed_total,
    new.created_at, new.updated_at
  )
  on conflict (project_id) do update set
    checks = excluded.checks,
    gen = excluded.gen,
    hist = excluded.hist,
    log = excluded.log,
    logf = excluded.logf,
    lekta_score = excluded.lekta_score,
    lekta_checked_at = excluded.lekta_checked_at,
    lekta_issues = excluded.lekta_issues,
    lekta_fixed_total = excluded.lekta_fixed_total,
    updated_at = excluded.updated_at;

  return new;
end $$;

revoke execute on function public.sync_katedra_project_to_academic_suite() from public, anon, authenticated;

drop trigger if exists katedra_project_shared_mirror on public.katedra_projects;
create trigger katedra_project_shared_mirror
  after insert or update on public.katedra_projects
  for each row execute function public.sync_katedra_project_to_academic_suite();

-- A delete in the compatibility table should remove the canonical project while
-- the compatibility phase is active. Entitlements survive as project_id = NULL;
-- Katedra state and Lekta check history cascade with the deleted project.
create or replace function public.delete_katedra_project_from_academic_suite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_id uuid;
begin
  canonical_id := case
    when old.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then old.project_id::uuid
    else old.id
  end;
  delete from public.academic_projects
   where id = canonical_id and user_id = old.user_id;
  return old;
end $$;

revoke execute on function public.delete_katedra_project_from_academic_suite() from public, anon, authenticated;

drop trigger if exists katedra_project_shared_delete on public.katedra_projects;
create trigger katedra_project_shared_delete
  after delete on public.katedra_projects
  for each row execute function public.delete_katedra_project_from_academic_suite();

comment on table public.academic_projects is
  'Canonical project registry shared by Katedra and Lekta. Contains metadata only; never raw academic document content.';
comment on table public.katedra_project_state is
  'Katedra-owned process/coaching state keyed by the shared academic project UUID.';
comment on table public.lekta_checks is
  'Lekta-owned sanitized deterministic check history. Raw DOCX/text is intentionally absent.';
comment on table public.entitlements is
  'Shared cross-product capability grants. Separate from Katedra token-cost accounting.';
