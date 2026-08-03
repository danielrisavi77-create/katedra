# Lekta × Katedra — Cross-Repo Compatibility Audit v0.2

Status: foundation and first closed-loop integration implemented on paired architecture branches; `master` remains unchanged.

## Executive conclusion

Katedra and Lekta now share enough contract surface for a real closed loop without merging products:

- one canonical project identity direction;
- one shared work-type vocabulary at the boundary;
- one privacy-safe `LektaResult` transport;
- stable finding identity (`checkId`, `ruleId`, `issueKey`) for re-check reconciliation;
- Katedra workflow states that cannot self-certify a deterministic fix;
- Lekta remains the only authority that can verify disappearance of a finding.

The apps should remain separate products with a shared Academic Core and shared identity direction.

## 1. Canonical lifecycle

```text
OPEN
  -> USER_CHANGED
  -> RECHECK_REQUIRED
  -> VERIFIED_FIXED
```

`VERIFIED_FIXED` is valid only when a new Lekta analysis for the same project no longer contains the same stable `issueKey`.

If a finding is still present, it returns as `OPEN`.

`SKIPPED` remains a Katedra-only deferral state and never means resolved.

## 2. Stable finding identity

The shared result no longer relies on array-index identity.

Identity order:

1. authored `ruleId` when a finding maps directly to a profile rule;
2. `ruleId + checkId` when a detailed runtime check is a child of a broader authored rule;
3. canonical Lekta `checkId` when no authored rule applies;
4. deterministic `engine:<category>:<slug>` for checks not yet registered in the canonical vocabulary.

A private location hash is appended only when the exact same logical rule/check emits multiple simultaneous occurrences. Human-facing explanatory wording is not part of normal singleton identity.

Katedra stores a local identity sidecar:

```text
issueKey -> checkId / ruleId
```

so the existing vanilla coach engine does not need a risky large refactor.

## 3. Identity source of truth inside Lekta

Stable cross-product check identity reuses Lekta's existing internal `check-fixer-map` exact-title registry first. Supplemental aliases exist only for non-repair checks that are not represented there.

This avoids creating a second competing check vocabulary beside the Repair/Triage engine.

Exact `ruleId` coverage depends on a profile having authored `ruleEntries`. When it does not, stable `checkId` reconciliation still works and `ruleId` remains null rather than being invented.

## 4. Migration safety

Legacy finding IDs are never considered eligible for automatic `VERIFIED_FIXED` merely because a new stable ID has replaced them.

Only findings whose IDs use the new `rule:` or `check:` scheme and whose workflow status is `USER_CHANGED` or `RECHECK_REQUIRED` are verification candidates.

This prevents the identity migration itself from manufacturing false confirmations.

## 5. Re-check semantics

Before the user leaves Katedra for a project-bound Lekta re-check, active `USER_CHANGED` findings become `RECHECK_REQUIRED`.

When a new shared Lekta result returns:

- same stable `issueKey` present -> finding returns as `OPEN`;
- stable candidate absent -> Katedra records `VERIFIED_FIXED` using the new Lekta analysis ID/time;
- legacy/non-stable previous ID -> never auto-verified;
- new incoming stable issue -> `OPEN`.

The legacy Katedra engine's existing `prevIds - newIds` fixed-count behavior is preserved, but a preprocessor narrows `prevIds` to genuine stable verification candidates. This makes its existing “potvrđeno riješeno (Lekta re-check)” message semantically correct.

## 6. Privacy boundary

The cross-product handoff contains identifiers and sanitized finding metadata only.

It does not transfer:

- raw `.docx` bytes;
- document text;
- free-form issue detail;
- free-form document location text;
- mentor notes;
- source passages.

URL fragments are used for the return handoff so the sanitized result is not sent in Katedra's server request URL.

## 7. Shared identity and project identity

Katedra's Supabase Auth remains the proposed canonical identity backend. `auth.users.id` is the future shared `userId`; seamless cross-domain SSO remains a later UX layer.

New Katedra projects receive an opaque UUID before authentication. Existing `k...` project IDs remain supported during migration.

## 8. Academic rules

Lekta remains the only normative source of truth. Katedra consumes a read-only projection of Lekta rules; the projection should continue moving from manually refreshed artifact toward a versioned generated export with drift detection.

## 9. Current persistence boundary

Active Lekta issues and `lektaFixedTotal` continue through Katedra's existing manifest/server-sync shape.

The richer `lektaIdentityIndex` and `lektaResolutionHistory` introduced for reconciliation are currently local manifest metadata. Cross-device persistence of the full resolution history is intentionally deferred; do not claim that capability yet.

## 10. Validation checkpoint

Lekta stable-identity code passed all repository gates on its final code checkpoint:

- Foundation check;
- standard TypeScript + Vitest + Vite build check;
- full conformance matrix;
- DOCX smoke;
- security audit.

Katedra reconciliation code passed TypeScript, ESLint and Next.js production build. The latest Katedra commit after that validation only updates this architecture document.

## 11. Deployment order

Before these paired branches can be promoted:

1. apply the additive Katedra Supabase foundation migration;
2. deploy preview builds of both apps;
3. browser-smoke Katedra -> Lekta -> Katedra;
4. mark one stable finding `USER_CHANGED`;
5. launch a project-bound re-check and confirm the transition to `RECHECK_REQUIRED`;
6. test persistence case: same finding returns and reopens;
7. test resolution case: finding disappears and is recorded as `VERIFIED_FIXED`;
8. only then promote the paired PRs together.

## 12. Still intentionally deferred

Do not yet:

- merge repositories;
- build generalized microservices;
- replace Supabase or Stripe;
- remove guest/localStorage support;
- redesign Katedra's AI wallet;
- claim seamless SSO is finished;
- claim full cross-device resolution history;
- send raw document content between products.
