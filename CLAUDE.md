# Katedra — Claude Code Project Instructions

## Product role

Katedra is the academic content and process copilot in the Lekta × Katedra Academic Suite.

Katedra owns:
- topic and research planning;
- research questions and hypotheses;
- structure and writing workflow;
- argumentation, methodology, evidence quality and clarity;
- mentor-feedback workflows;
- progress, deadlines and defense preparation;
- explanation and resolution planning for findings produced by Lekta.

## Mandatory product boundary

Lekta is the exclusive technical/document verification authority.

Katedra MUST NOT:
- implement a competing DOCX technical validator;
- issue its own technical/compliance score;
- claim margins, fonts, styles, Word fields, TOC/SEQ/REF, citation mechanics or bibliography mechanics are formally correct;
- mark a deterministic Lekta finding `VERIFIED_FIXED` without a fresh Lekta analysis;
- represent LLM judgment as deterministic document verification.

Katedra may explain a Lekta finding and help the user fix it, but the re-check belongs to Lekta.

## Database authority

The existing Lekta production Supabase project is the single Academic Suite Auth/database authority.

This repository MUST NOT become a production schema authority.

Do not add production Academic Suite DDL or new production migrations here. If a feature requires a schema change, implement the authoritative migration in the Lekta repository first, then update Katedra to consume the shared contract.

Shared canonical identifiers and contracts must be preserved, especially:
- `auth.users.id` for account identity;
- `academic_projects.id` for project identity;
- `LektaResult` / handoff schema versioning;
- Academic Suite project and entitlement contracts.

Cross-product contract changes require coordinated Lekta + Katedra updates and an end-to-end handoff test before merge.

## Source of truth and Git workflow

GitHub `master` is the canonical stable version. A laptop, chat session or Claude session is never the source of truth.

Before starting substantive work:
1. Run `git status`.
2. Ensure existing work is committed or intentionally stashed.
3. Run `git fetch origin`.
4. Start from current `master`.
5. Create a dedicated branch such as `claude/<short-task-name>` or `feature/<short-task-name>`.

Do not develop directly on `master`.

Never force-push `master`, run destructive history rewrites, or discard uncommitted user work.

If local changes predate a newer `master`, preserve them on their own branch first and merge/rebase intentionally. Resolve conflicts by preserving the current Academic Suite architecture and product boundary while integrating the feature.

## Validation before proposing merge

For code changes, run at minimum:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Run relevant browser/integration tests when changing Auth, `/api/state`, Academic Suite handoff, project identity, or Lekta integration.

A green local build does not replace GitHub CI. Use a pull request for substantive changes.

## Secrets and environment

Never print, commit, expose or copy secret values from local environment files.

Do not commit `.env.local` or other `.env*` runtime secret files. Public browser variables may be documented by name, but server-only credentials stay in deployment/local secret stores.

Currently deferred production features must not be silently activated by code changes: AI chat, Stripe payments and server-admin billing paths require their explicit server secrets and a separate release decision.

## Working style

Prefer small, reviewable changes over broad rewrites.

Before changing architecture, inspect existing files under `docs/architecture/` and `lib/academic-suite/`.

When a requested feature appears to cross the Katedra/Lekta boundary, stop implementation long enough to classify it as content/process assistance versus technical/document verification. Technical verification belongs to Lekta.

Do not replace working shared-foundation compatibility code merely for stylistic cleanup unless the migration path and regression coverage are explicit.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
