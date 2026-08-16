# Secret scan — 2026-08-17

## Tool and scope

- Tool: Gitleaks 8.30.1
- Current staged files: scanned with `gitleaks protect --staged --redact`
- Repository history: scanned with `gitleaks detect --source . --redact`
- Secret values are intentionally not recorded in this document.

## Result

The current staged tree contains no Gitleaks findings after replacing the
tracked `.env.example` client-key value with a placeholder. The local
`.env.local` file was not modified or staged.

The history scan reported two identical `generic-api-key` matches at the old
`.env.example` line 7, in commits `0b727065f65d198162044febaedcee0f88d0a9ac`
and `a72b698448cc9e8f624e73f4e96027713330d602`. The value was a Supabase
publishable client key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), not a service-role
credential. No other Gitleaks findings were returned.

## Decision

The tracked example configuration now contains only:

```text
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_WITH_SUPABASE_PUBLISHABLE_KEY
```

No history rewrite was performed because the historical finding is a public
client key and rewriting shared history would be disproportionate without an
incident or explicit rotation decision. If the Supabase project policy treats
publishable keys as sensitive, rotate that key in Supabase and update the
protected deployment environment separately.
