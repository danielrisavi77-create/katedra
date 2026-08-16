# Lekta × Katedra — Production Release Checklist v0.1

Target database: existing **Lekta Supabase** (`zrrjttizjyfcxmcpgzml`).

Schema authority: `danielrisavi77-create/Lekta`.

Paired PRs:

- Lekta PR #25
- Katedra PR #1

## 0. Current release status — 2026-08-03

The shared database phase is **COMPLETE on the live Lekta Supabase project**.

Applied authoritative migrations:

1. `Lekta/supabase/migrations/0035_academic_suite_foundation.sql`
2. `Lekta/supabase/migrations/0036_academic_suite_rls_hardening.sql`
3. `Lekta/supabase/migrations/0037_academic_suite_api_grants.sql`
4. `Lekta/supabase/migrations/0038_academic_suite_least_privilege_grants.sql`
5. `Lekta/supabase/migrations/0039_academic_suite_permanent_account_gate.sql`
6. `Lekta/supabase/migrations/0040_academic_suite_performance_indexes.sql`

Katedra-side migration files are not production authority.

Live verification completed:

- existing Lekta commerce survived unchanged;
- shared/Katedra tables exist;
- `entitlements` and `document_slots` were extended, not replaced;
- RLS is enabled on all new private tables;
- browser roles use least-privilege table grants;
- `katedra_consume` / `katedra_grant` are service-role-only;
- ownership validation triggers are installed;
- forbidden document-content columns are absent;
- rollback-only live mirror smoke passed and left zero test rows;
- Supabase TypeScript type generation succeeds against the live schema;
- the only new unindexed-FK advisor finding was fixed by `0040`.

The remaining release blockers are **application/runtime configuration**, not database DDL:

1. point the Katedra deployment environment at the Lekta Supabase project;
2. add Katedra callback/production URLs to the Lekta Supabase Auth redirect allowlist;
3. confirm final current-head CI for both PRs;
4. coordinated merge/deploy;
5. one manual non-sensitive production DOCX round-trip.

---

## 1. Canonical backend model

```text
Lekta Supabase
│
├── auth.users                       shared identity
├── academic_projects                shared academic project identity
├── katedra_project_state            Katedra workflow state
├── lekta_checks                     sanitized deterministic history
├── entitlements                     existing Lekta commerce authority
├── document_slots                   existing Lekta document binding
├── products                         existing Lekta product catalog
├── katedra_wallets                  Katedra AI-credit accounting
├── katedra_topups
├── katedra_usage
└── katedra_projects                 temporary Katedra v1 compatibility path
```

There is no second Katedra Supabase project in the target architecture.

Raw `.docx` files and document body text are not part of this shared backend foundation.

---

## 2. Database migration record — COMPLETE

### `0035_academic_suite_foundation`

Creates shared project identity, Katedra state/accounting, sanitized Lekta check history, and the temporary Katedra compatibility path. Extends the existing Lekta `entitlements` and `document_slots` with optional `academic_project_id` links.

### `0036_academic_suite_rls_hardening`

Narrows existing private Lekta commerce read policies to the authenticated role while preserving owner predicates.

### `0037_academic_suite_api_grants`

Introduces explicit Data API intent for Academic Suite surfaces.

### `0038_academic_suite_least_privilege_grants`

Resets inherited/default table privileges and grants only what browser roles actually need. Anonymous users have no table privileges on private Academic Suite/account tables. Authenticated users have:

- owner CRUD on project/state compatibility surfaces;
- SELECT-only on deterministic history, wallet/accounting, entitlements, and document slots.

### `0039_academic_suite_permanent_account_gate`

Lekta intentionally uses Supabase anonymous Auth for repair flows. Anonymous Auth users still carry the PostgreSQL `authenticated` role, so the new Katedra/shared project/account surfaces additionally use a restrictive `is_anonymous = false` gate.

This gate applies only to new Academic Suite/Katedra account data. Existing Lekta anonymous-repair semantics remain intact.

Supabase Advisor may still report `auth_allow_anonymous_sign_ins` for these new tables because it sees policies targeting the `authenticated` role; the migration smoke explicitly executes both `is_anonymous=true` and `is_anonymous=false` JWT cases and verifies the restrictive policy semantics.

### `0040_academic_suite_performance_indexes`

Adds the covering ownership/time index for `katedra_topups.user_id`, removing the only new unindexed-FK advisor finding introduced by this foundation.

---

## 3. Live post-migration evidence — COMPLETE

Confirmed on `zrrjttizjyfcxmcpgzml`:

- `academic_projects` exists;
- `katedra_project_state` exists;
- `lekta_checks` exists;
- `katedra_projects` exists;
- `katedra_wallets`, `katedra_topups`, `katedra_usage` exist;
- `entitlements.academic_project_id` exists;
- `document_slots.academic_project_id` exists;
- all new private tables have RLS enabled;
- `katedra_consume` and `katedra_grant` are executable only by `service_role`;
- owner validation triggers exist on Lekta checks, entitlements, document slots, and Katedra compatibility writes;
- privacy-column query returns zero prohibited document-content columns.

A rollback-only live transaction inserted a disposable Katedra project for an existing permanent user, verified that `academic_projects` and `katedra_project_state` mirrors were created, then rolled back. Post-rollback row counts for the test ID were zero.

---

## 4. Katedra runtime cutover — PENDING

The Katedra deployment environment must point to the **same Lekta Supabase project**:

```text
NEXT_PUBLIC_SUPABASE_URL=https://zrrjttizjyfcxmcpgzml.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<active Lekta publishable/compatible client key>
SUPABASE_SERVICE_ROLE_KEY=<Lekta service-role secret, server-only>
```

Do not paste or commit the service-role key. Set it only in the hosting provider's protected environment/secret store.

Katedra `.env.example` is pinned to the Lekta project URL and contains placeholders only.

Also verify existing Katedra config:

```text
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL
```

Katedra's Stripe wallet remains independent AI-compute accounting. Lekta `products/entitlements/document_slots` remain the cross-product purchase/Pass authority.

---

## 5. Auth redirect configuration — PENDING

Because Katedra now authenticates against Lekta Auth, add the actual Katedra production URL and callback URL to the **Lekta Supabase Auth redirect allowlist**.

At minimum verify the callback used by Katedra:

```text
https://<katedra-production-domain>/auth/callback
```

and the production application origin used by login/reset flows.

Do not disable Lekta anonymous Auth globally: Lekta intentionally uses anonymous users for its repair/storage lifecycle. New Katedra/shared project data is protected separately by the permanent-account RLS gate.

Separate root domains still require a later SSO/session-exchange layer for seamless cross-domain login. Sharing the same Supabase Auth user store is already in place.

---

## 6. Required current-head CI before merge

### Lekta PR #25

Required green:

- Academic Suite DB
- Foundation check
- standard Node 20/24 check
- conformance
- DOCX smoke
- security audit
- Netlify deploy preview

### Katedra PR #1

Required green:

- Foundation check
- DB authority guard
- Academic Suite real-DOCX browser E2E

---

## 7. Coordinated promotion order

After runtime env and Auth redirects are configured:

1. Confirm Lekta PR #25 current-head CI is all green.
2. Confirm Katedra PR #1 current-head CI is all green.
3. Merge/deploy Lekta PR #25.
4. Merge/deploy Katedra PR #1 immediately after.
5. Verify Katedra production uses project ref `zrrjttizjyfcxmcpgzml`.
6. Run one non-sensitive real-DOCX production smoke.

Do not create a second entitlement/product authority during or after promotion.

---

## 8. Manual post-deploy smoke

1. Create/sign into one **permanent** account through Lekta Supabase Auth.
2. Open Katedra using the same account backend.
3. Create a guest-first UUID project and save it after login.
4. Verify matching rows in `katedra_projects`, `academic_projects`, and `katedra_project_state`.
5. Open Lekta from Katedra with project/unit/work context.
6. Upload a non-sensitive test `.docx` and run local analysis.
7. Confirm `Riješi u Katedri` is visible.
8. Return to Katedra and verify stable finding IDs.
9. Mark one finding changed and re-check without fixing: it must reopen.
10. Fix it and re-check: disappearance may become `VERIFIED_FIXED`.
11. Confirm no raw document body text is stored in the new shared tables.

---

## 9. Existing Lekta advisor backlog

The live Lekta Supabase already had advisor findings before Academic Suite rollout, including older unindexed foreign keys, RLS init-plan warnings, some public/security-definer function warnings, `pg_net` in `public`, and leaked-password protection disabled.

Those are existing Lekta security/performance backlog items and are not silently folded into this foundation release. They should be handled in focused follow-up migrations/audits rather than widening the Katedra integration release scope.

---

## 10. Rollback principle

The Academic Suite database migrations are additive. If an application deployment fails, roll back application code first; do not drop the shared tables or mutate existing Lekta commerce data.

Do not reverse or truncate `products`, `entitlements`, `document_slots`, or existing Lekta production data as part of an application rollback.

---

## 11. Foundation complete

Foundation v0.1 is production-complete when:

- [x] Lekta Supabase contains the shared project/Katedra tables;
- [x] existing Lekta commerce remains intact;
- [x] live DB migration history contains `0035` through `0040`;
- [x] live rollback-only project mirror smoke passes;
- [x] least-privilege table grants and service-role-only Katedra RPCs are verified;
- [x] privacy schema invariant passes;
- [ ] both PR final-head CI suites are green;
- [ ] Katedra production environment points to Lekta Supabase;
- [ ] Katedra URLs are in Lekta Auth redirect allowlist;
- [ ] paired production deployment is complete;
- [ ] one real production browser/DOCX round-trip passes.
