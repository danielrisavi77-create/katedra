# Golden Academic Projects

`lib/agents/golden-projects.ts` contains ten deterministic contract fixtures
for the Katedra academic workflow. They cover seminarski, završni and
diplomski projects, the three source policies, valid evidence, missing passage
evidence, provider-marked but independently unverified sources, missing claim
maps, unsupported passages, retracted sources and empty provider output.

The fixture suite is intentionally deterministic. It verifies the server-side
source gate and verifier contract without pretending that a mocked provider is
authenticated staging evidence or that a unit test proves real web retrieval.

Run it with:

```powershell
npm.cmd run test:ci -- lib/agents/golden-projects.test.ts
```

Before enabling paid agent runs, each fixture should also be represented in the
authenticated staging workflow with real test credentials. The staging run
must preserve the same expected outcome, attempt limit and billing state.
