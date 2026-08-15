# Autonomous product-completion audit

## Cycle: 2026-08-15bh

### Root cause selected

Priority: P1 CI external-dependency handling. The PR browser workflow ran the
Lekta integration E2E unconditionally even when `LEKTA_PREVIEW_URL` was not
configured. That made an otherwise valid local PR fail on a missing external
service rather than clearly separating local checks from the manual staging
gate.

### Fix

- Run the Lekta browser loop only when `LEKTA_PREVIEW_URL` is present.
- Keep the manual `workflow_dispatch` configuration check strict, so a manual
  release cannot silently skip the external journey.
- Add a workflow regression test for the conditional gate.

### Verification

- TDD red regression: PASS; the workflow test failed before the conditional
  was added.
- Focused workflow suite: PASS (3 tests).
- Full suite: PASS (141 test files, 496 passed, 4 skipped); typecheck, lint and
  production build: PASS.
- No shared schema or Lekta migration was introduced.

### Golden Journey impact

- G7-G10: PR CI no longer confuses absent external staging with a local code
  failure; manual release still requires the real Lekta preview and auth gate.
- G0-G6: no intended behavior change.

### Remaining issues

- The manual authenticated journeys remain unverified until staging
  credentials, Lekta preview and canonical RPCs are available.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15bg

### Root cause selected

Priority: P1 manual staging gate configuration. The GitHub browser workflow
invoked `preflight:agentic` but did not pass the required non-secret values
`KATEDRA_BILLING_RPC_CONTRACT` and `KATEDRA_RATE_LIMIT_STORE`. A manually
dispatched release gate would therefore fail even when all secret credentials
were present.

### Fix

- Pass `KATEDRA_BILLING_RPC_CONTRACT=v2` and
  `KATEDRA_RATE_LIMIT_STORE=supabase` in the browser workflow environment.
- Add workflow contract coverage so both values remain present and canonical.
- Keep secrets and provider credentials in GitHub secrets/variables rather than
  hard-coding them.

### Verification

- TDD red regression: PASS; the workflow test failed before both contract
  values were added.
- Focused workflow suite: PASS (2 tests).
- Full suite: PASS (141 test files, 495 passed, 4 skipped); typecheck, lint and
  production build: PASS.
- No shared schema or Lekta migration was introduced.

### Golden Journey impact

- G4-G10: manual staging gates can now reach the actual authenticated checks
  instead of failing on omitted non-secret contract configuration.
- G0-G3: no intended behavior change.

### Remaining issues

- The gate still correctly fails without real staging credentials, deployed
  Lekta RPCs and an available provider.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15bf

### Root cause selected

Priority: P2 browser release-gate reproducibility. The GitHub browser workflow
ran `npm ci` with Playwright 1.61.1 from the project lockfile, then installed a
different ephemeral Playwright 1.55.0 before running E2E. The release result
could therefore differ from the locally tested dependency graph.

### Fix

- Use the Playwright runner installed by `npm ci`.
- Keep browser runtime installation explicit with
  `npx playwright install --with-deps chromium`.
- Add a regression test preventing a second pinned Playwright version from
  returning to the release workflow.

### Verification

- TDD regression: PASS; the workflow contract now rejects the old ephemeral
  install and requires the lockfile runner.
- Focused workflow suite: PASS (1 test).
- Full suite: PASS (141 test files, 494 passed, 4 skipped); typecheck, lint and
  production build: PASS.
- No shared schema or Lekta migration was introduced.

### Golden Journey impact

- G7-G10: the browser release gate now tests against the same Playwright
  dependency version declared by the application.
- G0-G6: no intended behavior change.

### Remaining issues

- Authenticated browser journeys still require staging credentials and the
  canonical Lekta/Stripe environment.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15be

### Root cause selected

Priority: P1 agent-worker safety configuration. The internal worker endpoint
checked that agent runs were enabled and that billing/rate-limit settings were
valid, but did not independently require
`KATEDRA_PROJECT_LOCKS_ENABLED=true`. A manually inconsistent deployment could
therefore process an agent run without the server-side project-lock guard that
the paid workflow requires.

### Fix

- Require the project-lock flag directly in `/api/internal/agent-worker`.
- Return `503` before token, provider, database or worker processing when the
  lock contract is not enabled.
- Keep the deployment preflight requirement and route-level guard aligned.

### Verification

- TDD red regression: PASS; the route contract lacked any project-lock guard.
- Focused worker/config suite: PASS (7 tests).
- Full suite: PASS (140 test files, 493 passed, 4 skipped); typecheck, lint and
  production build: PASS.
- No shared schema or Lekta migration was introduced.

### Golden Journey impact

- G4-G6 and G9: a manually misconfigured worker cannot process paid runs
  without server-side project-lock enforcement.
- G0-G3, G7-G8 and G10: no intended behavior change.

### Remaining issues

- The canonical lock RPC, worker deployment and authenticated staging proof
  remain external requirements.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15bd

### Root cause selected

Priority: P1 temporary-material deletion safety. The delete route removed
private storage objects directly, but the canonical Lekta
`agent_payload_manifests` row could remain active because no deletion-tombstone
RPC exists yet. A later run could therefore attach a manifest whose storage
payload no longer exists.

### Fix

- Add an explicit `KATEDRA_MATERIAL_DELETE_RPC_CONTRACT=v1` release gate.
- Return `503` before authentication, ownership lookup or storage access when
  the canonical deletion contract is not enabled.
- Preserve the existing storage deletion code only as a post-contract path;
  the local change does not pretend to implement a Lekta migration or RPC.

### Verification

- TDD red regression: PASS; the route reached the ownership/storage path and
  returned a misleading not-found response before the guard.
- Focused deletion guard suite: PASS (1 test).
- No storage operation occurs while the canonical deletion contract is absent.
- The canonical tombstone RPC and staging proof remain external requirements.

### Golden Journey impact

- G7: material deletion now fails honestly instead of creating an orphaned
  canonical manifest/storage mismatch before Lekta contract activation.
- G0-G6 and G8-G10: no intended behavior change.

### Remaining issues

- Lekta must define/deploy the deletion tombstone RPC and the route must be
  connected to that exact contract before the new release gate is enabled.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15bc

### Root cause selected

Priority: P2 entitlement/catalog safety. The shared Katedra Pass filter
accepted every Stripe entitlement with a null `product_id`, even though the
shared entitlement table also supports work types outside the Katedra catalog.
That could make a Doktorski or another Lekta entitlement appear as a Katedra
Pass in project lookup, checkout duplicate detection or webhook reconciliation.

### Fix

- Require null-product legacy rows to have `seminarski`, `zavrsni` or
  `diplomski` `work_type` values.
- Continue accepting only the explicit canonical Katedra product IDs for
  non-null `product_id` rows.
- Use the same safe filter for entitlement authority, checkout, webhook and
  account export paths.
- Keep the existing JS account defense-in-depth normalization.

### Verification

- TDD red regression: PASS; a null-product `doktorski` entitlement was
  incorrectly accepted before the filter change.
- Focused affected-route suite: PASS (37 tests).
- Full suite: PASS (139 test files, 492 passed, 4 skipped); typecheck, lint and
  production build: PASS.
- No shared schema or Lekta migration was introduced.

### Golden Journey impact

- G3-G6: unrelated shared entitlements can no longer unlock or block a Katedra
  project through local project-pass checks, checkout duplicate detection or
  webhook reconciliation.
- G0-G2 and G7-G10: no intended behavior change.

### Remaining issues

- The atomic server-side project lock and canonical entitlement deployment
  still require Lekta/staging evidence.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15bb

### Root cause selected

Priority: P2 account export completeness. The account center exposed Pass
status and AI usage, but `GET /api/account/export` exported only the user and
project metadata. A user could therefore not export the same account-level
metadata shown in the account center, while the endpoint had no regression
test protecting the omission.

### Fix

- Export only the authenticated user's project metadata, catalog-valid Pass
  summaries and aggregate usage metadata.
- Normalize active Pass rows whose expiry is in the past to `expired` in the
  export response.
- Return warnings when optional Pass or usage queries are unavailable while
  still allowing the project metadata export.
- Keep manuscript text, prompts and temporary run payloads out of the export;
  the local manuscript remains local-only.

### Verification

- TDD red regression: PASS; the new export test failed because `passes` and
  `usage` were missing before the route change.
- Focused account export runtime suite: PASS (1 test).
- Full suite: PASS (139 test files, 491 passed, 4 skipped); typecheck, lint and
  production build: PASS.
- No shared schema or Lekta migration was introduced.

### Golden Journey impact

- G3: account export now includes the same owned Pass and usage metadata as the
  account center without exporting manuscript content.
- G0-G2 and G4-G10: no intended behavior change.

### Remaining issues

- Canonical entitlement deployment, authenticated commerce and billing proof
  still require Lekta/staging evidence.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15ba

### Root cause selected

Priority: P2 account/commercial catalog ambiguity. The account endpoint reused
the compatibility filter that accepts any Stripe entitlement with a null
`product_id`. Without a second `work_type` check, a non-Katedra entitlement in
the shared table could be displayed and counted as an active Katedra Pass.

### Fix

- Add an account-specific PostgREST filter: null-product legacy rows must use
  `seminarski`, `zavrsni` or `diplomski` work types.
- Keep non-null canonical Katedra product IDs accepted by product catalog.
- Add defense-in-depth normalization so malformed or unrelated rows are
  excluded even if a backend query returns them.
- Leave the shared entitlement compatibility filter unchanged for checkout,
  webhook and entitlement authority paths.

### Verification

- TDD red regression: PASS; an active null-product `doktorski` row was returned
  before the account-only guard.
- Focused account runtime suite: PASS (7 tests).
- Full suite: PASS (138 test files, 490 passed, 4 skipped); typecheck, lint and
  production build: PASS.
- No shared schema or Lekta migration was introduced.

### Golden Journey impact

- G3-G6: account summaries cannot turn an unrelated legacy entitlement into a
  displayed Katedra Pass; canonical checkout/webhook behavior is unchanged.
- G0-G2 and G7-G10: no intended behavior change.

### Remaining issues

- Canonical entitlement deployment, authenticated commerce and billing proof
  still require Lekta/staging evidence.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15az

### Root cause selected

Priority: P1 agentic proposal decision durability. The review panel kept
edited and rejected proposals only in React state. A later poll with another
worker result, or a dashboard remount, reconstructed the server result and
could restore the original verified proposal.

### Fix

- Store only local proposal overrides, keyed by `projectId` and `runId`, in
  browser `localStorage`; no proposal text enters shared state.
- Merge an edited or rejected proposal with later server results only when its
  `baseRevision` still matches.
- Drop the override when a newer server revision arrives, so old local text
  cannot mask a current result.
- Validate stored Tiptap nodes and status values before restoring them.
- Remount the dashboard when the project/run identity changes to avoid
  carrying review state into another run.

### Verification

- TDD red regression: PASS; the local edit reverted after a new result before
  the merge was implemented.
- Focused suite: PASS (11 tests across dashboard and run-recovery components),
  including poll merge and dashboard remount recovery.
- Full suite: PASS (138 test files, 489 passed, 4 skipped); typecheck, lint and
  production build: PASS.
- The local `/pisi` route remains available; authenticated worker payloads and
  staging continuation are still external concerns.

### Golden Journey impact

- G9: local review decisions now survive polling/remount without claiming that
  the server has accepted them.
- G5-G6/G10: generated sections remain reviewable and explicitly local until
  the user accepts a still-current verified proposal.
- G0-G4, G7-G8: no intended behavior change.

### Remaining issues

- Canonical worker execution, authenticated session recovery and billing
  reconciliation still require Lekta/staging evidence.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15ay

### Root cause selected

Priority: P1 G9 failed-run dead end. The agentic workspace treated a
`failed` run like a blocked run: recovery considered it resumable and the UI
offered context intervention, even though the context route only accepts
`paused` or `blocked`. The user could receive a 409 with no visible path to a
new workflow.

### Fix

- Remove `failed` from the statuses automatically resumed from the canonical
  run list when there is no local run marker.
- Keep an explicitly stored failed run visible as a terminal result so its
  error remains inspectable after reload.
- Treat only `blocked` as an intervention state.
- Add `failed` to the terminal actions that expose `Novi tijek`, which clears
  the project-scoped marker and returns to preparation.

### Verification

- TDD red test: PASS; the new dashboard and recovery regressions failed
  before the status split and reproduced the dead end.
- Focused suite: PASS (9 tests across dashboard and recovery components).
- Full suite: PASS (138 test files, 487 passed, 4 skipped); typecheck, lint and
  production build: PASS.
- Localhost `/pisi`: HTTP 200 with the Katedra workspace shell.
- Authenticated provider/worker failure recovery remains staging-dependent and
  was not represented as a local production proof.

### Golden Journey impact

- G9: a terminal provider/worker failure now has an honest recovery action
  instead of an invalid context-edit path.
- G5-G6/G10: users can start a fresh paid workflow after a failed run without
  silently mutating the failed run.
- G0-G4, G7-G8: no intended behavior change.

### Remaining issues

- Canonical worker execution, authenticated session recovery and billing
  reconciliation still require Lekta/staging evidence.
- Durable local edited/rejected proposal state is a separate P1 audit item.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15ax

### Root cause selected

Priority: P1 G9 stale active-run marker. The first recovery fix trusted a
project-scoped local run ID whenever one existed. If the server had already
removed or archived that run, a reload could still reopen a non-canonical
agent dashboard instead of recovering the current project state.

### Fix

- Always validate a stored run ID against the canonical
  `GET /api/agent-runs?projectId=...` list when that request succeeds.
- Remove the local marker when the canonical list no longer contains it.
- Fall back to the newest resumable server run and persist that ID locally.
- Retain the stored ID only when the server list request fails, preserving
  the best available offline/session fallback without inventing a run.

### Verification

- TDD regression: PASS; a stale local ID is discarded and the current paused
  server run is restored.
- Full suite: PASS (138 test files, 485 passed, 4 skipped); typecheck, lint and
  production build: PASS.
- The authenticated server continuation itself remains staging-dependent and
  was not represented as a local production proof.

### Golden Journey impact

- G9: reload recovery no longer trusts a stale local run marker when the
  canonical project-scoped run list is available.
- G5-G6/G10: paid workflows retain the latest valid run checkpoint locally
  while canonical worker continuation remains a staging concern.
- G0-G4, G7-G8: no intended behavior change.

### Remaining issues

- Canonical worker execution, authenticated session recovery and billing
  reconciliation still require Lekta/staging evidence.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15aw

### Root cause selected

Priority: P1 G9 active-run recovery. `PaidProjectSetup` kept its `runId` only
in component state. Although the server exposed project-scoped run listings,
the UI never queried them, so a reload, tab close or drawer unmount returned
the user to preparation and hid a still-running server-side workflow.

### Fix

- Persist newly created run IDs under a project-scoped localStorage key.
- On mount, restore that ID when available.
- When local state is absent, query `GET /api/agent-runs?projectId=...` and
  resume the newest resumable run (`pending`, `running`, `paused`, `blocked` or
  `failed`).
- Clear the project run marker when the user starts a new run.
- Keep the manuscript local-first; only the opaque run ID is stored locally.

### Verification

- TDD regression: PASS; the component previously stayed in preparation and now
  reopens the mocked active server run after mount.
- Full suite: PASS (138 test files, 484 passed, 4 skipped); typecheck, lint and
  production build: PASS.
- The authenticated server continuation itself remains staging-dependent and
  was not represented as a local production proof.

### Golden Journey impact

- G9: a reload/tab close no longer intentionally hides an active run in the
  UI; recovery falls back to the canonical project-scoped run list.
- G5-G6/G10: paid workflows can resume at their latest run checkpoint once
  staging is configured.
- G0-G4, G7-G8: no intended behavior change.

### Remaining issues

- Canonical worker execution, authenticated session recovery and billing
  reconciliation still require Lekta/staging evidence.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15av

### Root cause selected

Priority: P1 paid workflow dead end. The main agentic workspace passed
`acceptAgenticDraft` into `AgenticDashboard`, but the same `PaidProjectSetup`
opened from `Projekt → Agenti` received no callback. Its verified-result review
could therefore render an enabled-looking accept flow that made no manuscript
change.

### Fix

- Add the optional verified-draft callback to `ProjectDrawer`.
- Pass it into the drawer's `PaidProjectSetup` and from `WorkspaceClient`.
- Add component and wiring regressions proving the callback reaches the drawer
  agentic entry point.

### Verification

- TDD regression: PASS; the drawer wiring assertion failed before the fix and
  now passes.
- Component regression: PASS; opening the drawer's Agenti tab confirms the
  mocked setup receives the manuscript accept callback.
- Full suite: PASS (137 test files, 483 passed, 4 skipped); typecheck, lint and
  production build: PASS.

### Golden Journey impact

- G5-G6 and paid agentic workflow: verified results can be accepted regardless
  of whether the user entered through the top-level or project-drawer path.
- G0-G4 and G7-G10: no intended behavior change.

### Remaining issues

- Real paid run execution and acceptance still require canonical Lekta worker,
  billing/RPC and authenticated staging evidence.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15au

### Root cause selected

Priority: P1 G2 guest-to-account continuity. The Completion Scan offered
`/registracija?redirect=/pisi`, and the anonymous workspace header offered the
same generic login destination. Because the auth pages honor an explicit
redirect over their local-manifest fallback, either path could return a user
to a workspace without the current project's `projectId`.

### Fix

- Carry the canonical project ID through the Completion Scan registration link.
- Carry the canonical project ID through the anonymous workspace login link.
- Reuse `buildProjectAuthRedirect` so both destinations remain same-origin and
  safely encoded.
- Add component/source regressions for both entry points.

### Verification

- TDD regression: PASS; the registration redirect previously resolved to
  `/pisi` and now resolves to `/pisi?projectId=project-123`.
- Browser G2 continuity check: PASS locally; both registration and login links
  preserved the same generated project ID with no page errors.
- Full suite: PASS (135 test files, 481 passed, 4 skipped); typecheck, lint and
  production build: PASS.

### Golden Journey impact

- G2: guest auth entry points now preserve the active local project identity.
- G8: returning to the workspace remains project-specific.
- G0-G1 and G3-G10: no intended behavior change for valid project data.

### Remaining issues

- The authenticated Supabase registration/login attach flow remains
  `BLOCKED_EXTERNAL` until staging credentials and canonical project attachment
  evidence are available.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15at

### Root cause selected

Priority: P1 G9 malformed local-state recovery. Malformed JSON in legacy
storage was already ignored, but parsable values with the wrong runtime shape
(for example an object in `rp_manifest.topic`) were passed into migration and
could crash the React workspace during render.

### Fix

- Sanitize every legacy manifest value at the migration boundary.
- Accept only bounded non-empty strings for project identity, title, work type
  and migrated metadata.
- Fall back to a new local project ID and the default work type when legacy
  values are malformed.
- Add a regression covering object, array and numeric values in legacy
  manifest/state metadata.

### Verification

- TDD migration regression: PASS; malformed runtime values now produce a safe
  empty manuscript instead of leaking objects into the document model.
- Browser G9 recovery: PASS; contaminated `rp_manifest` and `rp_state` open a
  usable workspace with no `pageerror`, stuck boot screen or horizontal
  overflow.
- Full suite: PASS (134 test files, 479 passed, 4 skipped); typecheck, lint
  and production build: PASS.

### Golden Journey impact

- G9: malformed local state recovers to a usable local workspace.
- G0-G8 and G10: no intended behavior change for valid project data.

### Remaining issues

- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15as

### Root cause selected

Priority: P2 guest UX clarity. The landing page described the first step as
questions “in chat”, while the current product actually starts with a guided
onboarding form. That created an avoidable expectation mismatch before the
guest entered `/pisi`.

### Fix

- Change the step description to accurately describe guided questions about
  the academic work.
- Add a landing source regression preventing the old chat promise from
  returning.

### Verification

- TDD regression: PASS; the old copy failed the new assertion and the guided
  onboarding copy now passes.
- Browser verification: PASS; the rendered landing step contains the guided
  onboarding description and no chat promise.
- Full suite: PASS (134 test files, 478 passed, 4 skipped); typecheck, lint and
  production build: PASS.

### Golden Journey impact

- G0: the cold visitor receives an accurate explanation before starting free.
- G1-G10: no intended workflow behavior change.

### Remaining issues

- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15aq

### Root cause selected

Priority: P1 Completion Scan consistency. A user who pasted an existing draft
without manually toggling the optional material list was told both that the
text could be used and that an existing text, instructions or literature were
still missing.

### Fix

- Treat non-empty imported text as available draft material.
- Keep the material warning for projects with neither imported text nor a
  selected material.
- Add a regression for pasted text with an empty manual material list.

### Verification

- TDD regression: PASS; pasted text previously remained in `missing` and now
  removes that contradiction.
- Browser verification: PASS; the existing-text flow leaves only the mentor
  and deadline gaps in the missing section.
- Full suite: PASS (134 test files, 477 passed, 4 skipped); typecheck, lint and
  production build: PASS.

### Golden Journey impact

- G0-G1: the free plan now reports the guest's actual starting materials
  accurately.
- G2-G10: no intended behavior change.

### Remaining issues

- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15ap

### Root cause selected

Priority: P1 onboarding/lifecycle correctness for an existing draft. Choosing
“Imam tekst” left the default current state at `no_topic` unless the user
manually selected another state, so the summary and Completion Scan could
recommend defining a topic instead of continuing to write.

### Fix

- When the user chooses “Imam tekst”, infer `draft` only if the state is still
  the untouched `no_topic` default.
- Keep the current-state selector fully editable so the user can choose a
  different state afterward.
- Add a component regression for the default existing-text state.

### Verification

- TDD regression: PASS; the existing-text path previously selected `no_topic`
  and now selects `draft`.
- Browser verification: PASS; the flow reaches Completion Scan with the
  writing/revision next actions and preserves the entered title/text.
- Focused onboarding suite: PASS (9 tests).

### Golden Journey impact

- G1: existing-text users receive a truthful writing-oriented plan by default.
- G0 and G2-G10: no intended behavior change for new projects or explicit
  state selections.

### Remaining issues

- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15ao

### Root cause selected

Priority: P1 lifecycle correctness in the free `?screen=scan` entry flow.
The scan shortcut initialized the onboarding mode as `existing`, so an empty
scan could report that the user already had a draft even when no text had been
entered or imported.

### Fix

- Define `hasExistingDraft` from actual non-empty imported text only.
- Show the existing-draft strength only when text is present.
- Add a regression proving an empty scan cannot claim an existing draft while
  preserving the positive case for real imported text.

### Verification

- TDD regression: PASS; the empty `existing` scan reported a draft before the
  fix and no longer does.
- Browser verification: PASS; `/pisi?screen=scan&tip=d` no longer shows the
  false existing-text strength after completing the scan.
- Full suite: PASS (134 test files, 475 passed, 4 skipped); typecheck, lint
  and production build: PASS.
- Existing text regression: PASS; a non-empty imported draft remains detected.

### Golden Journey impact

- G1: Completion Scan now reflects the user's actual materials instead of the
  shortcut's default entry mode.
- G0 and G2-G10: no intended behavior change for valid project data.

### Remaining issues

- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15an

### Root cause selected

Priority: P0 checkout/project identity integrity. `/api/state` accepted a
non-string `topic`, while `validateCheckoutConfirmation` ignored a stored
project topic that was not a string. A contaminated project row could
therefore bypass the intended canonical-topic comparison immediately before
Stripe checkout.

### Fix

- Bound and type-check `unitId`, `profileId`, `topic` and `rulesetVersion` in
  `/api/state`, on both write and read.
- Reject control characters and topics longer than 500 characters.
- Make checkout fail closed for a non-string, malformed or oversized canonical
  stored topic, and validate the checkout topic before comparing it.
- Add direct checkout-validation regressions for malformed and oversized
  topics.

### Verification

- TDD state regression: PASS; non-string topic reached the upsert path before
  the fix and now returns 400 before writing.
- TDD checkout regression: PASS; malformed/oversized topics were accepted or
  misclassified before the fix and now fail closed.
- State focused suite: PASS (11 tests); checkout-validation suite: PASS (2
  tests).
- Full suite: PASS (134 test files, 474 passed, 4 skipped); typecheck, lint,
  production build and local `/pisi?tip=d` smoke: PASS.

### Golden Journey impact

- G2-G3: checkout cannot proceed with an invalid or ambiguous paid topic.
- G0-G1 and G4-G10: no intended behavior change for valid metadata.

### Remaining issues

- Existing contaminated project rows require canonical cleanup; the Katedra
  routes now refuse to use malformed topic values for checkout.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15am

### Root cause selected

Priority: P1 request-boundary hardening for the billable chat route. Message
and attachment validation ran only after parsing the complete JSON body. An
oversized request with unknown fields could therefore consume parser memory
before the semantic validator rejected it.

### Fix

- Reject authenticated chat requests whose declared `Content-Length` exceeds
  32 MiB before calling `req.json()`.
- Keep the existing message, attachment, input-character and cost ceilings as
  the authoritative semantic validation after the transport guard.
- Return a generic 413 without touching ownership, rate-limit or provider
  paths.

### Verification

- TDD regression: PASS; the new oversized-body test reached billing/provider
  setup before the guard and now returns 413 before JSON validation.
- Chat runtime suite: PASS (16 tests).
- Full suite: PASS (133 test files, 471 passed, 4 skipped); typecheck, lint,
  production build and local `/pisi?tip=d` smoke: PASS.
- The guard is defense in depth for requests without a usable content length;
  staging infrastructure should still enforce an upstream body limit.

### Golden Journey impact

- G0-G10: no intended behavior change for valid requests.
- Abuse resistance: oversized billable bodies are rejected before downstream
  work or billing reservation.

### Remaining issues

- Chunked requests without `Content-Length` still rely on the semantic parser
  and hosting-layer body limits; production deployment must configure both.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15al

### Root cause selected

Priority: P1 privacy and payload-integrity boundary in `/api/state`. The
legacy `checks` field was accepted and returned as arbitrary JSON even though
the current UI uses it only as a map of checklist IDs to booleans. That left a
second unbounded path for prompt, document or other free-form content to enter
shared project state.

### Fix

- Sanitize `checks` in both PUT and GET paths.
- Keep at most 500 short, control-character-free keys and boolean values.
- Drop text, nested objects, arrays and other unknown values.
- Preserve the existing ownership, lock and manuscript stripping guards.

### Verification

- TDD regression: PASS; contaminated `checks` input failed the new assertions
  before the sanitizer and passes after it.
- State route focused suite: PASS (10 tests).
- Full suite: PASS (133 test files, 470 passed, 4 skipped); typecheck, lint,
  production build and local `/pisi?tip=d` smoke: PASS.
- No database migration is required.

### Golden Journey impact

- G0-G10: no intended workflow change; checklist booleans continue to sync.
- Privacy: arbitrary `checks` payloads no longer cross the state boundary.

### Remaining issues

- Existing contaminated rows require canonical backend cleanup if present; the
  route now prevents their return through this projection and blocks new
  writes.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15ak

### Root cause selected

Priority: P0 institutional AI-policy enforcement. The chat route mapped
`paraphrase_for_submission` to the paid `section_writing` product capability,
but its policy guard only resolved and blocked the two explicit generation
capability names. A user could therefore send the paraphrase capability and
reach the provider despite a banned or unverified submission-writing policy.

### Fix

- Define one server-side set of policy-gated submission-writing capabilities.
- Resolve the exact capability for `paraphrase_for_submission`,
  `generate_submission_text` and `generate_large_sections`.
- Block all three before provider access when the policy is blocked and keep
  mentor acknowledgements bound to the exact resolved fact.

### Verification

- TDD runtime regression: PASS; the new paraphrase test reached the provider
  before the guard fix and now returns 403 with no provider call.
- Chat runtime suite: PASS (15 tests).
- Full suite: PASS (133 test files, 470 passed, 4 skipped); typecheck, lint,
  production build and local `/pisi?tip=d` smoke: PASS.
- Staging faculty-policy proof: still unavailable externally.

### Golden Journey impact

- G9-G10: switching from generation to paraphrase cannot bypass a prohibited
  submission-writing policy.
- G0-G8: no intended behavior change.

### Remaining issues

- Real institution policy facts and RLS still require staging proof; local
  tests cover the server control flow, not canonical policy deployment.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15aj

### Root cause selected

Priority: P0 privacy boundary in `/api/state`. The legacy `logf` column was
still selected, returned and accepted by the generic writable-field loop
without any sanitizer. A stale or malicious client could therefore place raw
prompt/response or document-derived JSON in shared project state.

### Fix

- Remove `logf` from the state read projection.
- Remove `logf` from the writable state allowlist.
- Add regressions proving sensitive `logf` input is not persisted and stored
  `logf` data is not returned.
- Keep all existing structured `gen`, `hist`, `log` and Lekta metadata
  sanitizers unchanged.

### Verification

- TDD regression: PASS; both new assertions failed before the allowlist fix and
  pass after it.
- State route focused suite: PASS (10 tests).
- Full suite: PASS (133 test files, 469 passed, 4 skipped); typecheck, lint,
  production build and local `/pisi?tip=d` smoke: PASS.
- No database migration is required; the legacy column remains untouched in
  the canonical backend but is no longer part of Katedra's sync contract.

### Golden Journey impact

- G0-G10: no intended product behavior change.
- Privacy/compliance: legacy state writes now fail closed for an otherwise
  unrecognized free-form field.

### Remaining issues

- Existing contaminated rows, if any, require canonical backend cleanup; this
  change prevents new reads/writes through Katedra but does not mutate old data.
- External Lekta, commerce, Docker/Supabase and dependency advisory blockers
  remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15ai

### Root cause selected

Priority: P0 paid-project billing idempotency. The webhook checked for an
existing entitlement before calling the canonical project-lock RPC. When two
paid sessions raced and the first lock existed before its entitlement insert
completed, the second webhook could attempt a conflicting lock, return 500 and
remain in Stripe retry instead of reconciling the duplicate payment.

### Fix

- Read the canonical project lock before creating a new one.
- Treat an existing lock with the same payment, topic and product as an
  idempotent retry and continue entitlement reconciliation.
- Treat a lock owned by another payment, or a lock with mismatched purchase
  identity, as a duplicate and issue the existing idempotent refund path.
- Keep refund failure fail-closed with a retryable reconciliation response.

### Verification

- TDD regression: PASS; the new lock-race test failed before the fix because
  the route attempted `lockPaidProject`, then passed after it refunded the
  duplicate session without granting wallet or entitlement.
- Webhook/project-lock focused suite: PASS (25 passed, 1 skipped).
- Full suite: PASS (133 test files, 469 passed, 4 skipped); typecheck, lint,
  production build and local `/pisi?tip=d` smoke: PASS.
- Staging Stripe/Lekta concurrency proof: still unavailable externally.

### Golden Journey impact

- G2-G3: a second payment cannot create a second project lock during the
  lock-before-entitlement race; it is refunded or left explicitly pending for
  reconciliation.
- G0-G1 and G4-G10: no intended behavior change.

### Remaining issues

- Atomic lock idempotency still requires deployment and proof of the canonical
  Lekta RPC/RLS contract; this route is defense in depth, not a replacement.
- External commerce, Lekta staging, Docker/Supabase and dependency advisory
  blockers remain `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15ah

### Root cause selected

Priority: P0/P1 institutional AI-policy enforcement. Chat mapped both
`generate_large_sections` and `generate_submission_text` to paid
`full_generation`, but the final server policy guard only blocked the former.
A client could request the latter and reach the provider despite a banned or
unverified submission-generation policy.

### Fix

- Resolve the exact policy capability for `generate_submission_text` instead
  of always resolving the large-section capability.
- Block both generation requests before the provider is called when the
  institutional policy is blocked.
- Preserve the existing mentor-acknowledgment check against the exact policy
  fact and return the actual blocked capability in the response.

### Verification

- TDD runtime regression: PASS; `generate_submission_text` reached the
  provider before the guard fix and now returns 403 with no provider call.
- Chat runtime suite: PASS (14 tests).
- Full test suite: PASS (133 test files, 468 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- `git diff --check`: PASS for the isolated chat changes.
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).

### Golden Journey impact

- G9-G10: an institutional prohibition cannot be bypassed by switching to the
  alternate client capability name.
- G0-G8: no behavior change.

### Remaining issues

- Staging must still prove the canonical policy facts and RLS/entitlement
  configuration for real faculties; local mocks do not establish that.
- External Lekta, commerce and dependency advisory blockers remain
  `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15ag

### Root cause selected

Priority: P1 manuscript input integrity. The server-side manuscript backup
validator accepted empty or duplicate section/source IDs. That could make
section lookup ambiguous and make citation evidence IDs ambiguous inside a
private agent-run context.

### Fix

- Require non-empty section and source IDs.
- Reject duplicate section IDs and duplicate source IDs before the context is
  stored or passed to a worker.
- Keep the existing content, size, link-safety and project ownership checks.

### Verification

- TDD regression: PASS; the new duplicate/empty-ID test failed before the
  validator change and passed afterward.
- Focused backup validation: PASS (8 tests).
- Full test suite: PASS (133 test files, 467 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- `git diff --check`: PASS for the validator changes.
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).

### Golden Journey impact

- G9-G10: private agent contexts now have unambiguous section and citation
  identity before worker execution.
- G0-G8: no behavior change.

### Remaining issues

- Canonical Lekta-side schema/RPC constraints still require staging proof;
  local validation is defense in depth.
- External staging, authenticated commerce and production dependency audit
  blockers remain documented as `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15af

### Root cause selected

Priority: P1 run-shape integrity and cost control. The agent-run endpoint
accepted arbitrary `sectionIds` from the client. It did not ensure that the
IDs existed in the submitted manuscript snapshot or that each ID was unique,
so a malformed client could request nonexistent or duplicate writing steps.

### Fix

- Validate section selection against the already validated manuscript
  snapshot before calling `create_agent_run`.
- Reject unknown section IDs and duplicates with HTTP 400.
- Pass only the validated selection to the canonical run creation call.
- Keep the existing maximum-count and string-shape checks in the request
  parser.

### Verification

- TDD regression: PASS; the new selection tests failed before the validator
  existed and passed after the route guard was wired.
- Focused request/route tests: PASS (2 files, 14 tests).
- Full test suite: PASS (133 test files, 466 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- `git diff --check`: PASS for the isolated request/route changes.
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).

### Golden Journey impact

- G9-G10: prevents malformed run graphs and duplicate writing work from
  reaching the worker/billing path.
- G0-G8: no behavior change.

### Remaining issues

- Canonical Lekta RPCs still need staging proof that they enforce the same
  section contract server-side; local Katedra validation is defense in depth.
- Authenticated commerce, worker deployment and other external blockers remain
  documented as `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15ae

### Root cause selected

Priority: P0/P1 paid-project boundary. Agent-run creation and paused-context
updates validated ownership of `projectId` and Pass availability, but did not
compare the submitted manuscript snapshot's title and legacy work type with
the canonical paid-project lock. A manipulated client could therefore ask an
otherwise valid run to work on another topic inside the same project.

### Fix

- Validate the manuscript snapshot before creating or replacing a run context.
- Read the canonical project lock and apply `validateLockedProjectMutation` to
  the snapshot title and work type.
- Reject mismatches with HTTP 409 before storage or material attachment.
- Store the already validated manuscript context rather than the unchecked
  request body.
- Keep the existing product-specific Pass and ownership checks unchanged.

### Verification

- TDD route-contract regressions: PASS; both run creation and context update
  tests failed before the lock comparison existed and passed after it.
- Runtime context mismatch regression: PASS (5 tests), including no storage
  call after a changed topic.
- Project-lock semantic tests: PASS (27 tests in the focused route/lock set).
- Full test suite: PASS (133 test files, 463 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- `git diff --check`: PASS for the isolated route changes.
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).

### Golden Journey impact

- G2-G4 and G9-G10: a paid Pass cannot be redirected to another topic or
  work type through a forged agent-run manuscript snapshot.
- G0-G1 and G5-G8: no behavior change.

### Remaining issues

- Canonical Lekta lock/RPC deployment and authenticated staging proof remain
  `BLOCKED_EXTERNAL`; local route tests do not prove production RLS behavior.
- The client may still display a locally edited title after payment, but any
  server-backed run now fails closed until it matches the lock.

## Cycle: 2026-08-15ad

### Root cause selected

Priority: P1 manuscript-integrity UX. The agentic review let a user edit a
verified proposal while retaining the `verified` status. The edited text
could therefore still appear eligible for acceptance even though the
verification covered the previous content.

### Fix

- Editing a verified proposal now changes its status to `generated`.
- The review explains that a new verification is required.
- Section-level and accept-all actions are disabled until the edited proposal
  becomes verified again.
- The existing project, section and `baseRevision` guards remain in place.

### Verification

- TDD regression: PASS; the new dashboard test failed while an edited proposal
  still remained verified and passed after status invalidation was added.
- Focused acceptance/revision suite: PASS (4 files, 15 tests).
- Full test suite: PASS (133 test files, 460 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- `git diff --check`: PASS for the isolated UI changes.
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).

### Golden Journey impact

- G9 and G10: prevents unverified edits from entering the main manuscript
  through the agentic acceptance path.
- G0-G8: no behavior change.

### Remaining issues

- Re-verification of a manually edited proposal still requires the existing
  intervention/run workflow; no automatic semantic verifier was invented in
  this cycle.
- Canonical Lekta deployment, authenticated commerce and other external
  blockers remain documented as `BLOCKED_EXTERNAL`.

## Cycle: 2026-08-15ac

### Root cause selected

Priority: P1 source-gate integrity. Source-bound agent results could contain
verified citations while omitting the required mapping from factual claims to
those citations. Because the verifier only checked mappings when a `claims`
array happened to be present, a provider returning plain text could pass the
writing/source gate without auditable claim evidence.

### Fix

- Require `claims` evidence for `sources`, `writing`, `citation` and `review`
  results; missing evidence now fails closed as `blocked`.
- Add a structured JSON result contract to the provider execution bridge and
  parse validated claim IDs, texts and citation IDs from the provider output.
- Preserve claim evidence in temporary agent-result payloads and validate it on
  reload so the evidence cannot disappear between verification and UI review.
- Update the runtime integration fixture to exercise the structured contract.

### Verification

- TDD regression: PASS; the new verifier test failed before the fix and passed
  after it.
- Focused source/provider/storage tests: PASS (3 files, 14 tests).
- Agent test package: PASS (26 files, 90 tests).
- Full test suite: PASS (133 test files, 459 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- `git diff --check`: PASS for the tracked isolated changes.
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).

### Golden Journey impact

- G9 and G10: strengthens source-gate enforcement and preserves evidence for
  agent-run review before activation in staging.
- G0-G8: no behavior change.

### Remaining issues

- Real provider/staging proof is still `BLOCKED_EXTERNAL` until the canonical
  Lekta worker/RPC contract and credentials are deployed and verified.
- This deterministic gate validates the provider's structured claim map; a
  future verifier-provider may add independent semantic claim detection.
- Authenticated commerce, material deletion tombstoning, dependency advisory
  service and Docker/Supabase availability remain documented blockers.

## Cycle: 2026-08-15ab

### Root cause selected

Priority: P2 documentation drift. `docs/stabilization-report.md` still listed
Git as unavailable, although the current environment exposes Git and the
autonomous loop has already verified status, isolated commits and diff checks.
The stale statement could cause operators to repeat an obsolete environment
workaround or misread the actual remaining GitHub network limitation.

### Fix

- Mark STAB-008 resolved with the exact verified Git path and date.
- Distinguish local Git availability from the separate inability to reach
  `github.com:443` for origin synchronization.

### Verification

- Git executable: PASS (`C:\\Program Files\\Git\\cmd\\git.exe --version`).
- Local branch/status and isolated commit workflow: PASS.
- Targeted documentation search: PASS; STAB-008 now says `RESOLVED (P2)` and
  no longer claims Git is unavailable.
- `git diff --check`: PASS for the documentation change.

### Golden Journey impact

- G0-G10: no product behavior change; release evidence is more accurate.

### Remaining issues

- GitHub origin synchronization remains an environment/network limitation,
  not a local Git installation blocker.
- Canonical Lekta deployment, authenticated commerce and material deletion
  tombstoning remain `BLOCKED_EXTERNAL` in `BLOCKERS.md`.

## Cycle: 2026-08-15aa

### Root cause selected

Priority: P2 server security/operational boundary. The internal agent-worker
route still imported its privileged Supabase client from the cookie-aware
server module. This left the background worker on a different admin-client
contract from the material route and bypassed the canonical service-role
environment validation.

### Fix

- Import `createAdminClient` from `lib/supabase/admin` in the worker route.
- Add a source-level regression proving no production route uses the legacy
  server-module admin export for this path.
- Preserve timing-safe worker-token validation and the existing fail-closed
  worker configuration gate.

### Verification

- TDD regression: PASS; the new assertion failed on the legacy import and
  passed after the route switched to the canonical admin module.
- Focused worker contract test: PASS (1 file, 4 tests).
- Full test suite: PASS (133 test files, 456 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- `git diff --check`: PASS for the isolated changes.
- Legacy production import scan: PASS; only negative assertions in tests
  mention the old import.
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).

### Golden Journey impact

- G9 and G10: strengthens fail-closed worker startup and private run
  processing when the agentic feature is activated.
- G0-G8: no behavior change.

### Remaining issues

- Canonical Lekta worker/RPC deployment, authenticated commerce and material
  deletion tombstoning remain `BLOCKED_EXTERNAL` in `BLOCKERS.md`.

## Cycle: 2026-08-15z

### Root cause selected

Priority: P2 server security/operational boundary. The temporary-material
upload route imported its privileged Supabase client from the cookie-aware
server module instead of the canonical admin module used by the other
privileged routes. That bypassed the admin module's explicit service-role
environment validation and made the route's distributed rate-limit path
depend on an accidental legacy export.

### Fix

- Import `createAdminClient` from `lib/supabase/admin`.
- Keep the authenticated cookie client separate from the service-role client.
- Add a source-level regression and the matching runtime mock boundary.

### Verification

- TDD regression: PASS; the new source assertion failed on the old server
  import and passed after the canonical admin import was applied.
- Focused materials tests: PASS (2 files, 2 tests).
- Full test suite: PASS (133 test files, 456 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- `git diff --check`: PASS for the isolated changes.
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).

### Golden Journey impact

- G3 and G9: strengthens the fail-closed privileged rate-limit path for
  material uploads when the feature is activated.
- G0-G2, G4-G8 and G10: no behavior change.

### Remaining issues

- Canonical material deletion tombstoning, authenticated commerce and other
  Lekta/staging dependencies remain `BLOCKED_EXTERNAL` in `BLOCKERS.md`.

## Cycle: 2026-08-15y

### Root cause selected

Priority: P2 mobile UX obstruction. The global scroll-to-top control used a
viewport-bottom offset that ignored the fixed `/pisi` mobile navigation, so it
overlapped the `Sadržaj / Rukopis / Katedra` controls while scrolling a project.

### Fix

- Add a `/pisi`-scoped mobile offset above the fixed navigation and safe-area
  inset.
- Add a regression assertion for the selector and calculated offset.
- Keep the original position unchanged on non-workspace pages.

### Verification

- TDD regression: PASS; the new test failed before the CSS rule and passed after
  the minimal offset was added.
- Focused UI tests: PASS (2 files, 10 tests).
- Browser geometry check at 390px: PASS; scroll-to-top bottom `779.21px`,
  navigation top `792px`, gap `12.79px`.
- Mobile screenshot review: PASS; the control no longer covers the fixed nav.
- Full Katedra suite: PASS (133 test files, 456 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).

### Golden Journey impact

- G1 and G8: improves mobile project persistence/returning-user usability.
- G0, G2-G7, G9-G10: no behavior change.

### Remaining issues

- Canonical material deletion tombstoning and authenticated commerce remain
  `BLOCKED_EXTERNAL` in `BLOCKERS.md`.

## Cycle: 2026-08-15w

### Root cause selected

Priority: P1 continuity edge case in the guest-to-auth transition. Login and
registration defaulted to `/pisi` without carrying the active local project
identity explicitly. The current-tab case usually survived because the
workspace read `rp_manifest`, but multiple local projects or an email
confirmation callback could lose the intended project context.

### Fix

- Add `buildProjectAuthRedirect()` with an internal-only destination guard.
- Preserve an explicit `redirect` through registration and the Supabase email
  confirmation callback.
- When no redirect is supplied, derive the active local `projectId` from the
  manifest for both registration and login.
- Keep the default `/pisi` destination when local storage is unavailable.
- Add unit coverage for normal, encoded and missing project IDs.

### Verification

- Focused auth tests: PASS (2 files, 4 tests).
- Full Katedra suite: PASS (133 test files, 455 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).
- Guest workspace browser revalidation: PASS; onboarding, Completion Scan,
  manuscript reload persistence and 390/768/1440px overflow checks passed.

### Golden Journey impact

- Auth browser smoke: PASS (`/registracija` and `/prijava` render with a
  seeded local project manifest and no page errors).

- G2: local redirect continuity is now explicit; authenticated Supabase
  staging and real email/session proof remain externally blocked.
- G0-G1 and G3-G10: no behavior change.

### Remaining issues

- Canonical material deletion tombstoning remains `BLOCKED_EXTERNAL` and is
  recorded in `BLOCKERS.md`.
- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain externally blocked.

## Cycle: 2026-08-15v

### Root cause selected

Priority: P1 integrity boundary in `GET /api/materials`: a manifest was
accepted based on its storage location and expiry, without checking that its
embedded material ID and project ID matched the manifest filename and the
canonical project requested by the user.

### Fix

- Derive the expected material ID from the manifest filename.
- Reject manifests whose embedded `id` or `projectId` does not match the
  canonical request context.
- Add a runtime regression with a future-dated manifest from another project.
- Correct the filter callback so the integrity helper receives explicit values,
  not `Array.filter`'s index/array arguments.

### Verification

- TDD regression: PASS; the new runtime test first returned the mismatched
  manifest, then exposed and caught an intermediate callback bug, and now
  passes with only the valid manifest returned.
- Materials and agent focused tests: PASS (28 files, 89 tests).
- Full Katedra suite: PASS (132 test files, 452 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).
- `git diff --check`: PASS for the isolated changes.

### Golden Journey impact

- G3, G9 and G10: prevents a malformed or cross-project manifest from entering
  the materials view and later workflow context.
- G0-G2, G4-G8: no behavior change.

### Remaining issues

- Canonical material deletion tombstoning remains `BLOCKED_EXTERNAL` and is
  recorded in `BLOCKERS.md`.
- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain externally blocked.

## Cycle: 2026-08-15u — BLOCKED_EXTERNAL discovery

### Root cause selected

Priority: P1 lifecycle integrity gap, blocked externally. The material delete
route removes private storage objects but has no canonical Lekta RPC to
tombstone the corresponding `agent_payload_manifests` row. The current Lekta
attachment contract can therefore confirm a deleted material ID while the
worker cannot load its storage object.

### Decision

- Do not add a direct Katedra database update; that would violate the Lekta
  schema/RPC authority boundary.
- Keep `KATEDRA_MATERIALS_ENABLED` fail-closed until the canonical deletion
  contract exists.
- Record the exact required RPC behavior and contract tests in `BLOCKERS.md`.

### Evidence

- Katedra `DELETE /api/materials/:materialId` removes storage names only.
- Lekta `attach_agent_payloads_to_run` filters `deleted_at is null` but has no
  user-facing deletion/tombstone operation available to Katedra.
- The local material loader correctly ignores missing/expired payload content,
  but that is recovery after a false attachment, not a valid deletion flow.

### Golden Journey impact

- G3, G9 and G10: material deletion/retry behavior cannot be proven safely
  before canonical Lekta deletion and staging tests exist.
- G0-G2, G4-G8: no behavior change while materials remain disabled.

### Required external action

Add/deploy an ownership-checked, idempotent Lekta deletion RPC, define active
run behavior, call it from Katedra, and prove delete → attach rejection in
staging. This is now tracked as `BLOCKED_EXTERNAL` in `BLOCKERS.md`.

## Cycle: 2026-08-15t

### Root cause selected

Priority: P1 (temporary material and agent-result loaders trusted the cleanup
job to enforce `expiresAt`, so delayed cleanup could leave expired payloads
usable or visible).

### Fix

- Require a valid future `expiresAt` when loading material context for a run.
- Require a valid future `expiresAt` before returning temporary agent results.
- Filter expired material manifests from `GET /api/materials` as a second
  server-side boundary.
- Add deterministic expiry regressions for material and result loaders.

### Verification

- TDD regressions: PASS; both expiry tests failed before the checks and passed
  afterward.
- Agent/material focused tests: PASS (27 files, 88 tests).
- Full Katedra suite: PASS (131 test files, 451 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- `git diff --check`: PASS for the isolated changes.

### Golden Journey impact

- G3, G7 and G9: expired temporary inputs and results are rejected even when
  cleanup has not run yet.
- G0-G2, G4-G6, G8 and G10: no behavior change.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15s

### Root cause selected

Priority: P1 (the paused agent-run context endpoint stored a replacement
manuscript snapshot before the backend confirmed that every selected material
was attached to the run).

If material attachment failed or returned only a subset, the endpoint returned
an error after already changing the temporary run context. A later resume could
therefore observe a snapshot associated with an unsuccessful update.

### Fix

- Validate the manuscript snapshot before performing any material attachment.
- Confirm all selected material IDs through the canonical Lekta attachment RPC.
- Store the replacement run context only after the attachment set is complete.
- Add a route regression proving a partial attachment never stores the new
  context.

### Verification

- TDD regression: PASS; the new route test failed before the ordering fix and
  passed afterward.
- Agent and agent-run focused tests: PASS (31 files, 100 tests).
- Full Katedra suite: PASS (131 test files, 449 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Local host smoke: PASS (`http://localhost:3000/pisi?tip=d`, HTTP 200).
- `git diff --check`: PASS for the isolated changes.

### Golden Journey impact

- G3 and G9: prevents an unsuccessful paused-run material update from
  replacing its temporary context before resume.
- G0-G2, G4-G8 and G10: no behavior change.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15r

### Root cause selected

Priority: P1 (the `/api/state` privacy allowlist validated field names but not
the runtime shape or size of nested values, and GET returned legacy `gen`,
`hist` and `log` values without re-sanitizing them).

A stale or modified legacy client could place long academic text in an
allowlisted field, use string values where structured booleans/numbers were
expected, or return previously contaminated ledger data through the shared
state response. This contradicted the local-only manuscript boundary.

### Fix

- Validate allowlisted legacy metadata by type, bounded size and field-specific
  shape before writing it to shared state.
- Keep only known capability acknowledgements and their short structured
  evidence fields.
- Bound history and ledger entry counts, timestamps, filenames and Lekta
  summary identifiers; drop free-form text and unknown nested fields.
- Apply the same sanitizers when reading state, so legacy contamination is not
  returned to the client.
- Add runtime regressions for malicious nested write values and contaminated
  stored values.

### Verification

- TDD regression: PASS; both new privacy tests failed before the sanitizer and
  passed afterward.
- Focused state/privacy tests: PASS (14 tests).
- Full Katedra suite: PASS (131 test files, 448 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright localhost smoke: PASS for `/pisi`, `/racun`, `/prijava`,
  `/privatnost` and `/uvjeti` at 390px and 1440px, including dark-mode
  onboarding; no horizontal overflow or page errors.
- `git diff --check`: PASS.

### Golden Journey impact

- G2, G3 and G9: strengthens the shared-state privacy and malformed-state
  recovery boundary.
- G0, G1, G4-G8 and G10: no behavior change.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Fresh UX/readiness review: 2026-08-15q

### Scope and evidence

- `/pisi?tip=d` was inspected in a fresh browser context at 1440px and
  390px.
- The guest onboarding presents one dominant next action, readable step
  hierarchy and no horizontal overflow.
- The same screens were checked in dark mode; text, dividers, controls and
  progress indicators remain legible.
- No new code-fixable P0, P1 or P2 issue was found in this review.

### Preflight result

- `npm.cmd run preflight:agentic`: `BLOCKED_EXTERNAL`; worker, canonical
  billing/rate-limit and project-lock configuration is absent.
- `npm.cmd run preflight:production`: `BLOCKED_EXTERNAL`; production
  Supabase, Stripe, Anthropic, Resend, app URL and contract configuration is
  absent.

These are deployment/staging blockers, not reasons to weaken the local
fail-closed behavior.

## Cycle: 2026-08-15p

### Root cause selected

Priority: P0 (the paid chat capability gate used an admin Supabase client
without the authenticated browser session).

`resolveProjectCapability` verifies that the supplied user ID matches
`db.auth.getUser()`. `/api/chat` passed its service-role client to that helper,
so a real paid chat request could be interpreted as unauthenticated even after
the route had authenticated the user with the server client.

### Fix

- Pass the session-bound server client to `resolveProjectCapability`.
- Keep the admin client for server-side ownership, wallet, provider and billing
  operations where elevated access is intentional.
- Add a runtime regression that asserts the capability gate receives the
  authenticated server client, not the admin client.

### Verification

- TDD regression: PASS; the new client-identity assertion failed before the
  route fix and passed afterward.
- Focused chat/capability tests: PASS (18 tests).
- Full Katedra suite: PASS (131 test files, 446 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright localhost smoke: PASS for `/pisi?tip=d` and `/racun` at 390px
  and 1440px; all responses were `200` with no page errors or horizontal
  overflow. Expected anonymous API `401` responses were treated as auth
  behavior, not browser failures.

### Golden Journey impact

- G3-G6 and G9: restores the authenticated capability boundary needed before
  the paid chat/provider path can be verified in staging.
- G0-G2, G7-G8 and G10: no behavior change.

### Commit

- Isolated changeset: `fix: preserve session for chat capability checks`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15o

### Root cause selected

Priority: P1 (agent-run context snapshots could use a different storage bucket
than the worker when a custom temporary-materials bucket was configured).

The run creation route relied on `storeAgentRunContext`'s default bucket, while
the worker and the material routes read `KATEDRA_TEMP_MATERIALS_BUCKET`. A
custom deployment bucket could therefore accept a run but leave the worker
unable to load its manuscript context.

### Fix

- Use the same configured bucket in `/api/agent-runs` that the worker and
  material routes use.
- Add a route contract regression requiring the configured bucket to be passed
  into private run-context storage.

### Verification

- TDD regression: PASS; the new bucket assertion failed before the route fix
  and passed afterward.
- Focused route tests: PASS (6 tests).
- Full Katedra suite: PASS (131 test files, 446 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright localhost smoke: PASS for `/pisi?tip=d` and `/racun` at 390px
  and 1440px; all responses were `200` with no page errors or horizontal
  overflow. Expected anonymous API `401` responses were treated as auth
  behavior, not browser failures.

### Golden Journey impact

- G9: removes a deployment-specific failure before the worker can resume a
  run.
- G2-G8 and G10: no behavior change.

### Commit

- Isolated changeset: `fix: align agent run context storage bucket`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15n

### Root cause selected

Priority: P2 (internal agent-worker configuration errors contained mojibake).

When the private worker safety configuration was missing, the endpoint returned
`joĹˇ nije konfiguriran`, which is unreadable and weakens failure recovery and
operator diagnosis even though the route correctly failed closed with HTTP 503.

### Fix

- Restore the Croatian `još` string in the internal worker response.
- Add a source-contract regression that rejects the mojibake form and requires
  the readable message.

### Verification

- TDD regression: PASS; the new assertion failed before the string fix and
  passed afterward (4 focused tests).
- Full Katedra suite: PASS (131 test files passed, 445 tests passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright localhost smoke: PASS for `/pisi?tip=d` and `/racun` at 390px and
  1440px with no page errors or horizontal overflow.

### Golden Journey impact

- G9: improves the readability of a fail-closed agent-worker recovery path.
- G2-G7, G8 and G10: no behavior change.

### Commit

- Isolated changeset: `fix: repair agent worker error encoding`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15m

### Root cause selected

Priority: P2 (account data-query failures were rendered as confirmed empty
state).

`/api/account` converted failed project, Pass and usage queries into empty
arrays or a zero-valued usage summary. The account UI then displayed those
values as real facts, which could mislead a returning user during a backend
outage.

### Fix

- Preserve unavailable account collections and usage as `null` while retaining
  explicit warnings.
- Render an em dash and a status message for unavailable metrics instead of
  confirmed zeroes.
- Keep the account page usable and expose the warning without sending the user
  into a false success state.
- Add route and jsdom regressions for unavailable project/Pass/usage data.

### Verification

- TDD regression: PASS; the new route/UI assertions failed before the null
  contract and passed afterward.
- Focused account tests: PASS (8 tests).
- Full Katedra suite: PASS (131 test files passed, 444 tests passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright localhost regression: PASS at 390px and 1440px; anonymous account
  actions stayed hidden and unavailable authenticated account data rendered as
  warnings instead of confirmed zeroes.

### Golden Journey impact

- G9: improved local recovery for account backend/query failures; authenticated
  staging failure recovery remains external.
- G8: returning users no longer receive false project/usage zeros during a
  transient account data failure.

### Commit

- Isolated changeset: `fix: make account data failures explicit`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15l

### Root cause selected

Priority: P2 (anonymous `/racun` exposed account-only actions).

The page rendered account deletion and withdrawal controls even when
`/api/account` returned `401`. Both actions require an authenticated account,
so a guest saw controls that could only end in an API error. This weakened the
account-center mental model and created an avoidable failure path in G9.

### Fix

- Keep privacy guidance visible to guests, but hide account deletion and
  withdrawal actions until the authenticated account payload is available.
- Show one explicit login CTA returning to `/racun`.
- Add a jsdom regression test and a browser assertion for both mobile and
  desktop widths.

### Verification

- TDD regression: PASS; the new DOM test was red before the conditional account
  rendering and green afterward.
- Focused account tests: PASS (4 tests).
- Full Katedra suite: PASS (131 files, 442 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS; anonymous `/racun` hides both account-only
  actions, shows the login CTA, has no page exceptions, and has no horizontal
  overflow at 390px or 1440px.

### Golden Journey impact

- G9: improved local anonymous/session-error recovery; authenticated payment
  and provider failure evidence remains external.
- G8: no change to returning authenticated project behavior.

### Commit

- Isolated changeset: `fix: clarify anonymous account actions`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15k

### Root cause selected

Priority: P0 (production checkout/webhook could remain reachable when the
canonical billing RPC contract was unavailable).

The checkout and paid-session webhook already failed closed when project-lock
enforcement was disabled, but they did not apply the same boundary to
`KATEDRA_BILLING_RPC_CONTRACT`. This could allow a payment session to open, or
allow a webhook retry to enter the legacy wallet grant path, during billing
contract drift.

### Fix

- Require `KATEDRA_BILLING_RPC_CONTRACT=v2` before production checkout starts.
- Require the same contract before a production paid-session webhook grants an
  entitlement or wallet balance.
- Add runtime regressions proving Stripe/admin initialization is skipped when
  the billing contract is missing or legacy.

### Verification

- TDD regression: PASS; both new tests failed before the guards and passed
  afterward.
- Focused checkout/webhook tests: PASS (9 tests).
- Full Katedra suite: PASS (130 files, 441 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS; `/pisi?tip=d` and `/racun` at 390px and
  1440px had no horizontal overflow or page exceptions. Anonymous `/racun`
  API `401` responses are expected and do not produce page errors.

### Commit

- Isolated changeset: `fix: gate commerce on billing contract`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Production agentic flags remain disabled until canonical preflight and
  authenticated staging evidence pass.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15j

### Root cause selected

Priority: P0 (production `/api/balance` could fall back to legacy billing
behavior when canonical project contracts were disabled).

The balance endpoint influences the paywall and free-starter path. Unlike the
chat, checkout, webhook and state routes, it did not fail closed when
project-lock enforcement or billing RPC v2 was missing, so configuration drift
could make the UI use the legacy global-wallet path.

### Fix

- Require both `KATEDRA_PROJECT_LOCKS_ENABLED=true` and
  `KATEDRA_BILLING_RPC_CONTRACT=v2` for production `/api/balance` requests.
- Return `503` before creating an admin client or reading wallet state when
  either contract is unavailable.
- Add a runtime regression for the unsafe production configuration.

### Verification

- TDD regression: PASS; the new test was red before the guard and green
  afterward.
- Focused balance tests: PASS (2 tests).
- Full Katedra suite: PASS (130 files, 439 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS; `/pisi?tip=d` and `/racun` at 390px and
  1440px had no horizontal overflow or page exceptions. Anonymous `/racun`
  API `401` responses are expected and do not produce page errors.

### Commit

- `603e165 fix: fail closed balance project access`

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Production agentic flags remain disabled until canonical preflight and
  authenticated staging evidence pass.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15i

### Root cause selected

Priority: P0 (state mutation could bypass project locking during production
configuration drift).

`/api/state` only ran its immutable-project checks when
`KATEDRA_PROJECT_LOCKS_ENABLED` was true. If the production flag was missing
or accidentally disabled, an authenticated client could still write a new
topic or work type. The deployment preflight rejected that configuration, but
the route itself did not provide a second fail-closed boundary.

### Fix

- Fail closed with `503` for production `GET` and `PUT /api/state` when the
  project-lock contract is not enabled.
- Make lock configuration read at request time rather than capturing the
  value at module import.
- Add runtime regressions proving the route rejects both reads and writes
  before ownership or persistence work in the unsafe configuration.

### Verification

- TDD regression: PASS; both new tests were red before the route guard and
  green afterward.
- Focused state tests: PASS (8 tests).
- Full Katedra suite: PASS (130 files, 438 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS for layout/page behavior at 390px and 1440px;
  anonymous `/racun` produces the expected two `401 /api/account` responses
  in React development mode, with no overflow or page exceptions.

### Commit

- Katedra commit `5725ec3 fix: fail closed state project locks`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Production agentic flags remain disabled until canonical preflight and
  authenticated staging evidence pass.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15h

### Root cause selected

Priority: P1 (legacy DOCX parsing used only a process-local upload limiter).

### Fix

- Production now fails closed unless the distributed Supabase rate-limit store is configured.
- Production DOCX uploads use the atomic distributed reservation; local development keeps the bounded in-memory limiter.
- Uploads use a server-generated reservation ID and reject oversized multipart requests before parsing.
- New runtime regressions cover missing configuration and unavailable distributed reservations.

### Verification

- TDD regression: PASS; the new runtime tests were red before the route change and green afterward.
- Focused upload/rate-limit tests: PASS (6 files, 13 tests).
- Full Katedra suite: PASS (130 files, 436 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS; `/pisi?tip=d` and `/racun` at 390px and
  1440px had no horizontal overflow, page errors or console errors.
- Agentic preflight: expected FAIL-CLOSED; eight staging variables remain
  absent.

### Commit

- Katedra commit `548e8ad fix: harden docx upload rate limiting`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Production agentic flags remain disabled until canonical preflight and authenticated staging evidence pass.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.
- The current canonical reservation RPC applies the shared 2-active/8-per-minute
  envelope; a stricter DOCX-specific 1-active/3-per-minute policy still needs
  a scoped Lekta contract if that product limit is required in production.

## Cycle: 2026-08-15f

### Root cause selected

Priority: P1 (stale `initializing` agent run after a server crash).

The new readiness state was correctly hidden from workers, but it was included
in the per-project active-run uniqueness index without a recovery path. A
process failure between `create_agent_run` and `activate_agent_run` could leave
an old `initializing` row that blocked the next run indefinitely.

### Fix

- Add the owner-scoped `cleanup_stale_initializing_agent_run` Lekta RPC.
- Cancel only an owned project run whose `initializing` state is older than ten
  minutes; active `pending`, `running` and `paused` runs are untouched.
- Call the cleanup RPC before creating a replacement run and fail closed if the
  canonical recovery contract is unavailable.
- Add the RPC to the agent contract preflight and architecture documentation.

### Verification

- TDD regression: red before the cleanup wrapper/route contract/migration
  existed; green after implementation.
- Focused root tests: PASS (13 tests across backend and route contracts).
- Focused Lekta readiness contract tests: PASS (3 tests).
- Full Katedra suite: PASS (129 files, 432 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 generated routes).
- Lekta `npm.cmd run check`: PASS.
- Local Playwright smoke: PASS; `/pisi?tip=d` and `/racun` at desktop/mobile
  widths had no page errors or horizontal overflow.

### Remaining issues

- The new recovery RPC, like the rest of the agent contract, is not deployed
  or concurrency-tested against canonical Supabase; agent flags remain off.
- Other external blockers remain listed in `BLOCKERS.md`.

## Cycle: 2026-08-15e

### Root cause selected

Priority: P1 (agent-run activation race with selected materials).

The agent-run route activated a newly-created run before attaching the user's
selected temporary materials. Because activation makes the run worker-eligible,
a worker could claim the first step in the gap and process an incomplete input
set.

### Fix

- Keep the run in `initializing` after the private manuscript context is stored.
- Attach and validate every selected material while the run is still
  `initializing`.
- Call `activate_agent_run` only after context and material attachment succeed;
  cancel the run on any failure.
- Add a route regression test that requires material attachment before
  activation.
- Synchronize the release preflight documentation with the runtime-required
  `activate_agent_run` RPC.

### Verification

- Regression route test: PASS (4 tests).
- Related agent-run/backend tests: PASS (31 files, 96 tests).
- Full Katedra suite: PASS (129 files, 430 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 generated routes).
- Local Playwright smoke: PASS; `/pisi?tip=d` and `/racun` at desktop/mobile
  widths had no page errors or horizontal overflow.

### Remaining issues

- Authenticated agent-run behavior and canonical RPC deployment remain
  `BLOCKED_EXTERNAL`; local ordering tests are not proof of live worker
  concurrency behavior.
- Other external blockers remain listed in `BLOCKERS.md`.

## Cycle: 2026-08-15d

### Root cause selected

Priority: P1 (agent-run context mutation race).

The context endpoint performed a read of the run status and then accepted a
new private context unless the status was terminal. A `pending` run could be
claimed by the worker between that read and the storage write, allowing a
context overwrite while processing was already active. The initial context is
already stored before `activate_agent_run`, so later context edits do not need
to be accepted during initialization or pending dispatch.

### Fix

- Add the shared `canEditAgentRunContext` policy helper.
- Permit context replacement only for `paused` or `blocked` intervention runs.
- Return `409` for `initializing`, `pending`, `running` and terminal states.
- Update the route contract and runtime fixtures to distinguish paused
  intervention from active worker processing.

### Verification

- Regression test: red before the policy module existed, green after the fix.
- Focused context policy/runtime tests: PASS (7 tests).
- Full Katedra suite: PASS (129 files, 429 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 generated routes).
- Browser smoke: PASS; `/pisi?tip=d` and `/racun` returned 200 with no page
  errors or horizontal overflow.

### Remaining issues

- Authenticated agent-run behavior and canonical RPC deployment remain
  `BLOCKED_EXTERNAL`; the local policy is not proof of live staging behavior.
- Other external blockers remain listed in `BLOCKERS.md`.

## Cycle: 2026-08-15c

### Root cause selected

Priority: P1/P2 (temporary material concurrency and agent-run initialization
readiness).

The material upload route reused the client-controlled `x-request-id` as the
distributed reservation key. Replaying that ID could make concurrent uploads
look like one reservation. Material deletion also matched storage objects by
an arbitrary prefix. Separately, a newly-created agent run was `pending`
before its private manuscript context and selected payloads were registered,
so a worker could claim the intake step too early; context could also be
overwritten while a worker was already running.

### Fix

- Keep the incoming request ID for tracing only and generate a fresh
  server-side reservation ID for every material upload.
- Require a complete UUID for material deletion and resolve only the exact
  manifest plus one exact raw object; reject ambiguous storage state.
- Add the Lekta `initializing` run state and canonical `activate_agent_run`
  readiness transition. New runs become worker-eligible only after the
  private context exists and payloads are attached.
- Allow context edits for initialization/paused/blocked intervention states,
  but reject context replacement while the run status is `running`.
- Add the activation RPC to Katedra's canonical agent preflight contract.

### Verification

- TDD regressions: PASS; the agent-run readiness tests were red before the
  readiness fix and green after it. Material reservation and storage-path
  regressions pass after their minimal fixes.
- Focused root tests: PASS (14 tests for materials, agent-runs and the
  canonical backend wrapper).
- Lekta readiness contract test: PASS (2 tests).
- Full Katedra suite: PASS (128 files, 428 passed, 4 skipped).
- Lekta full `npm.cmd run check`: PASS (typecheck, full Vitest suite and Vite
  build).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 generated routes).
- Browser smoke: PASS; 28 desktop/mobile light/dark route combinations on
  localhost returned 200 with no page errors or horizontal overflow.

### Remaining issues

- The new Lekta migration and activation RPC are local contract evidence only;
  they are not deployed or concurrency-tested against canonical Supabase.
- Authenticated commerce, canonical Lekta deployment, dependency advisory
  audit and staging Golden Journeys remain external blockers in
  `BLOCKERS.md`.

## Cycle: 2026-08-14

### Root cause selected

Priority: P1 (project continuity / G1 and G8).

After a guest wrote a manuscript and reloaded `/pisi`, bootstrap always set the
workspace to the project home. The local IndexedDB manuscript was present, but
the user was not returned to the active writing surface. This contradicted the
product promise that Katedra knows where the student stopped.

### Fix

- Persist a small per-project workspace preference (`home`, `writing`, `agents`).
- Restore it after validated manuscript bootstrap.
- Keep onboarding authoritative: incomplete projects always start in onboarding.
- Extend the browser acceptance flow to assert the same project ID and writing
  view after reload.

### Verification

- `lib/manuscript/workspace-view.test.ts`: PASS
- Playwright guest reload flow: PASS; project identity preserved, editor restored,
  `data-workspace-view="writing"`, no horizontal overflow, no page errors.
- Full regression gates are recorded in the handoff report for this cycle.

### Remaining issues

- Authenticated registration, Stripe, canonical Lekta RPC deployment and full
  agentic staging remain external blockers; see `BLOCKERS.md` and
  `GOLDEN_JOURNEYS.md`.
- Do not enable agentic feature flags until the canonical preflight passes.

## Cycle: 2026-08-14b

### Root cause selected

Priority: P0 (commerce / project entitlement safety).

The production preflight only required project locks when agentic runs were
enabled. A deployment could therefore pass the preflight, accept a paid Pass,
and grant entitlement without server-side topic/project locking.

### Fix

- Production preflight now requires `KATEDRA_PROJECT_LOCKS_ENABLED=true` for
  every paid production deployment.
- `/api/checkout` refuses to create a Stripe session when production locks are
  unavailable.
- `/api/webhook` refuses to grant a paid entitlement when production locks are
  unavailable.
- Added runtime tests for both fail-closed paths and the preflight invariant.

### Verification

- checkout/webhook/preflight focused tests: PASS (13 tests)
- `npm run test:ci`: PASS (121 files, 379 passed, 4 skipped)
- typecheck: PASS
- lint: PASS
- build: PASS
- production preflight without deployment secrets: FAIL closed, including
  `KATEDRA_PROJECT_LOCKS_ENABLED` in the missing variables.

## Cycle: 2026-08-14c

### Root cause selected

Priority: P1 (capability authorization / paid chat bypass).

When the project-lock gate was enabled, `/api/chat` only resolved a server
capability when the client-supplied capability happened to map to a known paid
action. Empty or unknown values fell through to the legacy chat path. The
editor also sent an empty value for review/coaching actions, so the contract
was implicit rather than explicit.

### Fix

- Added the explicit `contextual_ai` capability to the product matrix,
  including the bounded Free contextual intervention.
- Every manuscript editor action now declares either
  `generate_large_sections` or `contextual_ai`.
- With project locks enabled, `/api/chat` rejects missing or unknown capability
  values before wallet, rate-limit or provider access.
- Documented the capability contract and preserved the legacy fallback only
  while project locks are disabled for local development.

### Verification

- Chat runtime regression tests: PASS; missing and unknown capabilities return
  `400` before the capability/provider path.
- Capability and manuscript-context tests: PASS.
- `npm.cmd run test:ci`: PASS (121 files, 382 passed, 4 skipped).
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd run build`: PASS.
- Local Playwright `/pisi` smoke: PASS; no page errors.

### Remaining issues

- Authenticated staging still remains required to prove the full paid and
  Lekta journeys; see `BLOCKERS.md`.

## Cycle: 2026-08-14d

### Root cause selected

Priority: P1 (project continuity / account project selection).

The account center linked to `/pisi?projectId=...`, but the workspace bootstrap
always selected the global `rp_manifest`. Opening another account project could
therefore display the wrong local manuscript.

### Fix

- Added a tested workspace-project selector.
- An explicit `projectId` now wins over the current global manifest.
- Legacy `rp_state` is not reused when opening a different project, preventing
  one project's metadata from being applied to another.
- The active project's local metadata remains intact when the requested ID is
  the same project.

### Verification

- Workspace project selector tests: PASS (3 tests).
- Workspace observability regression tests: PASS (3 tests).
- Full regression and browser validation will be recorded after this cycle's
  final gates.

### Remaining issues

- The account center can list server projects, but a manuscript that has never
  been stored on the current device still requires onboarding before local
  writing can continue; cross-device manuscript sync remains intentionally out
  of V1 scope.
## Cycle: 2026-08-14e

### Root cause selected

Priority: P1 (entitlement presentation consistency).

`GET /api/account` listed every Stripe entitlement for the user, while the
server access checks recognize only the Katedra Pass catalog (plus its
explicit legacy compatibility shape). The account screen could therefore
show a non-Katedra Stripe entitlement as an active Katedra Pass.

### Fix

- Reused `katedraPassProductFilter()` in the account entitlement query.
- Added a runtime regression test that asserts all three Katedra Pass product
  IDs are present in the query filter.

### Verification

- Account route runtime tests: PASS (3 tests).

### Remaining issues

- The authenticated account and entitlement behavior still needs real staging
  Supabase data for the full G2-G6 proof.
## Cycle: 2026-08-14f

### Root cause selected

Priority: P1 (expired entitlement presentation).

The account API exposed database `status: "active"` without applying the
same expiry check used by server capability authorization. An entitlement
past `purchase_expires_at` could therefore be counted as an active Pass in
the account UI.

### Fix

- Normalize active account entitlements to `expired` when their expiry is not
  in the future, including a missing/invalid expiry.
- Preserve non-active historical statuses for account history.
- Added a runtime regression test for an expired active entitlement.

### Verification

- Account route runtime tests: PASS (4 tests).

### Remaining issues

- Full entitlement proof still requires authenticated staging data and a real
  webhook/refresh journey.

## Cycle: 2026-08-14g

### Root cause selected

Priority: P0 (entitlement fail-open on storage errors).

The shared Project Pass repository returned only `false` when the entitlement
query failed. Chat, balance, and server capability authorization could then
interpret an unavailable entitlement store as an ordinary free/no-Pass state.
That could incorrectly enter starter-wallet logic instead of stopping safely.

### Fix

- Added tri-state `lookupActiveProjectPass` and product-specific lookup helpers.
- Kept boolean wrappers for legacy pure callers, but made server routes use the
  strict result.
- `/api/chat` and `/api/balance` now return `503` and release any reservation
  when Pass state cannot be checked.
- `resolveProjectCapability` now returns `capability_unavailable` when the
  entitlement lookup fails.
- Added route, repository, and capability regression tests.

### Verification

- Focused entitlement/chat/balance/capability tests: PASS (30 tests).
- Full test suite: PASS (123 files, 390 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS.
- Local HTTP `/pisi` smoke: PASS (`200`).

### Remaining issues

- Authenticated staging is still required to prove real entitlement failure,
  webhook, checkout, and Lekta-backed journeys; see `BLOCKERS.md`.

## Cycle: 2026-08-14h

### Audit result

The current local audit found no new code-fixable P0, P1, or P2 issue after
cycle `2026-08-14g`. The remaining incomplete Golden Journey evidence is now
explicitly classified as `BLOCKED_EXTERNAL` where it requires authenticated
Supabase/Stripe/AI or canonical Lekta staging state, rather than being counted
as a partial local pass.

### Evidence

- `G0`, `G1`, and `G8` remain locally evidenced.
- `G2`, `G3`, `G4`, `G5`, `G6`, `G7`, `G9`, and `G10` require external staging
  state documented in `BLOCKERS.md`.
- Local regression suite, typecheck, lint, build, and the `/pisi` HTTP smoke
  remain green from the preceding verified cycle.

### Remaining issues

- Do not enable agentic/project-lock/material feature flags until the Lekta
  contract, worker, RLS, cleanup, and authenticated staging journeys pass.
- Do not declare V1 Product Complete until the required external journeys are
  executed and the double-full-pass audit is completed.

## Cycle: 2026-08-14i

### Independent final audit result

Without changing production code after cycle `2026-08-14h`, the available
local validation was rerun from the current working tree:

- `npm.cmd test`: PASS (123 files, 391 passed, 4 skipped).
- `npm.cmd run test:ci`: PASS (123 files, 391 passed, 4 skipped).
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd run build`: PASS.
- HTTP smoke for `/`, `/pisi`, `/racun`, `/prijava`, `/privatnost`, and
  `/uvjeti`: all `200`.
- Authenticated money-flow E2E: not started because
  `KATEDRA_INTEGRATION_URL` is unavailable.
- Agentic staging preflight: expected fail-closed exit `1` because the worker,
  model, project-lock and agent-run staging variables are unavailable.

This second audit found no new local code-fixable P0, P1, or P2 issue. V1 is
not declared complete while the external staging journeys remain unexecuted;
the exact blockers and owner actions remain in `BLOCKERS.md`.

## Cycle: 2026-08-14j

### Root cause selected

Priority: P1 (agentic entitlement lifecycle).

`POST /api/agent-runs/:runId/context` checked that a project had a historical
lock, but did not re-check that its Project Pass was still active. A run could
therefore accept and store a new manuscript context after expiry or
revocation.

### Fix

- Reused the strict `lookupActiveProjectPass` repository in the context route.
- Return `402` for an inactive Pass and `503` when entitlement state cannot be
  verified.
- Reject the request before storing or attaching any new payload.
- Added runtime regressions for both inactive and unavailable Pass state.

### Verification

- Focused agent context/contract/entitlement tests: PASS (24 tests).
- Full suite: PASS (128 files, 393 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS.
- Local HTTP smoke: `/`, `/pisi`, `/racun`, `/prijava`, `/privatnost`, and
  `/uvjeti` all returned `200`.

### Remaining issues

- Agent runs remain disabled until the canonical Lekta contract and staging
  worker are deployed and verified; see `BLOCKERS.md`.

## Cycle: 2026-08-14k

### Root cause selected

Priority: P1 (project-specific Pass enforcement on agent context).

After the previous expiry check, the context route still accepted any active
Katedra Pass. A Seminarski entitlement could therefore authorize a context
update for a project locked as Završni if the canonical run RPC or another
layer did not reject it first.

### Fix

- Normalize and validate the locked product key against the locked work type.
- Use `lookupActiveProjectPassForProduct` with the exact catalog product ID.
- Reject mismatched or malformed lock metadata fail-closed before storing the
  manuscript context.
- Added a regression proving an active wrong-tier Pass cannot authorize the
  run.

### Verification

- Focused context route tests: PASS (3 tests).
- Full suite: PASS (128 files, 394 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS.
- Local HTTP smoke: all six primary routes returned `200`.

### Remaining issues

- Canonical Lekta RPC/RLS and authenticated staging still need to verify the
  same project/tier invariant across the real worker and database boundary.

## Cycle: 2026-08-14l

### Root cause selected

Priority: P1 (resuming an agentic run after entitlement expiry).

The resume route authenticated only the user and delegated directly to the
resume RPC. It did not re-read the run's project lock or active product Pass,
so a paused run could potentially resume after the Pass expired or changed.

### Fix

- Load the run through the authenticated user's project scope.
- Require a valid lock and matching work-type/product tier.
- Re-check the exact `katedra_pass_*` entitlement before calling
  `resume_agent_run`.
- Return `402` for inactive access and `503` for unavailable or malformed
  authorization state.
- Added a runtime regression proving an expired Pass cannot resume a run.

### Verification

- Full suite: PASS (129 files, 395 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Local HTTP smoke: all six primary routes returned `200`.

### Remaining issues

- Real resume/worker behavior still requires the canonical Lekta RPC/RLS and
  authenticated staging environment described in `BLOCKERS.md`.

## Cycle: 2026-08-14m

### Root cause selected

Priority: P1 (transient provider failures were not retried safely).

The provider-to-worker bridge treated HTTP 429/5xx, network failures and
incomplete provider streams as ordinary failures. The worker therefore ended
the step immediately instead of using the existing maximum-three-attempt
contract. In addition, a non-retryable billing or configuration failure could
be reported to the scheduler as `retrying` even though the backend step was
not requeued.

### Fix

- Add an explicit retryable signal to provider error events.
- Mark provider 429/5xx, network, malformed-stream and incomplete-result
  failures as retryable while keeping validation, capability and billing or
  configuration errors non-retryable.
- Convert retryable provider errors into verifier `needs_revision` results so
  the worker requeues only while the attempt is below three; the third attempt
  becomes blocked.
- Align the worker return status with the persisted backend status so a failed
  non-retryable step is never reported as retrying.
- Add regression coverage for provider signals, HTTP status retryability,
  bounded worker retries and non-retryable billing/configuration failures.

### Verification

- Focused provider/worker tests: PASS (3 files, 17 tests).
- Full suite: PASS (129 files, 399 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).

### Remaining issues

- Local HTTP smoke: PASS via `curl` against the existing localhost process;
  `/`, `/pisi`, `/racun`, `/prijava`, `/privatnost`, and `/uvjeti` all returned
  `200`. No process was terminated.
- Real retry, billing reconciliation and worker lease behavior still require
  the canonical Lekta RPC/RLS and authenticated staging environment described
  in `BLOCKERS.md`.

## Cycle: 2026-08-14n

### Root cause selected

Priority: P1 (agent billing ambiguity was not persisted as a reconciliation
state).

The canonical billing contract requires every AI attempt to end as
`settled`, `released` or `pending_reconciliation`. When the agent worker
received an unknown `katedra_consume` response, an RPC error, or an unusable
billing outcome, it only propagated a generic exception. The step was then
completed without an explicit billing state, making it impossible to
distinguish a safe release from a charge that needs reconciliation.

### Fix

- Add an explicit `AgentBillingReconciliationError` carrying the billing
  state.
- Mark reservation/usage failures as `released` and unknown, failed or
  ambiguous consume results as `pending_reconciliation`.
- Persist the billing state in the worker verification and private result
  payload, and complete the step without blindly reissuing the same debit.
- Preserve the existing idempotent `settled`/`already_settled` path.
- Add regressions for ambiguous consume responses and worker reconciliation
  handling.

### Verification

- Focused billing/worker/storage tests: PASS (3 files, 14 tests).
- Full suite: PASS (129 files, 401 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Local HTTP smoke: PASS via `curl`; `/`, `/pisi`, `/racun`, `/prijava`,
  `/privatnost`, and `/uvjeti` all returned `200`.

### Remaining issues

- The real billing reconciliation result and idempotency behavior still need
  canonical Lekta RPC/RLS and authenticated staging verification described in
  `BLOCKERS.md`.

## Cycle: 2026-08-14o

### Root cause selected

Priority: P1 (agent worker could run with incomplete safety configuration).

The internal agent worker checked its feature flag, worker token and Anthropic
key, but still supplied a fallback model and did not require the canonical
billing v2 contract or distributed Supabase rate-limit store. Enabling only
the agent flag could therefore reach provider execution without the same
fail-closed guarantees as `/api/chat`.

### Fix

- Add a pure worker configuration gate requiring
  `KATEDRA_AGENT_MODEL`, `KATEDRA_BILLING_RPC_CONTRACT=v2` and
  `KATEDRA_RATE_LIMIT_STORE=supabase`.
- Return `503` before loading a run or calling the provider when any contract
  is missing or invalid.
- Remove the fallback model and use only the configured server-side model.
- Add configuration and route-contract regressions for missing and legacy
  safety settings.

### Verification

- Focused worker configuration/route tests: PASS (2 files, 6 tests).
- Full suite: PASS (126 files, 405 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Local HTTP smoke: PASS via `curl`; `/`, `/pisi`, `/racun`, `/prijava`,
  `/privatnost`, and `/uvjeti` all returned `200`.

### Remaining issues

- The required model, billing and rate-limit values still need canonical
  staging deployment and evidence before agent flags can be enabled; see
  `BLOCKERS.md`.

## Cycle: 2026-08-14p

### Root cause selected

Priority: P1 (material upload abuse and request-size handling).

The materials endpoint validated the extracted buffer only after parsing the
whole multipart request, had no per-user/concurrency reservation, and did not
fail closed in production when the distributed rate-limit store was absent.
That left the temporary upload path weaker than the chat and DOCX paths before
the materials feature flag could safely be enabled.

### Fix

- Reject oversized requests using the content-length budget before multipart
  parsing, and reject oversized files before reading them into memory.
- Apply the existing atomic Supabase reservation in production and a bounded
  local limiter only for development.
- Return controlled `429`/`503` responses for rate and configuration failures.
- Release the reservation in a `finally` block and log release failures with a
  request ID.
- Preserve project ownership, Pass capability and private temporary-storage
  checks.
- Update the prelaunch ledger to mark the already-completed landing migration
  instead of retaining stale onboarding-only documentation.

### Verification

- Focused material route test: PASS.
- Full suite: PASS (126 files, 405 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Local HTTP smoke: PASS via `curl`; `/`, `/pisi`, `/racun`, `/prijava`,
  `/privatnost`, and `/uvjeti` all returned `200`.

### Remaining issues

- Real atomic material reservation and private bucket/RLS behavior still need
  canonical Lekta staging verification before `KATEDRA_MATERIALS_ENABLED` is
  enabled; see `BLOCKERS.md`.

## Cycle: 2026-08-14q

### Root cause selected

Priority: P2 (duplicate Tiptap link extension in the manuscript editor).

The running local browser logged repeated `Duplicate extension names found:
['link']` warnings. `StarterKit` registered its built-in link extension while
the editor also registered the separately configured safe-link extension.
That could make link commands and schema behavior ambiguous.

### Fix

- Disable `StarterKit`'s built-in link extension.
- Keep the explicit link extension as the single owner of safe URL validation
  and link toolbar behavior.
- Strengthen the editor regression so it verifies the option is configured on
  `StarterKit`, not merely that an unrelated `linkOnPaste: false` string exists.

### Verification

- Focused editor test: PASS.
- Playwright `/pisi` browser smoke: PASS; duplicate link warnings `0`.
- Full suite: PASS (126 files, 405 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Local HTTP smoke: PASS via `curl`; `/`, `/pisi`, `/racun`, `/prijava`,
  `/privatnost`, and `/uvjeti` all returned `200`.

### Remaining issues

- Dependency audit could not reach the npm advisory endpoint in this
  environment; rerun it in a network-enabled release environment.
- Authenticated commerce, canonical Lekta contracts and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.

## Cycle: 2026-08-14ab

### Root cause selected

Priority: P2 (mojibake navigation labels in onboarding step 3).

The current-state onboarding step rendered the back and next arrows as the
literal mojibake strings `â†` and `â†’`, while the other onboarding steps used
readable Unicode arrows. This was confirmed in the rendered Testing Library
accessible tree, not inferred from a shell display.

### Fix

- Replace both step-3 labels with actual `U+2190` and `U+2192` arrows.
- Add a component regression test that reaches step 3 and rejects the old
  mojibake labels.

### Verification

- TDD regression: PASS; the new test failed against the old rendered labels and
  passed after the minimal text-only fix.
- Focused onboarding tests: PASS (8 tests).
- Full suite: PASS (126 files, 421 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Browser verification: PASS on `localhost:3000` and `127.0.0.1:3000`; step 3
  exposed `← Natrag` and `Dalje →`, with status `200` and no page errors. A
  final route matrix also passed 7 routes × 2 hosts × 2 viewports × 2 themes
  with no overflow, page errors or failed Next asset requests.
- Independent review: PASS, no Critical/Important/Minor findings.

### Commit and journey impact

- Katedra commit: `3e102b6 fix: repair onboarding navigation labels`.
- Affected journeys: G0 and G8 onboarding clarity; no entitlement or backend
  behavior changed.

### Remaining issues

- G2-G7, G9 and G10 remain `BLOCKED_EXTERNAL` pending authenticated staging,
  canonical Lekta deployment and real commerce/provider evidence.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Completion audit: 2026-08-15b

### Result

`V1 PRODUCT COMPLETE` is **not yet proven**. The current local audit found no
new code-fixable P0, P1 or P2 issue after the onboarding and chat-copy fixes,
but G2-G7 and G9-G10 still require the authenticated canonical staging proof
listed in `GOLDEN_JOURNEYS.md` and `BLOCKERS.md`.

### Current evidence

- `npm.cmd test`: PASS (126 files, 421 passed, 4 skipped).
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd run build`: PASS.
- Final browser matrix: PASS (7 routes, 2 loopback hosts, desktop/mobile,
  light/dark; no overflow, page errors or failed Next asset requests).
- Source audit: no remaining actual mojibake sequences in `app` or `lib`; the
  only remaining matching test string is an intentional assertion rejecting
  the old malformed arrow.
- `npm.cmd run preflight:agentic`: expected fail-closed; eight staging/worker/
  billing variables remain absent.
- `npm.cmd run audit:dependencies`: BLOCKED_EXTERNAL because the npm advisory
  endpoint was unreachable and npm could not write its local log directory.

### Completion decision

Keep the autonomous goal active. Do not enable agentic flags or claim V1
complete until the canonical Lekta migration/RPC deployment, real concurrent
lock proof, authenticated Stripe/Supabase/provider journeys and dependency
audit are available.

## Cycle: 2026-08-15a

### Root cause selected

Priority: P2 (mojibake in a user-facing chat recovery error).

When project AI balance data was unavailable or non-numeric, `/api/chat` did
return the correct fail-closed `503` and released the reservation, but the
Croatian message contained the literal mojibake sequence `Ä‡` instead of `ć`.
The issue was confirmed by inspecting the runtime string code points and a
response-payload regression assertion.

### Fix

- Replace the malformed character with the actual `U+0107` character.
- Assert the complete user-facing error payload while preserving status,
  reservation release, authorization and billing behavior.

### Verification

- TDD regression: PASS; the exact response assertion failed before the copy fix
  and passed afterward.
- Focused chat runtime tests: PASS (12 tests).
- Full suite: PASS (126 files, 421 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Independent review: PASS, no Critical/Important/Minor findings.

### Commit and journey impact

- Katedra commit: `d1ce19c fix: correct chat wallet error copy`.
- Affected journey: G9 recovery messaging; no access, billing or persistence
  semantics changed.

### Remaining issues

- G2-G7, G9 and G10 remain `BLOCKED_EXTERNAL` where authenticated provider,
  commerce or Lekta evidence is required.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-14aa

### Root cause selected

Priority: P0 (paid project lock accepted malformed canonical RPC output).

`lockPaidProject` previously synthesized a successful immutable lock snapshot
when the RPC returned only a lock ID, a string, or another unexpected shape.
That could let the webhook continue toward entitlement creation without proof
that Lekta had returned the requested user, project, topic, product and payment
identity.

### Fix

- Require exactly one canonical lock row for array RPC responses.
- Require `lock_id`, project/user identity, topic, work type, product key,
  payment ID and `locked_at` before accepting a lock.
- Compare the returned immutable fields with the checkout request.
- Fail closed for malformed RPC and read envelopes, malformed stored rows and
  identity mismatches.
- Align webhook and capability test doubles with the real Lekta RPC contract.

### Verification

- TDD regression: PASS; malformed lock tests failed before the strict parser and
  pass after it.
- Focused project-lock/webhook/capability tests: PASS (24 tests).
- Full suite: PASS (126 files, 420 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Playwright smoke: PASS on `localhost:3000` and `127.0.0.1:3000`, desktop and
  mobile, light and dark; target routes returned `200`, with no overflow, page
  errors or failed Next asset requests.
- Independent review: no Critical or Important Katedra-wrapper findings.

### Remaining issues

- A local Lekta follow-up migration (`0074_atomic_project_lock_idempotency.sql`)
  now adds atomic conflict handling and deterministic row-lock reconciliation
  for `lock_paid_project`. It is committed in Lekta as `cb1b16f`, but has not
  been deployed or proven against the canonical Supabase project.
- Dependency audit could not reach the npm advisory endpoint in this
  environment; rerun it in a network-enabled release environment.
- Authenticated commerce, canonical Lekta deployment and staging browser
  journeys remain external blockers.

## Cycle: 2026-08-14y

### Root cause selected

Priority: P0 (client-controlled chat idempotency identity).

`/api/chat` reused the bounded incoming `x-request-id` as the distributed
reservation and `katedra_consume` idempotency key. A caller could replay that
header and potentially turn a previously settled key into a new AI response
without a fresh billing attempt.

### Fix

- Keep the incoming ID only as tracing/response identity.
- Generate a fresh server UUID for each billable chat request.
- Use that UUID for reservation and `katedra_consume`.
- Include the server billing ID in billing reconciliation and reservation
  release-failure logs.
- Add a two-request regression using the same client header and assert distinct
  server IDs with matching reservation/settlement identities.

### Verification

- TDD regression: PASS; the pre-fix implementation forwarded
  `reused-client-id`, then the fixed implementation passed the two-request
  assertion.
- Focused chat/observability/rate-limit tests: PASS (20/20).
- Scoped review and re-review: PASS; no Critical, Important or Minor findings
  remain.
- Full suite: PASS (126 files, 413 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Fresh Playwright `/pisi?tip=d` smoke: PASS on `localhost:3000` and
  `127.0.0.1:3000`, with no page errors or Next static-asset failures.

### Commit

- `6514a68` fix: isolate chat billing request identity
- `1ac167f` test: strengthen chat billing identity regression

### Remaining issues

- Live idempotent billing behavior still requires canonical Lekta RPC/RLS and
  authenticated staging proof; local tests cannot replace that external gate.
- Authenticated commerce and remaining Golden Journeys remain the external
  blockers listed in `BLOCKERS.md`.

## Cycle: 2026-08-14z

### Independent UX and release audit

The post-P0 audit found no new code-fixable P0, P1 or P2 defect. Fresh browser
checks covered `/`, `/pisi?tip=d`, `/racun`, `/prijava`, `/privatnost` and
`/uvjeti` on both `localhost` and `127.0.0.1`, at desktop and mobile widths,
with light and dark theme rendering.

### Evidence

- All inspected routes rendered successfully without horizontal overflow in
  either theme or viewport.
- `/pisi` onboarding and Completion Scan rendered with a clear next action.
- The only console 401 responses came from expected anon calls to
  auth-protected account/balance endpoints; there were no page errors.
- `npm.cmd run audit:dependencies` remains `BLOCKED_EXTERNAL` because the npm
  advisory endpoint was unavailable; this is recorded in `BLOCKERS.md`.

### Remaining issues

- G2-G7, G9-G10 still require authenticated Supabase/Stripe/Lekta staging.
- Agentic flags remain disabled until canonical RPC/RLS/worker preflight passes.
- Dependency security status requires a network-enabled advisory audit.

## Cycle: 2026-08-14x

### Root cause selected

Priority: P2 (Next.js development asset guard blocked the loopback browser
origin `127.0.0.1`, leaving `/pisi` stuck before hydration).

### Fix

- Allow both `localhost` and `127.0.0.1` through Next's `allowedDevOrigins`.
- Add a regression assertion covering both local origins.

### Verification

- TDD regression: PASS (red before the config change, green afterward).
- Focused regression: PASS (2/2).
- Full suite: PASS (126 files, 413 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Fresh Playwright checks: PASS for `/pisi?tip=d` on both local origins;
  both returned `200`, onboarding was visible, no Next static asset response
  was `>=400`, and no page errors occurred.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.
- Local feature flags remain disabled until the canonical Lekta preflight passes.

## Cycle: 2026-08-14t

### Root cause selected

Priority: P2 (cross-platform Lekta release-gate instability).

On Windows, two Lekta Node ESM generator files were checked out with CRLF
line endings even though the Vite-driven tests require LF. A generated
real-corpus comparison also treated CRLF and LF as different output, which
made the full Lekta gate report unrelated syntax and snapshot-like failures.

### Fix

- Add a Lekta `.gitattributes` rule that keeps `*.mjs` files on LF across
  checkouts.
- Normalize the real-corpus comparison to LF before asserting generated
  markdown equality.
- Record the coordinated Lekta fix in commit `cd7233f`.

### Verification

- Lekta focused agentic tests: PASS (4 files, 11 tests).
- Lekta full `npm run check`: PASS (TypeScript, full Vitest suite and Vite
  production build; exit `0`).
- Katedra gates from the preceding cycle remain PASS (full suite, typecheck,
  lint, production build and Playwright smoke).

### Remaining issues

- Dependency audit could not reach the npm advisory endpoint in this
  environment; rerun it in a network-enabled release environment.
- Authenticated commerce, canonical Lekta deployment and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.
- Agentic feature flags remain disabled until the canonical Lekta migrations,
  RPC/RLS, worker, TTL cleanup and authenticated staging preflight are
  deployed and verified.

## Cycle: 2026-08-14u

### Root cause selected

Priority: P0 (shared-state privacy boundary bypass).

`PUT /api/state` copied `lektaIssues` into the compatibility backend without a
server-side allowlist, while `GET /api/state` returned the stored JSON as-is.
That allowed document-derived `detail`, `location`, source passages, mentor
comments, document text and unknown fields to cross the local-first boundary
despite the Product Constitution and shared schema forbidding them.

### Fix

- Add one bounded, fail-closed `lektaIssues` sanitizer.
- Apply it before PUT persistence and again when mapping GET responses.
- Add PUT and GET regressions for prohibited fields, unknown keys and oversized
  labels.
- Keep the fix in Katedra route state only; no competing database migration was
  introduced.

### Verification

- TDD regression: PASS; the route-only sanitizer was reversibly removed and
  both new tests failed for the expected leakage before restoration.
- Focused state tests: PASS (6 passed, 1 staging integration skipped).
- Full Katedra suite: PASS (126 files, 408 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS.
- Diff check: PASS; only unrelated pre-existing CRLF normalization warnings.
- Task review and scoped re-review: PASS; no Critical or Important findings.

### Commit

- `002e643 fix: sanitize Lekta state issues`

### Remaining issues

- The canonical Lekta backend still needs the corresponding one-time cleanup
  and deployed contract verification if contaminated legacy rows exist there;
  Katedra now redacts such rows on read and prevents new writes.
- Authenticated commerce, canonical Lekta deployment and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.
- A separate P1 remains in the canonical `resume_agent_run` RPC: direct
  authenticated RPC callers need active project-specific Pass/expiry checks;
  Katedra's HTTP route already checks this boundary.

## Cycle: 2026-08-14v

### Root cause selected

Priority: P1 (canonical direct-RPC resume authorization gap).

Lekta's original `resume_agent_run` updated any paused run owned by the caller
without rechecking that the project's lock was still active and that the exact
project-specific Katedra Pass was active and unexpired. Katedra's HTTP route
performed a similar check, but the canonical database RPC remained a bypass.

### Fix

- Add Lekta migration `0073_harden_katedra_agent_resume_scope.sql`.
- Require the paused run owner, locked project, exact `katedra_pass_` product,
  active entitlement and `purchase_expires_at > now()` in the atomic UPDATE.
- Harden the SECURITY DEFINER search path with `public, pg_temp` and assert it
  in the contract test.
- Keep all database authority in Lekta; no Katedra migration was added.

### Verification

- TDD regression: PASS; the new contract test failed before migration 0073 and
  passed after it; the fix-round search-path assertion also had a red/green
  cycle.
- Focused Lekta tests: PASS (7 tests).
- Lekta full `npm.cmd run check`: PASS (309 files, 3,780 tests, Vite build).
- Scoped review and re-review: PASS for SQL behavior and fix diff.

### Commits

- Lekta `c2b0777` initial resume entitlement guard.
- Lekta `22ab983` SECURITY DEFINER search-path hardening.

### Remaining issues

- Live positive/negative RPC behavior is not proven because the migration is
  not applied to canonical Supabase staging; this remains `BLOCKED_EXTERNAL`,
  not a claim of release readiness.
- Authenticated commerce, canonical deployment and staging browser journeys
  remain the external blockers listed in `BLOCKERS.md`.

## Cycle: 2026-08-14w

### Root cause selected

Priority: P2 (agentic staging preflight did not match worker safety
requirements).

The preflight accepted a configuration with worker/model/feature-flag values
even when the worker's mandatory billing RPC v2 and distributed Supabase
rate-limit contracts were missing or set to legacy values. The environment
template and blocker evidence also omitted two required worker variables.

### Fix

- Require `KATEDRA_BILLING_RPC_CONTRACT=v2` and
  `KATEDRA_RATE_LIMIT_STORE=supabase` in the preflight.
- Distinguish missing from invalid values without exposing secrets.
- Add worker URL and cron-secret placeholders to `.env.example`.
- Synchronize release/blocker documentation and test exclusive bucket
  classification.

### Verification

- TDD regressions: PASS; four new missing/invalid cases were red before the
  preflight change and green afterward.
- Focused preflight tests: PASS (8 tests).
- Katedra full suite/typecheck/lint/build: PASS on implementation commit
  `0b72706` (412 passed, 4 skipped).
- Local preflight: intentionally FAIL-CLOSED, now listing all eight missing
  staging variables/contracts without values.
- Commit/diff review: PASS after the documentation and assertion fix in
  `5a033b9`.

### Remaining issues

- Canonical Lekta deployment, live Supabase RPC/RLS proof, authenticated
  commerce and staging browser journeys remain external blockers.
- Local feature flags remain disabled.

## Cycle: 2026-08-14s

### Root cause selected

Priority: P2 (misleading state-sync error for canonical project ownership
conflicts).

When the compatibility write path reached the canonical Academic Suite trigger
with a project identity already owned by another account, the database returned
the expected unique/ownership conflict (`23505`), but `/api/state` collapsed it
into a generic `500`. The client could not distinguish a project conflict from
a temporary server failure and had no safe recovery message.

### Fix

- Map only the canonical unique/ownership conflict code to `409`.
- Return a generic Croatian conflict message without exposing database details.
- Keep all other persistence failures as `500`.
- Add a runtime regression test for the conflict response.

### Verification

- TDD regression: PASS (red before the route change, green after it).
- Focused state tests: PASS (7 tests).
- Full Katedra suite: PASS (126 files, 406 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Playwright smoke: PASS; desktop/mobile `/pisi` and mobile `/racun` had no
  horizontal overflow, page errors, scroll warnings or duplicate-link warnings.
- Lekta agentic contract tests: PASS (4 files, 11 tests). Full Lekta `npm run
  check` remains non-green because of pre-existing unrelated title-page test
  parsing and generated real-corpus markdown drift; no Lekta files were changed
  in this cycle.

### Remaining issues

- Dependency audit could not reach the npm advisory endpoint in this
  environment; rerun it in a network-enabled release environment.
- Authenticated commerce, canonical Lekta deployment and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.
- Lekta's unrelated full-gate failures remain open and must be resolved in the
  Lekta repository before the cross-repo release gate can be called green.

## Cycle: 2026-08-14r

### Root cause selected

Priority: P2 (Next.js route-transition warning caused by global smooth scrolling).

The global stylesheet intentionally enables smooth scrolling, but the root
`html` element did not declare that behavior for Next.js. The local browser
therefore logged a route-transition warning on page navigation.

### Fix

- Declare `data-scroll-behavior="smooth"` on the root `html` element.
- Add a source-level regression assertion so the declaration cannot disappear
  while the global scroll-to-top behavior remains enabled.

### Verification

- TDD regression: PASS (red before the layout change, green after it).
- Full suite: PASS (126 files, 405 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Playwright local browser smoke: PASS; `/`, `/pisi`, `/racun`, `/prijava`,
  `/privatnost`, and `/uvjeti` all returned `200` with zero scroll warnings.

### Remaining issues

- Dependency audit could not reach the npm advisory endpoint in this
  environment; rerun it in a network-enabled release environment.
- Authenticated commerce, canonical Lekta contracts and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.
## Cycle: 2026-08-15g

### Root cause selected

Priority: P0 (production `/api/chat` could reach the legacy path when
project-lock enforcement was not enabled).

The deployment preflight already required project-lock enforcement, but the
route itself did not fail closed before parsing the request and creating an
admin client. A production configuration drift or a missing flag could
therefore bypass the paid project-capability boundary. The account endpoint
also represented an unavailable usage query as confirmed zero usage without a
warning.

### Fix

- Fail closed in production from `/api/chat` with `503` when
  `KATEDRA_PROJECT_LOCKS_ENABLED` is not exactly `true`.
- Add a runtime regression proving the route does not create an admin client
  in that configuration.
- Add an account warning when the AI usage query is unavailable, while
  retaining a safe zero-shaped response for existing clients.
- Update production runtime test fixtures so downstream rate-limit and billing
  tests explicitly exercise the locked project path.

### Verification

- TDD regression: PASS; the new production lock test failed before the route
  guard and passed after it. The account warning test also failed before the
  warning was added and passed afterward.
- Focused route tests: PASS (18 tests).
- Full Katedra suite: PASS (129 files, 434 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS; `/pisi?tip=d` and `/racun` at 390px and
  1440px had no horizontal overflow, page errors or console errors.
- Diff and selected-file review: PASS.

### Commits

- Katedra commit `ce5e1bb fix: fail closed chat project access`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Production agentic flags remain disabled until the canonical preflight and
  authenticated staging evidence pass.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.
