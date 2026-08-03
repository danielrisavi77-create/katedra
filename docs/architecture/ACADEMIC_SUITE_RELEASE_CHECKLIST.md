# Lekta × Katedra — Production Release Checklist v0.1

Status: required release gate for the paired foundation PRs.

Paired changes:

- Katedra PR #1
- Lekta PR #25
- Katedra DB migration: `supabase/migrations/20260805000000_academic_suite_foundation.sql`

The technical preview gate is already proven by the cross-app Playwright workflow, including a real `.docx` analyzed by the deployed Lekta PR preview. This checklist covers the remaining production-only steps that CI cannot perform without the real Supabase/deployment credentials.

## 0. Release invariant

Do not deploy Katedra foundation code before the DB migration is applied.

Do not promote only one product and leave the paired cross-app protocol half-deployed longer than necessary.

Raw thesis content must never be introduced into the shared DB as part of this release.

---

## 1. Pre-migration database checks

Run these in the Katedra Supabase SQL editor before applying the migration.

### 1.1 Table exists

```sql
select to_regclass('public.katedra_projects') as katedra_projects;
```

Expected: `katedra_projects`.

### 1.2 Legacy work types are valid

```sql
select work_type, count(*)
from public.katedra_projects
group by work_type
order by work_type;
```

Expected existing vocabulary: only `s`, `z`, `d`.

Hard gate:

```sql
select count(*) as invalid_work_type_rows
from public.katedra_projects
where work_type is null or work_type not in ('s', 'z', 'd');
```

Expected: `0`.

### 1.3 Existing legacy project aliases are not duplicated per owner

```sql
select user_id, guest_project_id, count(*)
from public.katedra_projects
where guest_project_id is not null
  and guest_project_id <> ''
group by user_id, guest_project_id
having count(*) > 1;
```

Expected: zero rows.

### 1.4 Record baseline row count

```sql
select count(*) as project_rows_before
from public.katedra_projects;
```

Record this number. The foundation migration is additive and must not delete project rows.

---

## 2. Apply migration

Apply exactly:

```text
supabase/migrations/20260805000000_academic_suite_foundation.sql
```

Preferred options:

1. Supabase SQL editor, using the exact committed migration; or
2. `supabase db push` only if the local CLI is already linked to the correct production project.

Do not manually edit the SQL while pasting it into production. If a change is needed, change the committed migration first and rerun CI.

---

## 3. Post-migration database gates

Every hard gate below must pass before deploying Katedra code.

### 3.1 No rows lost

```sql
select count(*) as project_rows_after
from public.katedra_projects;
```

Expected: same value as `project_rows_before`.

### 3.2 Canonical columns exist and are populated

```sql
select
  count(*) filter (where project_id is null or project_id = '') as missing_project_id,
  count(*) filter (where work_type_canonical is null or work_type_canonical = '') as missing_work_type_canonical,
  count(*) filter (where contract_version is null or contract_version = '') as missing_contract_version
from public.katedra_projects;
```

Expected: `0, 0, 0`.

### 3.3 Legacy → canonical work-type mapping is exact

```sql
select count(*) as bad_work_type_mapping
from public.katedra_projects
where (work_type = 's' and work_type_canonical <> 'seminar')
   or (work_type = 'z' and work_type_canonical <> 'final')
   or (work_type = 'd' and work_type_canonical <> 'graduate');
```

Expected: `0`.

### 3.4 Canonical vocabulary contains no unexpected values

```sql
select work_type_canonical, count(*)
from public.katedra_projects
group by work_type_canonical
order by work_type_canonical;
```

Current Katedra rows should map to `seminar`, `final`, or `graduate`. The schema additionally permits future shared types: `specialist`, `doctoral`, `article`, `project`.

### 3.5 No duplicate canonical ID per owner

```sql
select user_id, project_id, count(*)
from public.katedra_projects
group by user_id, project_id
having count(*) > 1;
```

Expected: zero rows.

### 3.6 New UUID project IDs are globally unique

```sql
select project_id, count(*)
from public.katedra_projects
where project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
group by project_id
having count(*) > 1;
```

Expected: zero rows.

### 3.7 Required indexes exist

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'katedra_projects'
  and indexname in (
    'katedra_projects_user_project_idx',
    'katedra_projects_canonical_uuid_idx'
  )
order by indexname;
```

Expected: both index names.

### 3.8 Canonical work-type constraint exists

```sql
select conname
from pg_constraint
where conrelid = 'public.katedra_projects'::regclass
  and conname = 'katedra_projects_work_type_canonical_check';
```

Expected: one row.

### 3.9 No academic document-content column was added by this migration

Review the actual columns:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'katedra_projects'
order by ordinal_position;
```

The foundation adds only:

- `project_id`
- `work_type_canonical`
- `contract_version`

It does not add `.docx`, document text, issue detail/location text, source passages, or mentor-comment content.

---

## 4. Katedra production environment preflight

Verify these existing Katedra values in the deployment provider before promotion:

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

- `NEXT_PUBLIC_APP_URL` must be the real production Katedra origin used for redirects.
- The Supabase service-role key must remain server-only.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret, webhook secret, or Anthropic key through `NEXT_PUBLIC_*` variables.
- Confirm Stripe webhook points at the real Katedra `/api/webhook` endpoint.

Known v0.1 configuration debt:

- Katedra's legacy vanilla engine still has the current Lekta production URL hard-coded as `https://lektahr.netlify.app`.
- Lekta's new reverse handoff supports `VITE_KATEDRA_URL` and otherwise falls back to `https://katedra.hr` outside localhost.
- Before changing either public domain, make the corresponding URL configurable/tested rather than editing URLs ad hoc during deployment.

This URL debt does not invalidate the v0.1 protocol; the existing Lekta Netlify production URL is still a valid destination. It must be resolved before a domain cutover.

---

## 5. CI gates immediately before merge

### Lekta PR #25

Required green:

- Netlify deploy preview
- Foundation check
- Node 20 build gate (`tsc + vitest + Vite build`)
- Node 24 build gate (`tsc + vitest + Vite build`)
- full conformance matrix
- DOCX smoke
- security audit

### Katedra PR #1

Required green:

- Foundation check
- Academic Suite browser E2E

The E2E must include the real-DOCX segment, not only the synthetic result lifecycle.

---

## 6. Coordinated promotion order

After the DB postchecks pass:

1. Ensure Lekta PR #25 current-head CI is green.
2. Ensure Katedra PR #1 current-head CI is green.
3. Merge/promote Lekta integration changes.
4. Merge/promote Katedra foundation changes immediately after.
5. Verify the production Katedra origin can open the production Lekta check with `project`, `unit`, and `work` parameters.
6. Verify the production Lekta result shows `Riješi u Katedri` in the visible result shell.

If the production deployment platform automatically deploys `master`, coordinate the merges closely so the protocol versions do not remain mismatched.

---

## 7. Manual post-deploy smoke

Use a disposable test project and a non-sensitive Word document.

1. Open Katedra as a guest.
2. Confirm a UUID `projectId` is created.
3. Select FPZG + diplomski context.
4. Open Lekta from the project.
5. Confirm FPZG and graduate work type are preselected.
6. Upload the test `.docx` through the normal visible upload flow.
7. Run real local Lekta analysis.
8. Confirm `Riješi u Katedri` is visible without unlocking hidden detailed-report content.
9. Return to Katedra and confirm findings appear with stable IDs.
10. Mark one finding as changed.
11. Initiate re-check and confirm `RECHECK_REQUIRED`.
12. Re-check without fixing it: it must reopen as `OPEN`.
13. Fix the document and re-check again: disappearance may become `VERIFIED_FIXED`.
14. Confirm no raw document or document-derived free-form detail appears in the cross-product payload.

---

## 8. Rollback principle

The DB migration is additive, so application rollback should normally mean reverting application deployment while leaving the new columns/indexes in place. Do not drop the canonical columns during an emergency app rollback unless there is a separately reviewed data migration.

Old Katedra code continues using legacy `guest_project_id` and `work_type`; the new columns are therefore intentionally safe to leave present.

---

## 9. Release complete

Foundation v0.1 is production-complete only when:

- DB migration applied;
- all post-migration SQL gates pass;
- both PR current-head CI sets are green;
- paired production deployment completed;
- one manual non-sensitive DOCX round-trip passes;
- no privacy invariant is weakened.

After that, the next product milestone may begin: shared-account UX / canonical project dashboard / ecosystem entitlements (Diplomski Pass), without revisiting the v0.1 project/result protocol.
