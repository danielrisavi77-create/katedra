# Katedra — Netlify production deployment

Katedra is a Next.js 16 application and is deployed on Netlify using Netlify's automatically managed OpenNext adapter.

## Repository build configuration

`netlify.toml` is authoritative for the basic build:

```toml
[build]
  command = "npm run build"
  publish = ".next"
```

Do not install or pin `@netlify/plugin-nextjs` for the normal production path. Netlify automatically provisions the current OpenNext adapter for modern Next.js.

## Production environment variables

Configure these in **Netlify -> Project configuration -> Environment variables**. Do not put real secrets in `netlify.toml` or commit them to GitHub.

### Shared public/build + server variables

These values are used by browser bundles and/or server route handlers, so they should be available to Builds and Functions when Netlify scopes are available:

```text
NEXT_PUBLIC_SUPABASE_URL=https://zrrjttizjyfcxmcpgzml.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<active Lekta publishable key>
NEXT_PUBLIC_APP_URL=https://katedra.hr
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` keeps the historical Katedra variable name for compatibility. The value may be the current Lekta `sb_publishable_*` key.

### Server-only secrets

These must never use the `NEXT_PUBLIC_` prefix and should be limited to Functions when Netlify environment-variable scopes are available:

```text
SUPABASE_SERVICE_ROLE_KEY=<Lekta service-role secret>
ANTHROPIC_API_KEY=<Katedra Anthropic secret>
STRIPE_SECRET_KEY=<Katedra Stripe secret>
STRIPE_WEBHOOK_SECRET=<Katedra Stripe webhook signing secret>
```

The service-role key must come from the same Lekta Supabase project as `NEXT_PUBLIC_SUPABASE_URL`.

## Supabase Auth redirect configuration

Katedra authenticates against the Lekta Supabase Auth tenant. In the Lekta Supabase Auth URL configuration, allow at minimum:

```text
https://katedra.hr/auth/callback
```

Also set/allow the production application origin used by sign-in/reset flows:

```text
https://katedra.hr
```

If the first production deploy is tested on the Netlify-generated `*.netlify.app` hostname before the custom domain is attached, add that temporary callback URL to the Supabase redirect allowlist as well. Remove unnecessary temporary URLs after the custom domain is stable.

Do not disable Lekta anonymous Auth globally. Lekta intentionally uses anonymous Auth for its repair/storage lifecycle; new Katedra/shared account data is protected by separate permanent-account RLS policies.

## Netlify project setup

1. Create/import a Netlify project from `danielrisavi77-create/katedra`.
2. Use `master` as the production branch after the foundation PR is promoted.
3. Netlify should detect Next.js automatically.
4. Build command: `npm run build`.
5. Publish directory: `.next`.
6. Add the environment variables above before the production deploy.
7. Attach `katedra.hr` as the custom production domain.
8. Trigger a fresh deploy after any environment-variable change.

## Deploy Preview policy

Deploy Previews may build without production-only secrets only if affected server routes are not executed during the build. For end-to-end authenticated/payment testing, use separate preview-safe credentials rather than production Stripe/service-role secrets where possible.

The production `SUPABASE_SERVICE_ROLE_KEY` must not be exposed to untrusted preview branches.

## Post-deploy smoke

After the paired Lekta/Katedra foundation PRs are promoted:

1. Open `https://katedra.hr`.
2. Sign in with a permanent Lekta Supabase account.
3. Verify `/auth/callback` returns to Katedra successfully.
4. Create/save one project.
5. Confirm the project exists in `katedra_projects`, `academic_projects`, and `katedra_project_state`.
6. Open Lekta from Katedra with the project context.
7. Run one non-sensitive DOCX analysis.
8. Return the sanitized Lekta result to Katedra and verify stable finding identity/re-check state.
9. Confirm no raw document body text is stored in Shared Core.

## Rollback

If the Netlify application deploy fails, roll back the Netlify deploy/application code first. Do not drop Academic Suite tables or reverse existing Lekta commerce data. The live shared database migrations are additive and already applied.
