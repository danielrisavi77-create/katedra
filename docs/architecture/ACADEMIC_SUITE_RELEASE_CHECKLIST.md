# Lekta × Katedra — Production Release Checklist v0.1

Target database: existing **Lekta Supabase** (`zrrjttizjyfcxmcpgzml`).

Schema authority: `danielrisavi77-create/Lekta`.

Paired PRs:

- Lekta PR #25
- Katedra PR #1

Authoritative migrations:

1. `Lekta/supabase/migrations/0035_academic_suite_foundation.sql`
2. `Lekta/supabase/migrations/0036_academic_suite_rls_hardening.sql`

Katedra-side migration files are not production authority.

## 0. Release invariant

Do not point the production Katedra deployment at Lekta Supabase until both migrations are applied and verified.

Do not create a second `entitlements` or `products` model. The existing Lekta commerce tables remain authoritative.

## 1. Preflight on Lekta Supabase

Run against project `zrrjttizjyfcxmcpgzml`.

### Existing commerce exists

```sql
select to_regclass('public.products'),
       to_regclass('public.entitlements'),
       to_regclass('public.document_slots');
```

Expected: all non-null.

### No conflicting Academic Suite tables

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'academic_projects','katedra_project_state','lekta_checks',
    'katedra_projects','katedra_wallets','katedra_topups','katedra_usage'
  );
```

Before first rollout, expected: zero rows.

### Record current counts

```sql
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.entitlements) as entitlements,
  (select count(*) from public.document_slots) as document_slots;
```

Record values for comparison after migration.

## 2. CI gates before production DDL

### Lekta PR #25

Required green:

- Academic Suite DB
- Foundation check
- standard Node 20/24 check
- conformance
- DOCX smoke
- security audit
- Netlify preview

### Katedra PR #1

Required green:

- Foundation check
- DB authority guard
- Academic Suite real-DOCX browser E2E

## 3. Apply database migrations

Apply `0035` then `0036` to the **Lekta Supabase** migration history.

Do not paste or edit a divergent copy from Katedra.

## 4. Post-migration hard gates

### Shared tables exist

```sql
select
  to_regclass('public.academic_projects') as academic_projects,
  to_regclass('public.katedra_project_state') as katedra_project_state,
  to_regclass('public.lekta_checks') as lekta_checks,
  to_regclass('public.katedra_projects') as katedra_projects,
  to_regclass('public.katedra_wallets') as katedra_wallets,
  to_regclass('public.katedra_topups') as katedra_topups,
  to_regclass('public.katedra_usage') as katedra_usage;
```

Expected: all non-null.

### Existing Lekta commerce survived

```sql
select count(*) from public.products;
select count(*) from public.entitlements;
select count(*) from public.document_slots;
```

Existing rows must not disappear.

### Project-aware commerce columns exist

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'entitlements' and column_name = 'academic_project_id') or
    (table_name = 'document_slots' and column_name = 'academic_project_id')
  )
order by table_name;
```

Expected: two rows.

### RLS enabled on new private tables

```sql
select relname, relrowsecurity
from pg_class
where oid in (
  'public.academic_projects'::regclass,
  'public.katedra_project_state'::regclass,
  'public.lekta_checks'::regclass,
  'public.katedra_projects'::regclass,
  'public.katedra_wallets'::regclass,
  'public.katedra_topups'::regclass,
  'public.katedra_usage'::regclass
)
order by relname;
```

Expected: `true` for every row.

### Commerce policies target authenticated

```sql
select tablename, policyname, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('entitlements','document_slots')
  and policyname in ('entitlements_select_own','document_slots_select_own')
order by tablename;
```

Expected role array: `{authenticated}`.

### Privacy invariant

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('academic_projects','katedra_project_state','lekta_checks')
  and column_name in (
    'docx','document','document_text','document_content','raw_document',
    'issue_detail','issue_location','mentor_comments','source_passages'
  );
```

Expected: zero rows.

### Run Supabase advisors

Run both security and performance advisors after the DDL. New WARN/ERROR findings caused by these migrations are release blockers.

## 5. Katedra runtime cutover

Update the Katedra deployment environment so these values point to the **Lekta Supabase** project:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY (or compatible publishable key when client migration is done)
SUPABASE_SERVICE_ROLE_KEY
```

The service-role key remains server-only and must never be committed to GitHub.

Also verify:

```text
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL
```

Katedra's Stripe wallet remains independent AI-credit accounting; Lekta `products/entitlements/document_slots` remain purchase/Pass authority.

## 6. Auth configuration

Because Katedra now uses Lekta Auth, add/verify Katedra production and callback URLs in the Lekta Supabase Auth redirect allowlist before production signup/login testing.

Separate root domains still require a future SSO/session-exchange layer for seamless cross-domain login.

## 7. Coordinated application promotion

1. DB migrations `0035` + `0036` applied and postchecks green.
2. Lekta PR #25 current-head CI green.
3. Katedra PR #1 current-head CI green.
4. Configure Katedra production env for Lekta Supabase.
5. Deploy/merge Lekta changes.
6. Deploy/merge Katedra changes immediately after.
7. Run one non-sensitive real-DOCX smoke.

## 8. Manual post-deploy smoke

1. Create/sign into one account through Lekta Supabase Auth.
2. Open Katedra with the same account.
3. Create a guest-first UUID project and save it after login.
4. Verify matching rows in `katedra_projects`, `academic_projects`, and `katedra_project_state`.
5. Open Lekta from Katedra with project/unit/work context.
6. Upload a non-sensitive test `.docx` and run local analysis.
7. Confirm `Riješi u Katedri` is visible.
8. Return to Katedra and verify stable finding IDs.
9. Mark one finding changed and re-check without fixing: it must reopen.
10. Fix it and re-check: disappearance may become `VERIFIED_FIXED`.
11. Confirm no raw document text crossed into shared Supabase.

## 9. Rollback principle

The shared migration is additive. If an application deploy fails, roll back application code first; do not drop shared tables or existing Lekta commerce.

Do not reverse or truncate `products`, `entitlements`, `document_slots`, or existing Lekta production data as part of an app rollback.

## 10. Foundation complete

Foundation v0.1 is production-complete when:

- Lekta Supabase contains the shared project/Katedra tables;
- existing Lekta commerce remains intact;
- both CI suites are green;
- Katedra uses Lekta Supabase env values;
- Auth redirects are configured;
- one real browser/DOCX round-trip passes in production;
- security advisors show no new blocker from the foundation migrations.
