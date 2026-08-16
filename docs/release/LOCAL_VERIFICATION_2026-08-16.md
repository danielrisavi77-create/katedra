# Lokalna verifikacija Katedre — 2026-08-16

Ovaj zapis opisuje što je provjereno u lokalnom repozitoriju i što se ne smije
predstavljati kao production/staging dokaz. Ne sadrži tajne, tokene ni osobne
podatke.

## Prošlo lokalno

Na Katedra repozitoriju, commit `c54c880`, prošli su:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
npm.cmd run audit:dependencies
npm.cmd run test:e2e:pisi
npm.cmd run test:e2e:agent-worker-contract
npm.cmd run test:e2e:hybrid-ui
npm.cmd run test:e2e:agent-studio-ui
```

Rezultati:

- TypeScript provjera, lint i production build prolaze.
- Vitest: `197 passed files`, `832 passed tests`, `4 skipped`.
- Dependency audit: `0 vulnerabilities` prema `npm audit --omit=dev --audit-level=high`.
- `/pisi` workspace, agent worker contract i light/dark mentor UI smoke testovi
  prolaze lokalno.
- Hybrid UI test namjerno označava authenticated checkout/webhook/worker/provider
  put kao `BLOCKED_EXTERNAL` kada staging konfiguracija nije prisutna.

Na Lekta repozitoriju, commit `d2c04c7`, prošla je puna lokalna provjera:

```text
npm run check
```

To uključuje TypeScript provjeru, Vitest i Vite build. To je dokaz izvornog
repozitorija, ne dokaz da je isti ugovor deployan u canonical Supabase projektu.

## Udaljeni master gateovi

Commit `c54c880` je objavljen na udaljeni `master` i oba gatea su završila
uspješno:

- [Foundation check](https://github.com/danielrisavi77-create/katedra/actions/runs/31968168436)
- [Academic Suite browser E2E](https://github.com/danielrisavi77-create/katedra/actions/runs/31968168431)

Ovo potvrđuje CI i javne/browser regresije na GitHubu. Ne zamjenjuje staging
dokaz za authenticated commerce, canonical Lekta RPC/RLS, providere ili worker.

## Što je lokalno pokriveno

- agentni rezultat koristi samo prethodne verificirane artefakte iz istog runa i
  projekta;
- rezultat s `needs_revision`, `blocked` ili `failed` ne ulazi u sljedeći prompt;
- providerov `verified: true` flag nije dovoljan za source verification;
- DOI identitet, metadata mismatch i povučeni izvor imaju fail-closed ponašanje;
- claim bez izvora ili bez passage evidence ne može tiho postati završni nacrt;
- AI zapis u agentnom dashboardu izlaže samo procesne metapodatke i ne uključuje
  promptove, rukopis, output ili citate;
- retry je ograničen na tri pokušaja;
- billing reservation/consume/reconciliation put ima lokalne failure testove;
- workspace, account, paywall, malformed state i local manuscript persistence imaju
  unit/component/browser regresije;
- legacy string-rendered `/pisi` engine više nije runtime dependency.

## Nije dokazano bez staginga

Sljedeće ostaje `BLOCKED_EXTERNAL` i ne smije se označiti kao gotovo samo na
temelju lokalnih testova:

- canonical Lekta migracije, RPC-i, RLS politike i worker deployment;
- atomic paid project lock u stvarnom Supabase concurrency testu;
- stvarni Stripe test checkout → webhook → entitlement → project lock;
- authenticated account attach, deletion authority i cross-project isolation u
  canonical okruženju;
- stvarni provider web research, vision/OCR i neovisni verifier gateway;
- server-side resume nakon zatvaranja browsera;
- staging DOCX/Lekta handoff i puni authenticated money-flow;
- release evidence datoteka koja odgovara commitu koji se deploya.

Za aktivaciju koristiti redom:

```text
npm.cmd run preflight:production
npm.cmd run preflight:agentic
npm.cmd run preflight:release
```

Sva tri moraju proći u deployment/staging okruženju prije uključivanja
`KATEDRA_PROJECT_LOCKS_ENABLED`, `KATEDRA_AGENT_RUNS_ENABLED` ili
`KATEDRA_MATERIALS_ENABLED`. Dok ne prođu, lokalni `BLOCKED_EXTERNAL` rezultat
je očekivano fail-closed ponašanje.
