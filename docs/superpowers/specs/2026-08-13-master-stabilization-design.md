# Master Stabilization Design

**Date:** 2026-08-13  
**Status:** Approved for implementation

## Goal

Make the current Katedra master reproducible for local development and release validation, while preserving the Academic Suite architecture, the Lekta Supabase schema authority, and the existing application behavior.

## Scope

This stabilization pass covers:

- a factual audit report for the current repository;
- a repeatable stabilization checklist;
- environment-variable documentation aligned with actual runtime references;
- alignment of README, prelaunch, local Supabase, and release documentation;
- explicit npm verification scripts for typecheck and CI tests;
- validation with clean dependency installation, typecheck, lint, tests, production build, and a local smoke check where the environment permits.

This pass does not redesign or refactor auth, checkout, webhook, chat, project-state, or Academic Suite contracts. It does not add database DDL, change production schema authority, alter payment behavior, or activate deferred production features.

## Current evidence

The initial audit found:

- `npm test -- --run`: 3 test files and 10 tests passed;
- `npx tsc --noEmit`: passed;
- `npm run build`: passed;
- `npm run lint`: passed after isolating an initial command timeout;
- runtime environment references include `RESEND_API_KEY` and `WITHDRAWAL_FROM_EMAIL`, but they are missing from `.env.example`;
- `supabase/migrations/20260805010000_academic_suite_foundation_hardening.sql` is explicitly a deprecated no-op marker, consistent with the documented Lekta migration authority;
- Git is not available in the current execution environment, so branch/status/fetch checks cannot be performed here.

## Design

### 1. Documentation as the stabilization artifact

Create `docs/stabilization-report.md` as the single audit record. It will contain the verified command results, runtime assumptions, environment inventory, known blockers, and P0-P3 classification.

Create `docs/stabilization-checklist.md` as the short repeatable procedure for a future developer or release operator. It will point to exact commands and include expected outcomes without embedding secrets.

Update the existing README, `PRELAUNCH.md`, `docs/LOCAL_DEVELOPMENT.md`, deployment documentation, and Supabase pointer documentation only where their facts conflict with the current repository or with one another. Preserve historical release evidence and label it with its verification date.

### 2. Environment contract

Keep the existing public Supabase URL and publishable client key in `.env.example` because they are intentionally browser-safe and already part of the documented setup. Add the missing variable names with safe placeholders and explicit production warnings:

- `RESEND_API_KEY`;
- `WITHDRAWAL_FROM_EMAIL`.

Document `NODE_ENV` only as a runtime-provided value if it is needed for local behavior; do not add generated or platform-managed values unnecessarily. Never copy values from `.env.local` into tracked files.

### 3. Verification commands

Add these explicit npm scripts while retaining the existing commands:

```json
"typecheck": "tsc --noEmit",
"test:ci": "vitest run"
```

Use the explicit scripts in the checklist and report. `npm run build` remains the production build gate, and `npm run lint` remains the lint gate.

### 4. Database authority guard

Keep the local migration marker because it protects migration-history compatibility, but make its README and report wording unambiguous: it is not executable production DDL and the authoritative migration must be made in the Lekta repository first.

Do not delete the marker, add a competing migration, or modify SQL behavior in this pass.

### 5. Smoke validation

The local smoke check will verify that the production build can start and that the root page responds. Authenticated, Stripe, Anthropic, Resend, and live Supabase flows remain configuration-dependent and will be reported as manual/staging checks rather than faked locally.

The smoke procedure must not print secret values and must not upload or persist real document content.

## Error handling and priorities

- P0: build, install, or core runtime is blocked; security/secret exposure; violation of database authority.
- P1: a required launch flow is unavailable or unreproducible because of application/configuration mismatch.
- P2: documentation, developer workflow, or observability gap that does not block the application.
- P3: cleanup or nonessential improvement.

Each report item will include reproduction evidence, impact, owner/repository boundary, and the verification command that proves resolution.

## Files

Expected changes:

- Create `docs/stabilization-report.md`.
- Create `docs/stabilization-checklist.md`.
- Create `docs/superpowers/plans/2026-08-13-master-stabilization-plan.md`.
- Modify `.env.example`.
- Modify `package.json`.
- Modify factual sections of `README.md`, `PRELAUNCH.md`, `docs/LOCAL_DEVELOPMENT.md`, `docs/deployment/NETLIFY.md`, and `supabase/README.md` as required by the audit.

No application route, database schema, payment logic, auth contract, or chat implementation is expected to change.

## Acceptance criteria

1. A new developer can identify every application-read environment variable from tracked documentation without receiving a secret.
2. The repository documents that Lekta owns production Academic Suite migrations and the local SQL file is a no-op marker.
3. The stabilization checklist has exact install, typecheck, lint, test, build, and smoke commands.
4. The report records the current verified baseline and remaining environment-dependent launch blockers.
5. `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:ci`, and `npm run build` are run after changes; their actual exit status is recorded.
6. No tracked file contains a server-only secret or raw document content.
