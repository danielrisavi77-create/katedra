# Local release evidence — 2026-08-22

Ovo je dokaz za lokalni Katedra workspace. Ne zamjenjuje staging dokaz iz
Lekte, Stripea ili GitHub branch protectiona.

## Prošlo

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test:ci` — 224 datoteke, 974 testa prošla, 4 skipa
- `npm.cmd run build` — Next.js production build, 30 ruta
- `npm.cmd run audit:dependencies` — 0 ranjivosti na `high` ili višoj razini
- Gitleaks 8.30.1 — current application/Lekta source directories clean; root
  Git history (421 commit) clean after two explicit historical placeholder
  fingerprints were allowlisted
- `npm.cmd run test:e2e:pisi` — `PISI_WORKSPACE_BROWSER_E2E_PASS`
- `npm.cmd run test:e2e:agent-worker-contract` — `AGENT_WORKER_CONTRACT_PASS`
- `npm.cmd run test:e2e:hybrid-ui` — `HYBRID_MENTOR_UI_BROWSER_E2E_PASS`
- `Lekta/npm.cmd run check` — TypeScript, 326 datoteka / 3.850 testova i Vite build prolaze
- `GET http://localhost:3000/pisi` — `200`
- Onboarding sada prije nastavka prikazuje status, datum provjere, kompilirana pravila i službeni izvor odabranog akademskog profila.
- Hybrid browser scenario additionally asserts FPZG diplomski word range, sources/books, citation style, verified status and profile AI capabilities.
- `GET http://localhost:3000/katedra-pack.json` — `200`

## Pokriveni lokalni zahtjevi

- Academic Context Compiler i FPZG diplomski scenario;
- lokalni Pass promise audit koji povezuje Stripe katalog, checkout, capability
  matrix i javno prikazane V1 module;
- lokalne korisničke verzije, diff i vraćanje;
- lifecycle `Napiši → Provjeri → Predaj` s čistim Lekta gateom;
- anonymous i authenticated product analytics funnel;
- deadline banner, eksplicitna e-mail privola i unsubscribe;
- metadata-only AI ledger i export izjave;
- stvarni Lekta handoff event tek na vanjskom linku;
- secret-scan workflow i master protection ugovor.
- reminder cron migrations without a source-controlled bearer credential;
  deployment and rotation are still staging/production owner actions.

## Nije dokazano lokalno

`npm.cmd run preflight:agentic` trenutno fail-closed prijavljuje nedostajuće
worker, billing, rate-limit i verifier konfiguracije. `preflight:production`
prijavljuje nedostajuće Stripe, Anthropic, Resend i production billing
konfiguracije. To je očekivani blocker dok se ne postavi staging.

GitHub branch protection je potvrđen readbackom nakon primjene pravila na
`master`:

- strict required checks: `check`, `browser-e2e`, `gitleaks`;
- najmanje jedna potvrda;
- zastarjele potvrde se odbacuju;
- admin enforcement je uključen;
- conversation resolution je obavezan;
- force-push i brisanje grane su zabranjeni.

Readback endpoint: `GET /repos/danielrisavi77-create/katedra/branches/master/protection`.

To ne zamjenjuje staging dokaz. `npm.cmd run preflight:release` i dalje ostaje
blokiran dok se ne dostave production/agentic konfiguracija, canonical Lekta
ugovor, authenticated staging E2E i release-commit evidence.
## Analytics boundary

Browser analytics cannot assert a purchase, completed worker run, canonical
Lekta recheck or completed project. The north-star `project_completed` event
still requires a deployed canonical Lekta handoff; the local workspace does
not use a client-side fallback that could inflate completion statistics.

The local Lekta source now includes
`0088_katedra_product_completion_contract.sql`, with focused contract
tests for the clean-result, service-role and canonical-stats boundary. The
full Lekta check also passes locally. Deployment and an actual canonical
handoff remain staging requirements.

## Canonical Supabase read-only audit

Read-only inspection of the linked canonical project on 2026-08-22 reports
migrations through `0095`. The database already contains project locks, agent
runs, agent steps, temporary payload manifests, request reservations and
billing attempts. It does not contain the local Lekta migration
`0088_katedra_product_completion_contract.sql`, the
`katedra_product_events` table, `katedra_record_project_completion()` or the
source-filtered north-star stats function. No migration was applied by this
workspace.

## Research Design Canvas i Methodology Builder

- Unit suite covers validation, IndexedDB persistence, capability route,
  bounded AI context and panel interactions.
- `npm.cmd exec vitest run scripts/research-plan-browser-e2e.test.js` covers the
  browser contract for save, reload and responsive layout.
- `npm.cmd run test:e2e:research-plan` remains `BLOCKED_EXTERNAL` unless an
  authenticated storage state or explicit E2E credentials are configured. It
  must not report a browser pass without the protected account.
- Public Pass copy remains unchanged until canonical staging entitlement and
  worker evidence are available.
