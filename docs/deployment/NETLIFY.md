# Katedra — Netlify production deployment

Katedra is a Next.js 16 application and is deployed on Netlify using Netlify's automatically managed OpenNext adapter.

Current production origin:

```text
https://katedra.netlify.app
```

A future custom domain may replace this as the primary origin, but until that promotion happens the Netlify hostname is the canonical application URL for runtime redirects and Supabase Auth configuration.

## Repository build configuration

`netlify.toml` is authoritative for the basic build:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "22"
```

Do not install or pin `@netlify/plugin-nextjs` for the normal production path. Netlify automatically provisions the current OpenNext adapter for modern Next.js.

## Production environment variables

Configure these in **Netlify -> Project configuration -> Environment variables**. Do not put real secrets in `netlify.toml` or commit them to GitHub.

### Shared public/build + server variables

These values are used by browser bundles and/or server route handlers, so they should be available to Builds and Functions when Netlify scopes are available:

```text
NEXT_PUBLIC_SUPABASE_URL=https://zrrjttizjyfcxmcpgzml.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<active Lekta publishable key>
NEXT_PUBLIC_APP_URL=https://katedra.netlify.app
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` keeps the historical Katedra variable name for compatibility. The value may be the current Lekta `sb_publishable_*` key.

### Server-only secrets

These must never use the `NEXT_PUBLIC_` prefix and should be limited to Functions when Netlify environment-variable scopes are available:

```text
SUPABASE_SERVICE_ROLE_KEY=<Lekta service-role secret>
ANTHROPIC_API_KEY=<Katedra Anthropic secret>
STRIPE_SECRET_KEY=<Katedra Stripe secret>
STRIPE_WEBHOOK_SECRET=<Katedra Stripe webhook signing secret>
RESEND_API_KEY=<Resend server secret>
WITHDRAWAL_FROM_EMAIL=<verified production sender address>
KATEDRA_BILLING_RPC_CONTRACT=v2
KATEDRA_RATE_LIMIT_STORE=supabase
```

The service-role key must come from the same Lekta Supabase project as `NEXT_PUBLIC_SUPABASE_URL`.
`WITHDRAWAL_FROM_EMAIL` must use a verified production domain. Do not use `onboarding@resend.dev` in production.
Set the two `KATEDRA_*` flags only after Lekta has deployed and tested the
idempotent billing, project-access, and atomic rate-limit RPC contracts. If
they are missing or unsupported, production AI requests fail closed before
Anthropic is contacted.

## Supabase Auth redirect configuration

Katedra authenticates against the Lekta Supabase Auth tenant. In the Lekta Supabase Auth URL configuration, allow these exact production destinations:

```text
https://katedra.netlify.app
https://katedra.netlify.app/auth/callback
```

Supabase recommends exact production redirect URLs. Wildcards are useful only for Deploy Preview / branch URLs. If preview auth testing is needed, add an additional Netlify preview pattern separately, for example:

```text
https://**--katedra.netlify.app/**
```

Do not disable Lekta anonymous Auth globally. Lekta intentionally uses anonymous Auth for its repair/storage lifecycle; new Katedra/shared account data is protected by separate permanent-account RLS policies.

## Netlify project setup

1. Netlify project is connected to `danielrisavi77-create/katedra`.
2. Current production origin is `https://katedra.netlify.app`.
3. Use `master` as the production branch after the foundation PR is promoted.
4. Netlify should detect Next.js automatically.
5. Build command: `npm run build`.
6. Publish directory: `.next`.
7. Node runtime: `22`.
8. Add the environment variables above before the production deploy.
9. Trigger a fresh deploy after any environment-variable change.
10. If a custom domain is promoted later, update `NEXT_PUBLIC_APP_URL` and Supabase Auth URL configuration in the same release.
11. Run `npm run preflight:production` in the protected deployment context and require exit code 0 before paid traffic.

## Deploy Preview policy

Deploy Previews may build without production-only secrets only if affected server routes are not executed during the build. For end-to-end authenticated/payment testing, use separate preview-safe credentials rather than production Stripe/service-role secrets where possible.

The production `SUPABASE_SERVICE_ROLE_KEY` must not be exposed to untrusted preview branches.

## Post-deploy smoke

After the paired Lekta/Katedra foundation PRs are promoted:

1. Open `https://katedra.netlify.app`.
2. Sign in with a permanent Lekta Supabase account.
3. Verify `/auth/callback` returns to Katedra successfully.
4. Create/save one project.
5. Confirm the project exists in `katedra_projects`, `academic_projects`, and `katedra_project_state`.
6. Open Lekta from Katedra with the project context.
7. Run one non-sensitive DOCX analysis.
8. Return the sanitized Lekta result to Katedra and verify stable finding identity/re-check state.
9. Confirm no raw document body text is stored in Shared Core.

## Future custom domain

When a custom domain such as `katedra.hr` is attached:

1. configure the domain in Netlify;
2. set `NEXT_PUBLIC_APP_URL` to the new exact origin;
3. add the new origin and `/auth/callback` to Supabase Auth URL Configuration;
4. keep the Netlify origin temporarily during migration;
5. verify login/reset flows on the custom domain;
6. remove obsolete redirect URLs only after the custom-domain rollout is stable.

## Rollback

If the Netlify application deploy fails, roll back the Netlify deploy/application code first. Do not drop Academic Suite tables or reverse existing Lekta commerce data. The live shared database migrations are additive and already applied.
