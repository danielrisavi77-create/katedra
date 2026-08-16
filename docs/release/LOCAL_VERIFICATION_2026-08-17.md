# Lokalna verifikacija Katedre — 2026-08-17

Ovaj zapis pripada commit-u `10c0494` na Katedra `master` grani. Opisuje
lokalne i GitHub provjere, ali ne predstavlja dokaz da su canonical Lekta
schema, RPC-i, RLS politike ili staging provideri aktivni.

## Prošlo lokalno

Pokrenuto je:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

Rezultati:

- TypeScript provjera prolazi.
- ESLint prolazi.
- Vitest: `198` testnih datoteka prošlo, `857` testova prošlo, `4` skipana.
- Production build prolazi s `28` ruta.
- Provider telemetrija sadrži isti model koji se šalje u billing lifecycle.
- Strogi citation verifier odbija nepotpun Crossref provenance envelope.
- `verifier` i `evidence-graph` koriste isti strogi provenance helper i odbijaju
  različite zaključke o istom neprovjerenom izvoru.

Prethodno su dodatno potvrđeni dependency audit (`0 vulnerabilities`) i
Gitleaks staged scan bez novih nalaza. Povijesni publishable Supabase ključ
ostaje dokumentiran u [SECRET_SCAN_2026-08-17.md](./SECRET_SCAN_2026-08-17.md),
a `.env.example` više ne sadrži stvarnu vrijednost.

## Udaljeni master gateovi

Za `10c0494` oba GitHub workflowa su završila uspješno:

- [Foundation check](https://github.com/danielrisavi77-create/katedra/actions/runs/31976458333)
- [Academic Suite browser E2E](https://github.com/danielrisavi77-create/katedra/actions/runs/31976458332)

Ovi rezultati potvrđuju CI i browser regresije. Ne zamjenjuju authenticated
staging dokaz za checkout, webhook, entitlement, worker, providere ili Lekta.

## Trenutno potvrđeno u lokalnom kodu

- agentni koraci koriste samo verificirane artefakte iz istog runa i projekta;
- providerov `verified: true` flag sam po sebi nije dovoljan;
- strogi Crossref dokaz mora sadržavati `evidenceUrl`, valjan timestamp i
  `titleMatch`, `authorMatch` i `yearMatch` odluke;
- claim bez izvora, passagea ili neovisne provjere ne može tiho postati završni
  nacrt;
- model, provider, usage, latency i billing status ulaze u redigirani agent
  telemetry, bez prompta ili rukopisa;
- retry je ograničen na tri pokušaja, a rezultat s neuspješnom verifikacijom ne
  ulazi u sljedeći agentni prompt;
- legacy string-rendered `/pisi` engine više nije runtime dependency.

## Još nije dokazano bez staginga

Sljedeće ostaje `BLOCKED_EXTERNAL`:

- Lekta migracije `0039–0085`, canonical RPC-i, RLS i worker deployment;
- atomic paid project lock u stvarnom Supabase concurrency testu;
- Stripe test checkout → webhook → entitlement → project lock;
- authenticated account attach, deletion authority i cross-project isolation;
- stvarni web research, vision/OCR i neovisni verifier gateway;
- server-side nastavak runa nakon zatvaranja browsera;
- staging DOCX/Lekta handoff i puni authenticated money-flow;
- svježa release evidence datoteka koja odgovara deployanom commitu.

Feature flagovi zato moraju ostati ugašeni dok ne prođu:

```text
npm.cmd run preflight:production
npm.cmd run preflight:agentic
npm.cmd run preflight:release
```
