# Canonical database projection check

Lekta owns schema generation, migrations and deployment. Katedra's checked-in
`lib/academic-suite/database.types.ts` deliberately consumes only entitlements.
No columns or RPC signatures have been added during overnight hardening.

Obtain the generated TypeScript export from the authoritative Lekta workflow,
record its environment and commit identity, then run locally:

```powershell
npm run check:database-projection -- --source "C:\path\to\Lekta-generated-types.ts"
```

The command is read-only and offline. It compares PostgREST metadata and the
complete `entitlements.Row`, `Insert`, and `Update` shapes, including optional
properties and nullability. Formatting, property order, unrelated tables and
union order do not create false drift. Relationships, other tables, enums and
RPCs are intentionally outside this narrow projection; they still require
their canonical contract/preflight evidence.

A missing source, parse failure, unsupported consumed type, missing projection
member or mismatch exits 1. Unsupported references such as a newly consumed
`Json` type require a reviewed projection-tool change; they never become `any`.
A match proves only agreement with the supplied file, not that it came from a
particular deployed database. Keep the source's provenance with release evidence.

If drift is reported, have the Lekta maintainer confirm the canonical change,
refresh the checked-in projection from that export in a reviewed PR, and rerun
the check plus typecheck, tests and relevant authenticated contract gates.
Do not hand-invent absent columns or query production to fill the projection.

Current status: checker regression fixtures pass; no authoritative fresh
generated export was supplied. Deployed schema parity is `BLOCKED_EXTERNAL`.
