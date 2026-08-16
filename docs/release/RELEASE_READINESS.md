# Release readiness

`npm.cmd run preflight:release` je puni release gate za istodobnu aktivaciju plaćenog i agentičkog prometa. Za paid-only deploy koristi `npm.cmd run preflight:production`; agenticni feature flagovi tada moraju ostati ugašeni.

Provjerava tri odvojena sloja:

- produkcijsku konfiguraciju i server-side billing/project-lock ugovor;
- agenticni staging worker, feature flagove i rate-limit ugovor;
- svježi dokaz da su canonical Lekta ugovor, authenticated staging E2E i dependency audit stvarno provedeni.

Sama konfiguracija nije dokaz da su migracije deployane. Zato naredba ostaje `BLOCKED` dok joj se ne preda svježi JSON dokaz kroz `KATEDRA_RELEASE_EVIDENCE_FILE` i `KATEDRA_RELEASE_COMMIT_SHA` koji odgovara aktualnom release commitu. Vrijednosti dokaza se ne ispisuju u terminal i datoteka se ne commita.

Minimalni oblik privatne evidence datoteke:

```json
{
  "canonicalContract": {
    "verified": true,
    "verifiedAt": "2026-08-16T10:00:00.000Z",
    "environment": "staging",
    "reference": "lekta-migration-0085/sql-audit-2026-08-16",
    "commitSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "deploymentUrl": "https://staging.katedra.example"
  },
  "authenticatedStagingE2E": {
    "verified": true,
    "verifiedAt": "2026-08-16T10:05:00.000Z",
    "environment": "staging",
    "reference": "github-actions-run-123",
    "commitSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "deploymentUrl": "https://staging.katedra.example",
    "workflowRunUrl": "https://github.com/example/katedra/actions/runs/123"
  },
  "dependencyAudit": {
    "verified": true,
    "verifiedAt": "2026-08-16T10:10:00.000Z",
    "environment": "release",
    "reference": "npm-audit-report-2026-08-16",
    "commitSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "reportUrl": "https://github.com/example/katedra/actions/runs/124"
  }
}
```

Dokaz vrijedi najviše 30 dana i mora sadržavati samo reference, nikakve tokene ili osobne podatke. Ova datoteka je operativni trag, a ne zamjena za SQL/RLS i browser dokaz u canonical staging okruženju.
