# Katedra V1 Golden Journeys

This is the acceptance baseline for the PRODUCT COMPLETE mission. A journey is
`PASS` only when its evidence covers the whole journey, not just a unit test.
External dependencies are explicitly marked `BLOCKED_EXTERNAL`.

| ID | Journey | Current status | Evidence / blocker |
| --- | --- | --- | --- |
| G0 | Cold visitor understands Katedra, starts free and receives a Completion Plan | PASS (local) | Playwright landing smoke and five-step `/pisi` onboarding; `lib/project/completion-scan.test.ts` |
| G1 | Guest project survives refresh and manuscript text survives reload | PASS (local) | Playwright guest flow; `lib/manuscript/storage.test.ts`; workspace view regression test |
| G2 | Guest registration continues the same project without duplication | BLOCKED_EXTERNAL | Requires authenticated Supabase staging credentials and real attach flow |
| G3 | Registered Free user sees roadmap, free capabilities and paid gates | PARTIAL | Capability matrix now proves bounded `contextual_ai` and unknown chat capabilities fail closed; authenticated AI path requires staging auth/provider |
| G4 | Seminarski purchase unlocks the same project | BLOCKED_EXTERNAL | Requires Stripe test checkout, webhook and canonical Lekta entitlement staging |
| G5 | Zavrsni purchase unlocks the same project and workflow | BLOCKED_EXTERNAL | Same external checkout/entitlement dependency |
| G6 | Diplomski purchase unlocks the same project and workflow | BLOCKED_EXTERNAL | Same external checkout/entitlement dependency |
| G7 | Lekta check, sanitized handoff, remediation and fresh re-check | BLOCKED_EXTERNAL | Browser E2E exists, but a complete run requires configured Lekta preview and DOCX fixture execution |
| G8 | Returning user resumes the last active project phase | PASS (local) | Workspace view persistence regression, explicit account-project selection test, and Playwright reload check reopen `writing` |
| G9 | Network, session, provider, balance, checkout and malformed-state failures recover honestly | PARTIAL | Route/unit failure tests pass; authenticated provider and payment failures require staging |
| G10 | Student reaches completion, submission and applicable defense workflow | BLOCKED_EXTERNAL | Requires the full paid workflow, canonical Lekta result and staging credentials |

## Required commands

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
npm.cmd run preflight:agentic
```

The last command must pass only after the canonical Lekta contract is deployed;
it is intentionally expected to fail closed in the current local environment.
