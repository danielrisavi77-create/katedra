# Katedra Architecture V2

Status: proposed target architecture
Date: 2026-08-06

## Goal

Katedra must scale from a small set of faculty-specific behaviors to a national academic platform where adding a new Croatian faculty, programme, course or assessment is primarily a verified-data operation rather than an application-code change.

The student-facing ecosystem has two products:

1. **Katedra** — academic workflow, research/writing assistance, AI governance, source/draft/revision experience and orchestration.
2. **Lekta** — the exclusive deterministic authority for technical/document verification of the actual submitted document.

The existing Academic Completion codebase is not discarded. Its domain model becomes the canonical workflow/orchestration engine used by Katedra.

## Canonical authorities

| Concern | Authority |
| --- | --- |
| Account identity | Shared Academic Suite (`auth.users.id`) |
| Academic project identity | Shared Academic Suite (`academic_projects.id`) |
| Project stage / tasks / blockers / next action | Completion workflow domain |
| Mentor workflow and deadline state | Completion workflow domain |
| AI policy state and capability authorization | Academic Context + Completion policy domain |
| Research/writing interaction | Katedra |
| Academic document/source/revision storage | Shared Academic Core, surfaced through Katedra |
| Formal document rules | Lekta-authored rules projection |
| DOCX technical verification | Lekta |
| `VERIFIED_FIXED` finding status | Lekta only |
| Entitlements and commerce | Shared commerce tables |

Katedra must not introduce a second canonical stage/task/mentor/deadline model beside Completion.

## Existing production core to reuse

The V2 design is built around the existing canonical `academic_projects.id` and reuses the existing production structures rather than adding parallel Katedra V2 persistence:

- `academic_projects`
- `academic_ruleset_snapshots`
- `academic_documents`
- `academic_sources`
- `academic_source_chunks`
- `academic_document_sections`
- `academic_section_revisions`
- `academic_section_sources`
- `academic_generation_runs`
- `academic_audit_runs`
- `academic_audit_findings`
- `completion_project_state`
- `completion_tasks`
- `completion_events`
- `completion_ai_usage`
- `completion_lekta_findings`
- `lekta_checks`

No new `katedra_*_v2` shadow tables should be created unless an explicit ADR proves an existing shared table cannot own the concern.

## Required privacy ADR before content integration

Older Completion documentation intentionally excluded academic body text from persistence. The current production schema now includes academic document/section/source/revision content surfaces. Before Katedra starts relying on those tables, create and approve **ADR: Academic Content Storage & Privacy V2** that fixes the product contract for:

- which academic content is persisted;
- retention and purge behavior;
- user deletion behavior;
- which content is sent to an AI provider;
- which content is never sent to Lekta;
- which content is never included in analytics/audit metadata;
- privacy/marketing copy that must match the actual implementation.

## Academic Context Compiler

The central V2 primitive is a pure deterministic compiler:

```ts
compileAcademicContext(request: AcademicContextRequest): AcademicContext
```

### Input

```ts
export type AcademicContextRequest = {
  institutionId: string;
  unitId: string;
  programId?: string;
  courseId?: string;
  assessmentId?: string;
  academicYear?: string;
  work: AcademicWorkSpec;
  projectConstraints?: {
    mentorAiRestriction?: 'NONE' | 'RESTRICT' | 'DENY';
  };
};
```

Free-form mentor instructions are not part of the deterministic policy input. If the product later supports extracting rules from mentor text, that extraction must create explicit user-confirmed structured facts before they affect authorization.

### Academic work specification

The current canonical `AcademicWorkType` remains backward compatible:

```ts
export type AcademicWorkType =
  | 'seminar'
  | 'final'
  | 'graduate'
  | 'specialist'
  | 'doctoral'
  | 'article'
  | 'project';
```

V2 adds orthogonal dimensions instead of growing one enum forever:

```ts
export type AcademicGenre =
  | 'essay'
  | 'literature_review'
  | 'empirical_thesis'
  | 'theoretical_thesis'
  | 'case_study'
  | 'policy_analysis'
  | 'research_report'
  | 'technical_report'
  | 'research_article'
  | 'project_report';

export type MethodFamily =
  | 'qualitative'
  | 'quantitative'
  | 'mixed'
  | 'theoretical'
  | 'technical'
  | 'creative'
  | 'none';

export type AcademicWorkSpec = {
  workType: AcademicWorkType;
  genre?: AcademicGenre;
  methodFamily?: MethodFamily;
  language?: string;
};
```

### Scope hierarchy

Rules may target:

```text
university
  -> faculty/unit
    -> programme
      -> course
        -> assessment
          -> project-specific restriction
```

Specificity alone is not enough for authorization. A lower scope may make a policy stricter, but it must not relax an inherited official hard deny.

### Policy precedence invariant

For one AI capability:

1. collect all applicable official rules from broadest to narrowest scope;
2. preserve any inherited `DENY` as a hard ceiling;
3. allow a narrower rule to change `ALLOW`/`ALLOW_WITH_CONDITIONS` to a stricter decision;
4. never allow course/assessment/project input to convert an inherited official `DENY` to `ALLOW`;
5. a mentor restriction may narrow permission;
6. a mentor statement may not legalize a use prohibited by official policy;
7. stale, conflicting or unsupported high-risk generation policy fails closed.

## Canonical AI capability vocabulary

Katedra and Completion currently contain overlapping vocabularies. V2 has one canonical enum:

```ts
export const aiCapabilities = [
  'RESEARCH_DISCOVERY',
  'BRAINSTORMING',
  'QUESTION_COACHING',
  'STRUCTURE_ASSIST',
  'LANGUAGE_REVIEW',
  'CONTENT_REVIEW',
  'TRANSLATION',
  'TRANSCRIPTION',
  'PARAPHRASE',
  'GENERATE_SUBMISSION_TEXT',
  'METHODOLOGY_ASSIST',
  'DATA_ANALYSIS_ASSIST',
  'DEFENSE_PREP',
  'DISCLOSURE_HELP',
] as const;
```

`GENERATE_LARGE_SECTIONS` is not a separate academic policy concept. Generation size is modeled as an action parameter:

```ts
type GenerationScope = 'paragraph' | 'section' | 'full_work';
```

The policy capability remains `GENERATE_SUBMISSION_TEXT`.

## Coverage model

Coverage is multi-dimensional rather than a single faculty-supported flag:

```ts
export type CoverageLevel = 'VERIFIED' | 'PARTIAL' | 'GENERIC_SAFE' | 'UNKNOWN';

export type AcademicCoverage = {
  overall: 'VERIFIED' | 'PARTIAL' | 'GENERIC_SAFE';
  process: CoverageLevel;
  schedule: CoverageLevel;
  aiPolicy: CoverageLevel;
  documentRules: CoverageLevel;
};
```

`GENERIC_SAFE` allows low-risk academic coaching but never claims institution-specific compliance. High-risk submission-text generation remains blocked when the applicable policy cannot be verified.

## Ruleset snapshot invariant

At project initialization/update, the compiler resolves a deterministic academic context and pins a snapshot to the project using the existing `academic_ruleset_snapshots` surface.

The snapshot must have:

- ruleset ID;
- version;
- profile ID/status;
- deterministic fingerprint;
- resolved bundle;
- project ID;
- creation timestamp.

A later rules update must not silently rewrite an existing project context. The product should detect the newer version and offer a reviewed migration with a visible diff.

## Target domain layout

The migration should add focused pure TypeScript domains without a big-bang source-tree rewrite:

```text
domain/
  academic-context/
    types.ts
    compiler.ts
    coverage.ts
    conflict-resolution.ts
    *.test.ts
  work/
    types.ts
    normalize.ts
    *.test.ts
  policy/
    capabilities.ts
    resolver.ts
    conditions.ts
    *.test.ts
  workflow/
    project.ts
    reducer.ts
    blockers.ts
    next-action.ts
    *.test.ts
  prompt/
    compiler.ts
    policy-guard.ts
    *.test.ts
  rules/
    types.ts
    provenance.ts
    *.test.ts

lib/academic-suite/
  database.types.ts
  contracts.ts
  repositories/
  lekta/
  completion/
```

Pure `domain/` modules must not import React, DOM APIs, `localStorage`, Supabase clients, Anthropic SDK/fetch wrappers or network infrastructure.

## Strangler migration of `app/katedra-engine.js`

Do not rewrite the engine in one branch. First freeze important current behavior with characterization tests, then extract one responsibility at a time.

Order:

1. entitlement/access repository;
2. canonical AI capability vocabulary;
3. workflow authority adapter;
4. academic work normalization;
5. Academic Context Compiler;
6. rules snapshot loader;
7. prompt compiler/policy guard;
8. move UI to call domain APIs;
9. delete legacy behavior only after equivalence/E2E gates pass.

## National rules-data pipeline

Adding a new faculty should become a verified data operation:

```text
official institution/program registry
  -> official source discovery
  -> candidate extraction
  -> human verification
  -> source-backed versioned rules
  -> conformance tests
  -> publish
  -> context compiler
```

AI extraction may create candidate facts but may never promote them directly to `VERIFIED`.

## Release gates

A V2 change is releasable only if:

- unit/domain tests are green;
- TypeScript and lint are green;
- generated database contract agrees with production schema expectations;
- rules/provenance conformance is green when rule data changes;
- Next production build is green;
- critical Katedra browser smoke is green;
- shared-contract changes also pass Katedra -> Lekta -> Katedra lifecycle E2E.

## Architecture proof milestone

V2 is proven when FPZG and Pravni fakultet can resolve materially different workflow, policy, deadlines, prompts and Lekta profile selection **without faculty-specific branches in application code**.

If adding Pravo after the FPZG migration requires editing multiple application conditionals, stop expansion and improve the compiler/registry before adding a third faculty.
