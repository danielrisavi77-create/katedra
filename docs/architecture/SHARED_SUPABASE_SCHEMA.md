# Academic Suite — Shared Supabase Schema v0.1

Status: accepted foundation architecture

## Authority

The canonical database is the existing **Lekta Supabase project** (`zrrjttizjyfcxmcpgzml`).

Katedra is a consumer/product namespace inside that backend. It does not own a second Supabase project or a second production migration history.

Authoritative DDL lives only in the Lekta repository:

- `supabase/migrations/0035_academic_suite_foundation.sql`
- `supabase/migrations/0036_academic_suite_rls_hardening.sql`

## Topology

```text
LEKTA SUPABASE
│
├── auth.users                         canonical account identity
│
├── academic_projects                  shared project identity
│   ├── katedra_project_state          Katedra-owned workflow state
│   └── lekta_checks                   Lekta-owned sanitized check history
│
├── products                           existing Lekta catalog
├── entitlements                       existing Lekta purchase authority
│   └── document_slots                 existing Lekta document binding
│
├── katedra_wallets                    Katedra AI credits
├── katedra_topups
├── katedra_usage
└── katedra_projects                   temporary Katedra v1 compatibility path
```

Canonical IDs:

- `userId = auth.users.id`
- `projectId = academic_projects.id`

## `academic_projects`

One row represents one academic work regardless of which app currently owns the UI interaction.

Contains project metadata only: owner, work type, faculty/profile references, topic/title, deadline/stage, ruleset reference/version and contract version.

It must not contain raw document content.

## `katedra_project_state`

Katedra-owned process state keyed by the shared project UUID:

- checklist state;
- generator/autopilot fields;
- prompt/process history;
- process log;
- latest sanitized Lekta coaching findings/score;
- cumulative verified-fix count.

The current `/api/state` still writes `katedra_projects` during foundation v0.1. A DB trigger mirrors the same project into `academic_projects + katedra_project_state`.

## `lekta_checks`

Lekta-owned sanitized deterministic check history keyed by the same project UUID.

Allowed:

- analysis/project/profile/ruleset IDs;
- score/category scores;
- sanitized structured findings;
- optional non-reversible fingerprint;
- coverage/timestamps.

Forbidden in this foundation:

- `.docx` bytes;
- document body text;
- free-form `detail` or `location` derived from the user's document;
- mentor comments;
- source passages.

Client access is owner-read only. Writes remain trusted-server/service-role operations.

## Existing Lekta commerce stays authoritative

Academic Suite does not create a second commerce model.

Existing relation:

```text
products -> entitlements -> document_slots
```

remains the purchase/Pass authority.

Foundation adds optional `academic_project_id` to `entitlements` and `document_slots`, allowing a pass/slot to refer to the same `academic_projects.id` used by Katedra.

This preserves existing Lekta products such as Thesis Pass while making them project-aware across the ecosystem.

## Katedra AI wallet

`katedra_wallets`, `katedra_topups`, and `katedra_usage` are separate because they account for variable Anthropic token cost.

They are **not** access-right authority. A future cross-product Pass is still represented by the existing Lekta commerce model.

## Auth

Katedra login/signup uses the same Lekta Supabase Auth tenant. Existing Lekta users and future Katedra users therefore share one `auth.users` namespace.

Separate domains do not automatically share browser cookies. Seamless cross-domain SSO is a later transport/UX layer.

## RLS

New private tables explicitly target `authenticated` and enforce owner predicates.

- `academic_projects`: owner CRUD;
- `katedra_project_state`: owner CRUD through parent project;
- `lekta_checks`: owner SELECT only;
- Katedra wallet/topup/usage: owner SELECT only; mutations server-side;
- existing Lekta `entitlements` and `document_slots`: owner SELECT only, hardened to `authenticated` by migration `0036`.

Database triggers reject cross-user project bindings for checks and entitlements.

## Source-of-truth matrix

| Concept | Authority |
| --- | --- |
| account | Lekta Supabase `auth.users` |
| project identity/metadata | `academic_projects` |
| Katedra process state | `katedra_project_state` |
| academic rules | Lekta Academic Core |
| deterministic check history | `lekta_checks` |
| purchases / Thesis Pass / slots | existing Lekta `products`, `entitlements`, `document_slots` |
| Katedra AI compute credits | `katedra_wallets/topups/usage` |
| raw DOCX | local Lekta/browser workflow |
| database migrations | Lekta repository only |

## Compatibility phase

```text
Katedra /api/state
      ↓
katedra_projects
      ↓ trigger
academic_projects + katedra_project_state
```

This keeps the existing Katedra engine stable while moving backend authority immediately.

After an observation window, `/api/state` should write directly to shared Core and `katedra_projects` can be retired by a future Lekta migration.
