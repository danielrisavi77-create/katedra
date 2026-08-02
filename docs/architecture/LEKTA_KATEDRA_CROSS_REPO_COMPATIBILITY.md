# Lekta × Katedra — Cross-Repo Compatibility Audit v0.1

Status: architecture-only; no production behavior changed.

Purpose: reconcile the existing Katedra implementation with the shared foundation introduced in the Lekta repository before either application adds more integration surface.

## Executive conclusion

Katedra is already substantially aligned with the intended two-product ecosystem:

- separate product responsibility is documented;
- Supabase auth exists;
- a project manifest exists;
- Lekta handoff already exists through URL payloads;
- Katedra already consumes a Lekta-derived rules pack;
- raw `.docx` content is not part of shared project state;
- Katedra already distinguishes its process signal from Lekta's compliance score.

Therefore the next step is **not** to rebuild Katedra. The next step is to normalize shared contracts and remove a few schema ambiguities before they become migration debt.

## 1. Shared identity: decide backend now, seamless SSO later

Current Katedra implementation already uses Supabase Auth and every persistent Katedra table is keyed by `auth.users(id)`.

The current charter says "one account in V3". That should be interpreted as:

- **NOW:** choose one canonical identity backend and canonical `userId` for both products;
- **LATER/V3:** add seamless cross-domain SSO so a user does not need to authenticate again when moving between domains.

This prevents Lekta from introducing a second incompatible identity store before V3.

Recommended direction: Katedra's existing Supabase project is the leading candidate for the shared identity backend because Lekta currently has no user-account migration burden.

Do not equate "shared identity backend" with "shared browser session". Two separate top-level domains require an explicit cross-domain sign-in handoff/token exchange for seamless SSO.

## 2. Canonical Project ID ambiguity — fix before account integration

Katedra currently has two project identities:

1. `katedra_projects.id` — server-generated UUID primary key;
2. `guest_project_id` / client `manifest.projectId` — locally generated string beginning with `k...` and used for sync and Lekta handoff.

This is safe enough for the current guest-first application, but ambiguous for a two-app ecosystem.

### Decision

A canonical ecosystem project ID must exist **from the moment the project is created**, including for a guest. Logging in must attach ownership; it must not replace project identity.

Recommended new-project behavior:

```ts
projectId: string // opaque; new projects should use crypto.randomUUID()
```

The Supabase table's existing `id` remains a database-row identity, not the ecosystem project identity.

Existing Katedra `k...` IDs remain valid legacy aliases during migration:

```ts
legacyClientProjectId?: string
```

Migration direction:

- new guest projects receive a UUID client-side;
- the same UUID survives sign-in and server sync;
- the server stores it as the canonical project identifier in a dedicated field when the schema migration is introduced;
- old `k...` projects are accepted and can be mapped without breaking existing localStorage data;
- do not delete `guest_project_id` until backward compatibility is no longer needed.

This avoids the worst identity failure mode: a guest project changing IDs at registration.

## 3. Work type vocabulary mismatch

Katedra's database currently restricts `work_type` to:

```text
s | z | d
```

The Lekta domain already models a wider taxonomy, including seminar, final, graduate, specialist, doctoral, article, and project.

### Decision

Shared contracts must use a canonical semantic enum, not single-character UI codes.

Recommended ecosystem vocabulary:

```ts
type AcademicWorkType =
  | 'seminar'
  | 'final'
  | 'graduate'
  | 'specialist'
  | 'doctoral'
  | 'article'
  | 'project';
```

Katedra may continue using `s/z/d` internally in its legacy UI during transition, but persistence and cross-product payloads should map to the canonical enum.

Do not widen UI scope merely because the shared enum supports more types.

## 4. Issue severity mismatch

Lekta's existing `Issue` type uses:

```text
error | warning | info
```

Katedra currently normalizes incoming values to:

```text
critical | warning | info
```

The normalization is useful for Katedra presentation, but the shared payload should not silently change domain meaning.

### Decision

Canonical transport severity:

```ts
type LektaIssueSeverity = 'error' | 'warning' | 'info';
```

Katedra may map `error -> critical` only in its presentation layer.

This preserves Lekta as the source of truth for findings while allowing Katedra's more coaching-oriented language.

## 5. Issue identity is not yet strong enough

Katedra currently accepts:

```text
issueId || checkId || generated fallback
```

and already has a placeholder for `ruleId`, but current Lekta presentation issues do not consistently expose stable check/rule identity.

### Decision

The shared v0.1 contract distinguishes logical identity from one analysis occurrence:

```ts
interface LektaIssueRef {
  issueKey: string;              // stable logical reconciliation key
  issueInstanceId?: string;      // one occurrence in one analysis
  checkId?: string | null;
  ruleId?: string | null;
  severity: 'error' | 'warning' | 'info';
  category: string;
  summary: string;
  fixable: boolean;
  fixerId?: string | null;
}
```

`issueKey` must be stable enough to compare re-checks. An array-index fallback is legacy-only and must never become canonical identity.

Until the engine emits explicit IDs, Lekta's adapter may derive a conservative legacy key from stable presentation identity while leaving `checkId`, `ruleId`, and fixability unknown rather than inventing them.

## 6. Verification lifecycle

The existing Katedra constitution correctly enforces that Katedra cannot mark an issue as `VERIFIED_FIXED`.

Canonical ecosystem lifecycle:

```text
OPEN -> USER_CHANGED -> RECHECK_REQUIRED -> VERIFIED_FIXED
```

Katedra owns the middle workflow states.
Lekta alone owns `VERIFIED_FIXED` after a new document analysis.

Katedra's current `SKIPPED` status may remain as a user-workflow state, but it is not equivalent to resolution.

## 7. Academic rules pack: good seam, unsafe manual refresh

Katedra already consumes `public/katedra-pack.json`, whose metadata identifies Lekta's verified-profile data as its source.

This is the correct architecture direction: Katedra consumes a read-only coach projection of Lekta rules rather than maintaining a separate faculty database.

The remaining risk is distribution drift. The README currently describes refreshing the pack manually.

### Decision

Short term:

- keep `public/katedra-pack.json` as a versioned generated artifact;
- add `sourceVersion` / commit SHA / pack version in metadata;
- show/record the version used by each project.

Next step:

- automate generation from Lekta in CI or a release artifact;
- add a drift test that fails when the Katedra pack no longer matches the expected Lekta export.

Longer term an API/package may replace the copied artifact, but that is not required for v1.

## 8. Shared entitlement layer must sit above Katedra wallet

Current Katedra billing uses token credits (`katedra_wallets`, top-ups, usage accounting).

That implementation can remain. It solves AI variable-cost accounting.

However a cross-product Pass cannot be represented only as wallet balance.

### Decision

Add a separate shared entitlement concept:

```ts
interface Entitlement {
  entitlementId: string;
  userId: string;
  projectId?: string;
  scope: 'lekta-check' | 'lekta-fix' | 'katedra-pro' | 'academic-pass' | 'academic-pass-plus';
  status: 'active' | 'consumed' | 'expired' | 'revoked' | 'refunded';
  validFrom: string;
  validUntil?: string;
}
```

Wallet credits remain an implementation detail for paid AI usage.
Entitlements decide what ecosystem capabilities the user has purchased.

Do not redesign Katedra's wallet before first revenue; add the entitlement layer alongside it when the first shared offer is implemented.

## 9. Charter conflict: "one account in V3"

The founder's newer architectural decision is that shared account identity is a foundation concern before both products independently evolve.

The charter wording should therefore eventually be updated from:

> one account only in V3

to a distinction such as:

> one canonical identity backend from foundation; seamless cross-domain SSO and unified account UX in V3.

This is a documentation reconciliation, not a reason to block v1 product work.

## 10. What should NOT be changed now

Do not:

- merge the repositories;
- move Katedra code into Lekta;
- replace Supabase;
- replace Stripe;
- rewrite the Katedra vanilla engine into React solely for architectural neatness;
- remove guest/localStorage mode;
- delete `guest_project_id` yet;
- redesign Katedra wallet billing before shared Pass implementation;
- build a generalized microservice architecture.

## 11. Recommended implementation order

### Foundation A — contract normalization

1. Define canonical shared TypeScript contract file(s).
2. Add canonical `AcademicWorkType` mapping.
3. Add canonical `LektaIssueRef` transport shape.
4. Migrate project creation toward one guest-safe canonical `projectId` that survives login.
5. Add pack/version provenance fields.

### Foundation B — identity readiness

6. Declare Katedra Supabase Auth the proposed canonical identity backend.
7. Ensure Lekta never creates a second independent user store.
8. Define future cross-domain auth handoff, but do not build full SSO yet unless required by the first paid cross-product flow.

### Foundation C — first integrated loop

9. Preserve Katedra -> Lekta deep link.
10. Make Lekta return the normalized result contract.
11. Make Katedra consume canonical issue severity/IDs.
12. Re-check must be the only path to `VERIFIED_FIXED`.

### Foundation D — commerce

13. Add shared entitlement table/model.
14. Map Pass purchase to project/user entitlement.
15. Keep AI wallet accounting separate from entitlement state.

## 12. Definition of cross-repo foundation complete

The foundation is ready for feature work when all of the following are true:

- both repos agree on one canonical `userId` strategy;
- both repos agree on one canonical `projectId` strategy that works before login;
- both repos use the same semantic work-type vocabulary in transport/persistence contracts;
- Lekta result payload has stable issue identity and canonical severity;
- Katedra consumes a versioned Lekta rules projection;
- no faculty-specific normative rule has a second independent source of truth;
- the shared entitlement model is specified even if not yet fully implemented;
- production behavior remains backwards-compatible during migration.
