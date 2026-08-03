# appstarter-v2 — status and caveats

Source: `katedraappstarter.zip` (Downloads, 2. 8. 2026), a proposed Next.js/
Supabase architecture that translates the "katedra" Claude Skill's rigor into
the actual SaaS app. Files here are copied verbatim from that zip's
`lib/katedra/` and `supabase/migrations/`, not modified.

## Status: not wired up

Nothing in this folder is imported anywhere in `app/`. This is a preserved
design proposal, not live code. It was reviewed and its ideas partially mined
(see below) but the architecture itself was deliberately deferred — adopting
real Anthropic tool-calling + this schema is a rebuild of the core chat
interaction model, and VIZIJA.md's 2–3 week launch target / 90-day "first
paying customer" focus doesn't leave room for that right now.

## What it proposes

- Real Anthropic tool-calling (`tools.ts`, 13 tools: `resolve_profile`,
  `get_profile_rules`, `plan_upsert`, `plan_next`, `plan_mark`,
  `plan_deviate`, `run_checks`, `record_finding`, `list_zamjerke`,
  `close_zamjerka`, `snapshot`, `diff_versions`, `create_rad`) instead of
  today's one generated prompt copied to Claude or streamed through
  `/api/chat` with no tools at all.
- A Postgres schema (`supabase/migrations/0001_katedra_core.sql`): `radovi`,
  `verzije`, `plan_stavke`, `plan_odstupanja`, `zamjerke`, `nalazi`, `mjere`,
  `profil_autora`, plus `v_napredak`/`v_sljedeca_stavka` views — with real
  DB-enforced integrity our current `katedra_projects` schema doesn't have:
  a mentor objection can't be closed without a ≥10-char justification
  (`zatvaranje_trazi_dokaz` constraint + `zatvori_zamjerku()` function, not
  a plain UPDATE), a plan can't be approved empty (trigger
  `radovi_plan_checkpoint`), a subsection can't be marked written with 0
  words (`napisano_ima_rijeci`), unconfirmed-rule findings are capped below
  CRITICAL at the constraint level (`kapa_na_tezinu`), findings always tie
  to an immutable document snapshot (`nalazi.verzija_id not null`).
- A short core system prompt (`prompts.ts`, ~230 words) plus per-mode
  instruction blocks, with the actual "docx-parsing" work delegated to the
  `run_checks` tool rather than implemented in the prompt.

## The one real caveat before ever wiring this up

`run_checks`'s 10 named checks mix two different domains:

- **Mechanical, Lekta's exclusive domain per `PRODUCT_CONSTITUTION.md`**:
  `pravila`, `citati`, `tipografija`, `polja`. Do not reimplement these in
  Katedra's backend — that duplicates Lekta's own build and breaks "Katedra
  never certifies formal compliance." These should keep routing through the
  existing `#lekta=` hash handoff (`lkParseHash`/`lkStart` etc. in
  `app/katedra-engine.js`), not through this tool.
- **Katedra's own judgment domain**: `argument`, `ai_stil` — legitimately
  ours, and arguably don't even need a deterministic script; Claude's own
  reasoning (the same way `record_finding` already frames "things the model
  itself noticed") may be sufficient.
- **Middle ground**: `izvori`, `brojke`, `preklapanje`, `ponavljanje` —
  quality-assurance Lekta doesn't do but isn't purely Katedra-content
  judgment either. Worth a real decision when this gets built, not assumed
  either way here.

Whoever picks this up should split `run_checks` along this line before
wiring anything to it — the tool as currently scoped would, if implemented
literally, quietly cross the Katedra/Lekta boundary.

## What was already mined into the live app (this pass, not deferred)

The Skill's `references/obrana.md` and the audit-mode "Phase H" (argument/
thesis-quality) checks from `references/audit.md` were pulled directly into
`app/katedra-engine.js`'s `buildPrompt()` — the obrana and audit prompt
branches are now noticeably more detailed than before this pass. See git
history / the surrounding session for exact diffs; not repeated here since
this file is about the *deferred* architecture, not the *shipped* changes.

The Skill package itself (`katedraskillv4.9.zip`, 455 files, 2.2MB — a
mature local/offline Claude Skill a student installs in their own account)
was reviewed but not copied into this repo: 398 of its files are faculty-
profile JSONs that are the same Lekta data `public/katedra-pack.json`
already carries, and the rest (Python audit scripts) run entirely on a
student's own machine — a different, complementary distribution channel,
not something this app's codebase needs to contain.
