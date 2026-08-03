# Academic Suite — Shared Supabase Schema v0.1

Status: foundation decision

## Core decision

Katedra and Lekta are separate applications and brands, but they share one Supabase project as the identity/data backbone of the Academic Suite ecosystem.

The shared Supabase project does **not** mean that all product data is mixed together. Ownership is explicit:

```text
auth.users
    │
    └── academic_projects          ← SHARED CORE
          │
          ├── katedra_project_state ← KATEDRA-OWNED
          ├── lekta_checks          ← LEKTA-OWNED
          └── entitlements          ← SHARED COMMERCE
```

`auth.users.id` is the canonical account identity across both products.
`academic_projects.id` is the canonical project UUID across both products.

## 1. Shared Core — `academic_projects`

One row represents one academic work regardless of which product is currently being used.

Canonical fields include:

- `id` — UUID, global project identity;
- `user_id` — owner in shared Supabase Auth;
- `legacy_client_project_id` — temporary Katedra migration alias;
- institution/unit/program/profile references;
- semantic `work_type`;
- topic/title/deadline/stage;
- ruleset reference/version;
- contract version;
- timestamps.

Raw DOCX, document text, Katedra prompts, mentor comments, or Lekta free-form document detail do not belong here.

### Legacy migration rule

New Katedra projects already receive a UUID before authentication. That UUID becomes `academic_projects.id` unchanged.

Old Katedra projects that still use a `k...` client ID receive the already-existing `katedra_projects.id` UUID as their canonical shared ID. Their old `k...` value remains only in `legacy_client_project_id`.

Therefore every shared project is unambiguous even if two historical users happened to generate the same legacy alias.

## 2. Katedra-owned — `katedra_project_state`

Contains Katedra process/workflow state keyed by the shared project UUID:

- checklist state;
- generator/autopilot form state;
- prompt history;
- process log;
- local Katedra copy of latest Lekta coaching findings/score;
- cumulative fixed count;
- optional latest Lekta analysis reference.

This table exists because process/coaching state is not shared project identity.

Katedra may read/write this data for the owning user.

## 3. Lekta-owned — `lekta_checks`

Stores sanitized deterministic check history keyed by the same shared project UUID.

Allowed data:

- analysis ID;
- ruleset/profile IDs;
- score/category scores;
- sanitized structured issues;
- optional non-reversible document fingerprint;
- coverage tier;
- timestamps.

Not allowed:

- raw `.docx`;
- document body text;
- free-form document-derived `detail`/`location` payloads;
- mentor notes;
- source passages.

The client has read-only access through RLS. Future cloud persistence from Lekta must use a trusted server/service-role path. Browser-local DOCX analysis remains local-first.

## 4. Shared commerce — `entitlements`

Cross-product purchased rights live above Katedra's token wallet.

Examples:

- `lekta-check`;
- `lekta-fix`;
- `katedra-pro`;
- `academic-pass`;
- `academic-pass-plus`.

Entitlements may be user-wide or tied to one shared project UUID.

Katedra's existing `katedra_wallets`, `katedra_topups`, and `katedra_usage` remain separate because they account for variable AI compute cost. Wallet balance is not the authority for ecosystem access rights.

## 5. Auth

The existing Katedra Supabase Auth project becomes the canonical Academic Suite identity backend.

This gives both apps the same future `user_id` without later account-merging work.

Shared Supabase Auth does **not** automatically create seamless browser SSO between separate root domains (`katedra.hr` and `lekta.hr`). Cross-domain SSO/session exchange remains a later UX layer.

## 6. RLS ownership

- `academic_projects`: owner CRUD (`auth.uid() = user_id`).
- `katedra_project_state`: owner access via the parent project.
- `lekta_checks`: owner SELECT; no client write policy.
- `entitlements`: owner SELECT; no client write/update/delete policy.

Billing and Lekta cloud-check persistence remain server-authoritative.

## 7. Compatibility phase

The current Katedra production API already writes `katedra_projects`. Rewriting that path at the same moment as the schema migration would add unnecessary release risk.

Therefore foundation v0.1 keeps:

```text
Katedra /api/state
      ↓
katedra_projects           (temporary compatibility write-path)
      ↓ DB trigger
academic_projects
      +
katedra_project_state      (new canonical shared model)
```

The trigger also mirrors deletes during the compatibility phase.

`katedra_projects` is **not** the long-term shared project model after this migration.

A later migration may switch `/api/state` to write directly to `academic_projects + katedra_project_state` and then retire the compatibility table only after a safe observation window.

## 8. Why not merge repositories/products

Shared backend identity is an infrastructure decision, not a product merge.

Repos remain separate:

- `danielrisavi77-create/katedra`
- `danielrisavi77-create/Lekta`

Responsibilities remain separate:

- Katedra: process, reasoning, semantic review, coaching;
- Lekta: deterministic document verification and re-check verification.

Shared Supabase only makes the same user/project/entitlement legible to both products.

## 9. Source-of-truth matrix

| Concept | Authority |
| --- | --- |
| user identity | Supabase `auth.users` |
| project identity/metadata | `academic_projects` |
| Katedra process state | `katedra_project_state` |
| verified academic rules | Lekta Academic Core/rules export |
| deterministic check history | `lekta_checks` |
| purchased ecosystem rights | `entitlements` |
| Katedra AI compute credits | existing Katedra wallet tables |
| raw DOCX | local Lekta/browser workflow unless a future explicit feature changes this |

## 10. Foundation v0.1 completion gate

Shared Supabase foundation is technically ready when:

1. migration applies on PostgreSQL 16;
2. every legacy Katedra row backfills to one `academic_projects` row;
3. legacy `k...` projects get canonical UUIDs without losing aliases;
4. UUID-first projects preserve their client UUID exactly;
5. Katedra state backfills to `katedra_project_state`;
6. current Katedra writes mirror into shared tables;
7. `lekta_checks` accepts sanitized check records tied to shared project IDs;
8. `entitlements` accepts shared project/user rights;
9. RLS is enabled on all shared tables;
10. no raw academic document-content column exists in the shared schema.
