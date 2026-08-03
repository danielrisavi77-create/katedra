# Lekta × Katedra — Production Release Checklist v0.1

Status: required release gate for the paired foundation PRs.

Paired changes:

- Katedra PR #1
- Lekta PR #25
- shared Supabase migrations, in order:
  1. `supabase/migrations/20260805000000_academic_suite_foundation.sql`
  2. `supabase/migrations/20260805010000_academic_suite_foundation_hardening.sql`

The target architecture is one Supabase project shared by both products. Katedra's existing Supabase becomes the Academic Suite identity/data backbone.

The migrations create the canonical shared model:

```text
auth.users
    └── academic_projects
          ├── katedra_project_state
          ├── lekta_checks
          └── entitlements
```

`katedra_projects` remains temporarily as a compatibility write-path only; DB triggers mirror it into the new canonical tables.

Raw thesis/DOCX content must never be introduced into the shared database as part of this release.

---

## 0. Release invariant

Do not deploy Katedra foundation code before **both** DB migrations are applied in order and every postcheck passes.

Do not manually modify SQL while pasting it into production. Any change must first be committed and pass the PostgreSQL migration CI gate.

---

## 1. Pre-migration database checks

Run these in the **existing Katedra Supabase project** SQL editor.

### 1.1 Legacy table exists

```sql
select to_regclass('public.katedra_projects') as katedra_projects;
```

Expected: `katedra_projects`.

### 1.2 Legacy work types are valid

```sql
select count(*) as invalid_work_type_rows
from public.katedra_projects
where work_type is null or work_type not in ('s', 'z', 'd');
```

Expected: `0`.

### 1.3 Legacy client aliases are unique per owner

```sql
select user_id, guest_project_id, count(*)
from public.katedra_projects
where guest_project_id is not null
  and guest_project_id <> ''
group by user_id, guest_project_id
having count(*) > 1;
```

Expected: zero rows.

### 1.4 UUID-shaped guest IDs are globally unique

```sql
select guest_project_id, count(*)
from public.katedra_projects
where guest_project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
group by guest_project_id
having count(*) > 1;
```

Expected: zero rows.

### 1.5 No UUID guest ID collides with another legacy row primary key

```sql
select
  src.id as source_row,
  src.guest_project_id,
  other_row.id as colliding_row
from public.katedra_projects src
join public.katedra_projects other_row
  on src.guest_project_id = other_row.id::text
 and src.id <> other_row.id
where src.guest_project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
```

Expected: zero rows.

### 1.6 Record baseline

```sql
select count(*) as legacy_project_rows_before
from public.katedra_projects;
```

Record this number as `N`.

---

## 2. Apply migrations

Apply **both** committed files in this exact order:

```text
supabase/migrations/20260805000000_academic_suite_foundation.sql
supabase/migrations/20260805010000_academic_suite_foundation_hardening.sql
```

Preferred methods:

1. Supabase SQL editor, executing each exact committed file in order; or
2. `supabase db push` only if the CLI is already linked to the correct production project.

The second migration is not optional. It adds DB-level protection against cross-user project ownership takeover and prevents project-scoped entitlements from referencing a project owned by a different user.

---

## 3. Post-migration hard gates

Every check below must pass before application promotion.

### 3.1 Legacy table lost no rows

```sql
select count(*) as legacy_project_rows_after
from public.katedra_projects;
```

Expected: the same `N` as before migration.

### 3.2 Shared tables exist

```sql
select
  to_regclass('public.academic_projects') as academic_projects,
  to_regclass('public.katedra_project_state') as katedra_project_state,
  to_regclass('public.lekta_checks') as lekta_checks,
  to_regclass('public.entitlements') as entitlements;
```

Expected: all four names non-null.

### 3.3 One legacy project became one shared project and one Katedra state row

```sql
select
  (select count(*) from public.katedra_projects) as legacy_rows,
  (select count(*) from public.academic_projects) as shared_projects,
  (select count(*) from public.katedra_project_state) as katedra_states;
```

Immediately after migration, all three counts must equal `N`.

### 3.4 Legacy compatibility columns are complete

```sql
select
  count(*) filter (where project_id is null or project_id = '') as missing_project_id,
  count(*) filter (where work_type_canonical is null or work_type_canonical = '') as missing_work_type_canonical,
  count(*) filter (where contract_version is null or contract_version = '') as missing_contract_version
from public.katedra_projects;
```

Expected: `0, 0, 0`.

### 3.5 Work-type mapping is exact

```sql
select count(*) as bad_mapping
from public.katedra_projects
where (work_type = 's' and work_type_canonical <> 'seminar')
   or (work_type = 'z' and work_type_canonical <> 'final')
   or (work_type = 'd' and work_type_canonical <> 'graduate');
```

Expected: `0`.

### 3.6 UUID-first projects preserved their UUID exactly

```sql
select count(*) as bad_uuid_migrations
from public.katedra_projects kp
left join public.academic_projects ap
  on ap.id::text = kp.guest_project_id
where kp.guest_project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and ap.id is null;
```

Expected: `0`.

### 3.7 Legacy `k...` projects use the old DB UUID as the new canonical ID

```sql
select count(*) as bad_legacy_migrations
from public.katedra_projects kp
left join public.academic_projects ap
  on ap.id = kp.id
 and ap.user_id = kp.user_id
 and ap.legacy_client_project_id is not distinct from kp.guest_project_id
where not (
  kp.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
  and ap.id is null;
```

Expected: `0`.

### 3.8 Katedra state was split correctly

```sql
select count(*) as projects_without_state
from public.academic_projects ap
left join public.katedra_project_state ks on ks.project_id = ap.id
where ks.project_id is null;
```

Expected immediately after migration: `0`.

### 3.9 Compatibility and ownership triggers exist

```sql
select tgrelid::regclass as table_name, tgname
from pg_trigger
where not tgisinternal
  and tgname in (
    'katedra_project_shared_mirror',
    'katedra_project_shared_delete',
    'entitlements_validate_project_owner'
  )
order by tgname;
```

Expected: all three trigger names.

### 3.10 RLS enabled on every shared table

```sql
select relname, relrowsecurity
from pg_class
where oid in (
  'public.academic_projects'::regclass,
  'public.katedra_project_state'::regclass,
  'public.lekta_checks'::regclass,
  'public.entitlements'::regclass
)
order by relname;
```

Expected: `relrowsecurity = true` for every row.

### 3.11 Privacy invariant

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'academic_projects',
    'katedra_project_state',
    'lekta_checks',
    'entitlements'
  )
  and column_name in (
    'docx', 'document', 'document_text', 'document_content', 'raw_document',
    'issue_detail', 'issue_location', 'mentor_comments', 'source_passages'
  );
```

Expected: zero rows.

The shared DB may contain sanitized structured Lekta issues. It must not contain the raw Word document or document-derived free-form text payloads.

---

## 4. Katedra production environment preflight

Verify the existing production deployment has the correct values:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL
```

Rules:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` point to the **same Supabase project that now hosts Academic Suite Core**.
- `SUPABASE_SERVICE_ROLE_KEY` remains server-only.
- Stripe/Anthropic secrets must never be exposed through `NEXT_PUBLIC_*`.
- Stripe webhook points to the real Katedra `/api/webhook` endpoint.

Known configuration debt:

- Katedra's legacy vanilla engine still points to the current Lekta Netlify production URL in code.
- Lekta reverse handoff supports `VITE_KATEDRA_URL` and otherwise falls back to `https://katedra.hr` outside localhost.
- Resolve URL configuration before a future public-domain cutover; do not perform an ad-hoc URL edit during this database release.

---

## 5. Required CI immediately before merge

### Lekta PR #25

Required green:

- Netlify deploy preview
- Foundation check
- Node 20 build gate
- Node 24 build gate
- full conformance matrix
- DOCX smoke
- security audit

### Katedra PR #1

Required green:

- Foundation check (`tsc`, lint, production build)
- Foundation DB migration (PostgreSQL 16), including ownership hardening smoke
- Academic Suite browser E2E including the real-DOCX segment

---

## 6. Coordinated promotion order

After every DB postcheck passes:

1. Confirm Lekta PR #25 current-head CI is green.
2. Confirm Katedra PR #1 current-head CI is green.
3. Merge/promote Lekta integration changes.
4. Merge/promote Katedra foundation changes immediately after.
5. Verify Katedra opens Lekta with `project`, `unit`, and `work` context.
6. Verify Lekta result shows `Riješi u Katedri` in the visible result shell.
7. Verify a new/updated Katedra project appears in both `katedra_projects` and the shared `academic_projects`/`katedra_project_state` mirror during the compatibility period.

---

## 7. Manual post-deploy smoke

Use a disposable project and a non-sensitive Word document.

1. Open Katedra as a guest.
2. Confirm a UUID `projectId` is created.
3. Select FPZG + diplomski context.
4. Open Lekta.
5. Confirm FPZG + graduate context is preselected.
6. Upload the test `.docx` using the visible upload flow.
7. Run real local Lekta analysis.
8. Confirm `Riješi u Katedri` is visible.
9. Return to Katedra; stable findings must appear.
10. Mark one finding changed.
11. Start re-check; status becomes `RECHECK_REQUIRED`.
12. Re-check without fixing: finding reopens as `OPEN`.
13. Fix and re-check: disappearance can become `VERIFIED_FIXED`.
14. Confirm the cross-product payload contains no raw document text/detail/location.
15. If signed in, confirm the project has one `academic_projects` row and one matching `katedra_project_state` row.

---

## 8. Rollback principle

Both migrations are additive. Application rollback normally means reverting application deployment while leaving shared tables and compatibility columns/triggers in place.

Do **not** drop `academic_projects`, `katedra_project_state`, `lekta_checks`, or `entitlements` during an emergency app rollback without a separate reviewed data migration.

Because Katedra continues writing the legacy compatibility table in v0.1, rollback to pre-foundation application code does not require reverse data conversion.

---

## 9. Release complete

Foundation v0.1 is production-complete only when:

- both shared Supabase migrations applied in order;
- all post-migration SQL gates pass;
- both PR CI sets are green;
- paired production deployment completed;
- one manual non-sensitive DOCX round-trip passes;
- shared project mirror is observed working in production;
- no privacy or ownership invariant is weakened.

After that, the next database milestone is to move Katedra `/api/state` from the compatibility table to direct `academic_projects + katedra_project_state` writes, then eventually retire `katedra_projects` after an observation window.
