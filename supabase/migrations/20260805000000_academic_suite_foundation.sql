-- ============================================================
-- KATEDRA × LEKTA — shared foundation v0.1
--
-- Additive migration only. Existing Katedra code can continue using:
--   - id (row UUID)
--   - guest_project_id (legacy client project ID)
--   - work_type ('s'|'z'|'d')
--
-- New cross-product code gets explicit canonical fields without a big-bang
-- rewrite. Raw document content is NOT introduced here.
-- ============================================================

alter table public.katedra_projects
  add column if not exists project_id text,
  add column if not exists work_type_canonical text,
  add column if not exists contract_version text not null default '0.1';

-- Preserve project identity through the migration. Existing guest-first projects
-- keep the ID the user already carried through localStorage/handoffs. If an older
-- row somehow has no guest ID, use the row UUID as a safe opaque fallback.
update public.katedra_projects
   set project_id = coalesce(nullif(project_id, ''), nullif(guest_project_id, ''), id::text)
 where project_id is null or project_id = '';

-- Translate current Katedra UI vocabulary without changing the legacy column.
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

-- Canonical vocabulary used in shared payloads/persistence. This does NOT widen
-- the current Katedra v1 UI; it only prevents future cross-product one-letter codes.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
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

-- Legacy client IDs were historically unique only per user. Preserve that safety
-- during migration. This keeps old `k...` projects backwards-compatible.
create unique index if not exists katedra_projects_user_project_idx
  on public.katedra_projects (user_id, project_id);

-- Foundation v0.1 generates UUID project IDs before authentication. Those IDs are
-- the canonical ecosystem identity and must be globally unique across users so a
-- future shared project/entitlement table can safely reference `project_id` without
-- also requiring user identity. Do not impose this retroactively on legacy `k...`
-- aliases; enforce it only for standard UUID-shaped canonical IDs (including UUID
-- fallbacks derived from the existing row primary key). The structural regex is
-- deliberately version-agnostic so future UUIDv7 IDs remain covered.
create unique index if not exists katedra_projects_canonical_uuid_idx
  on public.katedra_projects (project_id)
  where project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

comment on column public.katedra_projects.project_id is
  'Canonical Lekta×Katedra project identity. Exists before login; login attaches ownership rather than replacing project identity. New UUID IDs are globally unique; legacy k... aliases remain per-user compatible.';

comment on column public.katedra_projects.work_type_canonical is
  'Shared semantic work type. Legacy work_type s/z/d remains temporarily for Katedra v1 UI compatibility.';

comment on column public.katedra_projects.contract_version is
  'Version of the shared Lekta×Katedra domain contract used by this persisted project record.';
