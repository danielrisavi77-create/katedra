# Auth Redirect Hardening Design

**Date:** 2026-08-13  
**Status:** Approved for implementation

## Problem

The login page reads the `redirect` query parameter and passes it directly to `router.push()` after a successful password login. The current application generates only the internal `/` value, but a user-controlled URL could be supplied manually.

## Design

Add one small shared helper that accepts only same-origin relative paths. It must:

- return a safe fallback for missing, non-string, absolute, protocol-relative, backslash-prefixed, or malformed values;
- preserve an allowed internal pathname, query string, and hash;
- be usable from both the client login page and the server callback route;
- avoid any Supabase schema, session, or database change.

Use the helper in:

- `app/prijava/page.jsx` before `router.push()`;
- `app/auth/callback/route.js` instead of its duplicated redirect predicate.

## Testing

Add pure unit tests for the helper covering the default fallback, valid internal paths, query/hash preservation, absolute URLs, protocol-relative URLs, backslash-prefixed values, and non-string values. Run the test red before implementing the helper, then green after implementation.

## Acceptance criteria

1. A login redirect cannot navigate to an external origin.
2. Existing internal redirects such as `/`, `/pisi`, and `/reset-lozinke?x=1` continue to work.
3. Auth callback redirect behavior uses the same validation rule.
4. Targeted and full test suites, lint, typecheck, and production build pass.
