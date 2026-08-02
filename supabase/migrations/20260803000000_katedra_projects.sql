-- ============================================================
-- KATEDRA — Project Manifest v1, server-side (Faza C u SaaS-u)
-- Jedan red = jedan rad (projekt). Lekta nalazi žive u jsonb-u,
-- ISTI shape kao u statičnoj Katedri v10.2 (referentna implementacija).
-- Ustav §6: ovdje NIKAD ne ulazi sadržaj rada — samo metadata + ID-jevi nalaza.
-- ============================================================

create table if not exists public.katedra_projects (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  unit_id          text not null default '',          -- Lekta unitId (npr. 'fpzg')
  profile_id       text not null default '',          -- Lekta profileId
  work_type        text not null default 'z' check (work_type in ('s','z','d')),
  topic            text not null default '',
  deadline         date,
  ruleset_version  text not null default '',
  lekta_score      int  check (lekta_score between 0 and 100),
  lekta_checked_at timestamptz,
  -- [{ id, severity:'critical'|'warning'|'info', category, fixable, label,
  --    status:'OPEN'|'USER_CHANGED'|'SKIPPED'|'VERIFIED_FIXED' }]
  lekta_issues     jsonb not null default '[]'::jsonb,
  lekta_fixed_total int  not null default 0,          -- kumulativno potvrđeno kroz re-checkove
  guest_project_id text,                              -- 'k…' ID iz localStorage migracije (dedup)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists katedra_projects_user_idx
  on public.katedra_projects (user_id, updated_at desc);
create unique index if not exists katedra_projects_guest_idx
  on public.katedra_projects (user_id, guest_project_id) where guest_project_id is not null;

alter table public.katedra_projects enable row level security;

create policy "projects: select own" on public.katedra_projects
  for select using (auth.uid() = user_id);
create policy "projects: insert own" on public.katedra_projects
  for insert with check (auth.uid() = user_id);
create policy "projects: update own" on public.katedra_projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects: delete own" on public.katedra_projects
  for delete using (auth.uid() = user_id);

create or replace function public.katedra_projects_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists katedra_projects_touch on public.katedra_projects;
create trigger katedra_projects_touch
  before update on public.katedra_projects
  for each row execute function public.katedra_projects_touch();
