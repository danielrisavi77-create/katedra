# ADR-001 — Shared identity backend for Lekta × Katedra

Status: **accepted**

Date: 2026-08-03

## Decision

**The existing Lekta Supabase Auth project (`zrrjttizjyfcxmcpgzml`) is the canonical identity backend for the Lekta × Katedra ecosystem.**

Canonical cross-product `userId` is:

```text
auth.users.id
```

from the Lekta Supabase project.

Katedra must use this Auth tenant and must not maintain a second independent production identity store.

## Why this project

Lekta already has live Auth users, production commerce, Thesis Pass products and a real Supabase migration history. Moving Katedra into that backend avoids splitting existing Lekta identity/commerce authority.

## Shared identity vs seamless SSO

One Auth project does not automatically share cookies across `katedra.hr` and `lekta.hr`.

Two milestones remain distinct:

1. **Foundation:** both products resolve accounts to the same Lekta Supabase `auth.users.id`.
2. **Seamless SSO:** later secure cross-domain session exchange so a user does not authenticate twice.

The first is backend identity architecture; the second is UX transport.

## Consequences

### Positive

- no account-merge problem;
- existing Lekta users can become Katedra users without identity migration;
- purchases/projects attach to one stable UUID;
- existing Lekta commerce stays authoritative;
- Katedra joins instead of forcing a migration of Lekta production systems.

### Constraints

- Katedra deployment env must point to Lekta Supabase;
- Katedra Auth redirect/callback URLs must be allowed in Lekta Supabase Auth settings;
- `service_role` remains server-only;
- email is never a cross-product primary key;
- local DOCX privacy is unrelated to shared identity and remains intact.

## Guest behavior

Guest Katedra projects and free Lekta checks may exist without `userId`.

When the user authenticates:

- the existing project UUID remains unchanged;
- ownership attaches to the Lekta Supabase `auth.users.id`;
- purchase/entitlement claiming is server-validated.

## Rejected alternatives

### Separate Katedra Supabase

Rejected because it would duplicate Auth and force future identity/purchase reconciliation.

### Email as shared identity

Rejected because email is mutable and unsafe as the canonical join key.

### Merge products

Rejected. Shared identity/backend is infrastructure; product responsibilities and brands remain separate.

## Follow-up

1. Apply Academic Suite migrations from the Lekta repo.
2. Point Katedra runtime env at Lekta Supabase.
3. Add Katedra redirect URLs to Lekta Auth configuration.
4. Validate one account in both products.
5. Design seamless cross-domain SSO only when the UX requires it.
