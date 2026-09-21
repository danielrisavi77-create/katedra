# Katedra V2-001 Test & Contract Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real test gate to Katedra, bind server Supabase access to generated production types, and fix the Project Pass chat entitlement lookup so the same schema-drift bug cannot silently return.

**Architecture:** Keep `/api/chat` thin. Move project-Pass lookup into a typed repository whose database vocabulary is generated from the canonical Lekta Supabase project. The route consumes only `hasActiveProjectPass(...)`. The production behavior remains unchanged except that Pass detection uses the live schema: `user_id + academic_project_id + status + purchase_expires_at`.

**Tech Stack:** Next.js 16, TypeScript, Supabase JS, Vitest, canonical Supabase project `zrrjttizjyfcxmcpgzml`.

## Global Constraints

- Do not change Katedra/Lekta product authority boundaries.
- Do not create a new Supabase project or entitlement table.
- Do not migrate the live entitlement schema in V2-001.
- Do not use the designed future `Entitlement.scope/projectId/capabilities` interface as if it were the SQL schema.
- Canonical live entitlement project key is `academic_project_id`.
- An entitlement is usable only for its owner, its project, active status and a non-expired purchase window.
- No UI redesign in this PR.
- No Academic Context Compiler implementation in this PR.
- Every production behavior change follows RED -> verify RED -> GREEN -> verify GREEN -> refactor.

---

## File Structure

**Create**

- `lib/academic-suite/database.types.ts` — generated types from production Supabase; never hand-author table columns.
- `lib/academic-suite/repositories/entitlements.ts` — one typed repository function for active Project Pass lookup.
- `lib/academic-suite/repositories/entitlements.test.ts` — behavior tests for Pass semantics.

**Modify**

- `lib/supabase/admin.ts` — type the admin Supabase client with `Database` while keeping the service-role boundary server-only.
- `app/api/chat/route.js` — replace inline stale entitlement query with repository call.
- `package.json` — add `test` / `test:watch` and Vitest dev dependency.
- `package-lock.json` — update only through npm, never by manual editing.
- CI workflow used for ordinary Katedra PR validation — add unit tests before build.

**Do not modify**

- Lekta migrations.
- Stripe webhook semantics except if a test reveals a separate regression.
- `lib/academic-suite/contracts.ts` future Entitlement interface in this PR; it already documents that it is not the current SQL schema.

---

### Task 1: Install a deterministic unit-test gate

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `npm test` -> `vitest run`
- Produces: `npm run test:watch` -> `vitest`

- [ ] **Step 1: Establish the RED state**

Run:

```bash
npm test
```

Expected before implementation: FAIL because `package.json` has no `test` script.

- [ ] **Step 2: Install Vitest through npm**

Run:

```bash
npm install --save-dev vitest@4.1.10
```

Do not edit `package-lock.json` manually.

- [ ] **Step 3: Add scripts**

`package.json` scripts must contain:

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Keep existing `dev`, `build`, `start` and `lint` scripts.

- [ ] **Step 4: Verify GREEN for the runner**

Run:

```bash
npm test
```

Expected: Vitest starts successfully. Zero-test behavior may exit non-zero; if so proceed immediately to Task 2 and use its first test as the runner proof instead of weakening Vitest with `--passWithNoTests`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "test: add Vitest foundation"
```

---

### Task 2: Generate the database contract from canonical production

**Files:**
- Create: `lib/academic-suite/database.types.ts`
- Modify: `lib/supabase/admin.ts`

**Interfaces:**
- Produces: `Database` type generated from `zrrjttizjyfcxmcpgzml`.
- Produces: typed admin client whose `.from('entitlements')` column names are compile-time checked.

- [ ] **Step 1: Generate types, do not hand-write them**

Use the authenticated Supabase tooling for project `zrrjttizjyfcxmcpgzml` and write its exact generated TypeScript output to:

```text
lib/academic-suite/database.types.ts
```

The generated `entitlements.Row` must contain at least:

```text
id
user_id
work_type
slots_total
slots_used
status
order_id
provider
created_at
purchase_expires_at
product_id
academic_project_id
```

and must not contain SQL columns named:

```text
project_id
scope
capabilities
source_product_id
```

- [ ] **Step 2: Type the server admin client**

Change `lib/supabase/admin.ts` so its Supabase client is instantiated as `createClient<Database>(...)` using the generated type import.

Do not expose the service-role key to client code and do not move this module out of the server-only boundary.

- [ ] **Step 3: Verify the old bug is compile-invalid**

Create a temporary local scratch statement in the repository module or use the TypeScript language service to verify that a typed `entitlements` query containing:

```ts
.eq('project_id', projectId)
```

or

```ts
.eq('scope', 'academic-pass')
```

produces a TypeScript error. Remove the scratch statement before commit.

- [ ] **Step 4: Verify TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/academic-suite/database.types.ts lib/supabase/admin.ts
git commit -m "chore: bind Supabase client to production schema types"
```

---

### Task 3: Define active Project Pass semantics test-first

**Files:**
- Create: `lib/academic-suite/repositories/entitlements.ts`
- Create: `lib/academic-suite/repositories/entitlements.test.ts`

**Interfaces:**
- Produces:

```ts
export async function hasActiveProjectPass(
  db: TypedAdminClient,
  input: { userId: string; projectId: string; now?: Date },
): Promise<boolean>
```

The production implementation may omit an explicit exported `TypedAdminClient` alias if Supabase inference is cleaner, but the function behavior and input names above remain stable.

- [ ] **Step 1: Write the first failing behavior test**

Write a test named:

```ts
it('accepts an active non-expired entitlement bound to the same project', ...)
```

The test fixture must use actual SQL vocabulary:

```ts
{
  user_id: 'user-1',
  academic_project_id: 'project-1',
  status: 'active',
  purchase_expires_at: '2026-12-31T23:59:59.000Z'
}
```

Use the smallest test double necessary around the repository boundary; assert returned behavior, not internal mock call count.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- lib/academic-suite/repositories/entitlements.test.ts
```

Expected: FAIL because `hasActiveProjectPass` does not exist.

- [ ] **Step 3: Implement the minimal query**

The repository query must constrain:

```ts
.eq('user_id', userId)
.eq('academic_project_id', projectId)
.eq('status', 'active')
.gt('purchase_expires_at', now.toISOString())
.limit(1)
.maybeSingle()
```

Select only the minimal field required to establish existence, e.g. `id`.

Do not filter by `scope`; the current live schema has no such column.

- [ ] **Step 4: Verify GREEN**

Run the focused test again and confirm PASS.

- [ ] **Step 5: Add the expiry behavior RED test**

Add:

```ts
it('rejects an expired entitlement', ...)
```

The fixture expiry is before `now`.

Run the focused test and verify the new case fails for the expected reason before implementation changes.

- [ ] **Step 6: Make expiry behavior GREEN**

Keep the production query constrained by `purchase_expires_at > now` and verify both tests pass.

- [ ] **Step 7: Add ownership/project isolation cases**

Add separate tests for:

```text
wrong user -> false
wrong academic_project_id -> false
non-active status -> false
no row -> false
```

Each test should express one behavior.

- [ ] **Step 8: Run suite**

```bash
npm test
```

Expected: all entitlement tests PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/academic-suite/repositories/entitlements.ts lib/academic-suite/repositories/entitlements.test.ts
git commit -m "feat: add typed Project Pass repository"
```

---

### Task 4: Replace the stale chat entitlement query

**Files:**
- Modify: `app/api/chat/route.js`
- Test: `lib/academic-suite/repositories/entitlements.test.ts`

**Interfaces:**
- Consumes: `hasActiveProjectPass(...)`
- Preserves: existing wallet/free-starter behavior after Pass determination.

- [ ] **Step 1: Add a characterization assertion for route contract**

Add a small static/source contract test only if needed to prove the route imports the repository rather than querying stale column names directly. Prefer testing repository behavior and TypeScript types over brittle source-string assertions.

The production route must have no entitlement query containing:

```text
project_id
scope
PASS_SCOPES
```

- [ ] **Step 2: Verify RED against current route**

Before changing the route, verify the chosen route-level test/static contract fails because current `/api/chat` still contains the stale query.

- [ ] **Step 3: Replace inline lookup**

Replace the current Pass block with the equivalent of:

```js
let hasPass = false
if (projectId) {
  hasPass = await hasActiveProjectPass(db, { userId, projectId })
}
```

Delete the obsolete `PASS_SCOPES` constant.

- [ ] **Step 4: Verify focused tests**

Run:

```bash
npm test -- lib/academic-suite/repositories/entitlements.test.ts
```

Expected: PASS.

- [ ] **Step 5: Verify full local gate**

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

All must pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/chat/route.js lib/academic-suite/repositories/entitlements.test.ts
git commit -m "fix: use live Project Pass schema in chat gate"
```

---

### Task 5: Put unit tests in ordinary PR CI

**Files:**
- Modify: the ordinary Katedra PR validation GitHub Actions workflow that currently runs TypeScript/build checks.

**Interfaces:**
- Produces a blocking PR gate where domain/unit tests run before the production build.

- [ ] **Step 1: Add the CI test command**

After dependency installation and before build, add:

```yaml
- name: Unit tests
  run: npm test
```

Do not make this conditional on `workflow_dispatch` or a legacy foundation branch.

- [ ] **Step 2: Validate workflow syntax and local gate**

Run the existing workflow/lint validation available in the repository, then:

```bash
npm test
npm run lint
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows
git commit -m "ci: gate Katedra PRs on unit tests"
```

---

### Task 6: Production-shape smoke without production mutation

**Files:**
- Test: repository/contract tests only; no DB migration.

**Interfaces:**
- Confirms the deployed canonical schema contains the columns expected by V2-001 without inserting/updating production data.

- [ ] **Step 1: Read production information schema**

Against `zrrjttizjyfcxmcpgzml`, query `information_schema.columns` for `public.entitlements`.

Expected columns include:

```text
academic_project_id
user_id
status
purchase_expires_at
```

Expected absent columns:

```text
project_id
scope
```

- [ ] **Step 2: Verify generated types match**

Regenerate types and ensure there is no unexpected diff in `database.types.ts` after V2-001 implementation.

- [ ] **Step 3: Record evidence in PR description**

State that the query was read-only and that no production data or DDL was changed.

---

## V2-001 Definition of Done

V2-001 is complete only when all are true:

- `npm test` exists and passes;
- generated Supabase types are committed from canonical production;
- the admin Supabase client is typed;
- `/api/chat` no longer queries `project_id` or `scope` on `entitlements`;
- active Pass lookup uses `academic_project_id` and expiry;
- focused tests cover active, expired, wrong-user, wrong-project and inactive cases;
- TypeScript, lint and Next build pass;
- ordinary PR CI runs unit tests;
- no database migration occurred;
- no Katedra/Lekta product boundary changed.

## Following PRs

After V2-001 is merged, continue separately:

1. **V2-002 Workflow Authority** — Completion domain becomes canonical stage/task/mentor/deadline authority for Katedra.
2. **V2-003 Academic Context Compiler** — pure scope/coverage/policy compiler with precedence tests.
3. **V2-004 FPZG Data Migration** — FPZG becomes registry/rules data consumed by the generic compiler, eliminating resolver hardcoding.

Do not combine those into V2-001.
