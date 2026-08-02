-- ============================================================
-- KATEDRA — Project Manifest v1, PROŠIRENJE na cijelo stanje čarobnjaka
-- (checklist, generator polja, povijest promptova, dnevnik procesa).
-- Prije ove migracije katedra_projects je nosio SAMO Lekta handoff polja;
-- sad nosi cijelo radno stanje jednog rada — server je izvor istine za
-- prijavljene korisnike (localStorage ostaje samo za goste / brz UI cache).
-- ============================================================

alter table public.katedra_projects
  add column if not exists checks jsonb not null default '{}'::jsonb, -- state.checks (checklist)
  add column if not exists gen    jsonb not null default '{}'::jsonb, -- Generator/Autopilot polja
  add column if not exists hist   jsonb not null default '[]'::jsonb, -- zadnjih 10 generiranih promptova
  add column if not exists log    jsonb not null default '[]'::jsonb, -- dnevnik procesa (do 200 zapisa)
  add column if not exists logf   jsonb not null default '[]'::jsonb; -- ID-jevi faza već zabilježenih u log

-- guest_project_id postaje jedini upsert ključ (uz user_id) za svaki sync
-- iz aplikacije — mora biti punopravan (ne djelomičan) unique index da
-- Supabase/PostgREST .upsert(onConflict:'user_id,guest_project_id') radi.
drop index if exists public.katedra_projects_guest_idx;
create unique index if not exists katedra_projects_guest_idx
  on public.katedra_projects (user_id, guest_project_id);
