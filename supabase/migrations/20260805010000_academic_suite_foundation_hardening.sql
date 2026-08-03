-- ============================================================
-- ACADEMIC SUITE — shared foundation ownership hardening v0.1
--
-- Must run immediately after 20260805000000_academic_suite_foundation.sql.
-- Prevents a compatibility write from ever changing ownership of an existing
-- shared project UUID and guarantees project-scoped entitlements belong to the
-- same user as the referenced project.
-- ============================================================

begin;

-- Replace the compatibility mirror with an ownership-safe version.
create or replace function public.sync_katedra_project_to_academic_suite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_id uuid;
  existing_owner uuid;
begin
  canonical_id := case
    when new.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then new.project_id::uuid
    else new.id
  end;

  select user_id into existing_owner
  from public.academic_projects
  where id = canonical_id;

  if existing_owner is not null and existing_owner <> new.user_id then
    raise exception 'Academic Suite project ownership conflict for %', canonical_id
      using errcode = '23505';
  end if;

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
    legacy_client_project_id = excluded.legacy_client_project_id,
    topic = excluded.topic,
    unit_id = excluded.unit_id,
    profile_id = excluded.profile_id,
    work_type = excluded.work_type,
    deadline = excluded.deadline,
    ruleset_version = excluded.ruleset_version,
    contract_version = excluded.contract_version,
    updated_at = excluded.updated_at
  where public.academic_projects.user_id = excluded.user_id;

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

-- Project-scoped entitlement rights must reference a project owned by the same
-- user. User-wide entitlements (`project_id is null`) remain valid.
create or replace function public.validate_entitlement_project_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.academic_projects p
    where p.id = new.project_id and p.user_id = new.user_id
  ) then
    raise exception 'Entitlement user does not own Academic Suite project %', new.project_id
      using errcode = '23503';
  end if;
  return new;
end $$;

drop trigger if exists entitlements_validate_project_owner on public.entitlements;
create trigger entitlements_validate_project_owner
  before insert or update of project_id, user_id on public.entitlements
  for each row execute function public.validate_entitlement_project_owner();

revoke execute on function public.validate_entitlement_project_owner() from public, anon, authenticated;

commit;
