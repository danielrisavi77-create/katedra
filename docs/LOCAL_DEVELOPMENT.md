# Katedra local development workflow (Windows + Claude Code)

This document defines the safe local workflow for developing Katedra on a dedicated Windows laptop while GitHub remains the canonical source of truth.

## 1. Mental model

- **Laptop** = disposable working copy.
- **GitHub `master`** = canonical stable version.
- **Feature branch** = place where Claude Code and local development happen.
- **Pull request + CI** = integration gate.
- **Netlify** = deployment target.
- **Lekta Supabase** = shared Academic Suite Auth/database authority.

You can lose or replace the laptop without losing the project as long as work has been committed and pushed.

## 2. One-time local clone

Choose a normal user-writable folder, for example:

```powershell
mkdir "$HOME\Projects" -ErrorAction SilentlyContinue
cd "$HOME\Projects"
git clone https://github.com/danielrisavi77-create/katedra.git
cd katedra
```

Do not work from `C:\Windows\System32` or another protected system folder.

Then run:

```powershell
.\scripts\dev-bootstrap.ps1 -Install -Verify
```

The bootstrap script never writes secrets. If `.env.local` is missing it will tell you what to configure, but it will not invent credentials.

## 3. Environment files

Runtime values belong in `.env.local` on the laptop and in the hosting provider's environment-variable store for deployment.

`.env.local` is ignored by Git and must never be committed.

Start from the variable names documented in `.env.example` and fill only values appropriate for the local environment.

Do not paste server-only secrets into chat, issues, commits or documentation.

## 4. Starting every new Claude Code task

Do not let Claude Code develop directly on `master`.

From the Katedra repository:

```powershell
.\scripts\new-feature.ps1 -Name "short description of task"
```

Example:

```powershell
.\scripts\new-feature.ps1 -Name "better content review"
```

This safely:
1. requires a clean working tree;
2. fetches GitHub;
3. updates local `master` with `--ff-only`;
4. creates a fresh `claude/...` branch.

Then start Claude Code from the repository root. It automatically reads the root `CLAUDE.md` project instructions. Shared Claude Code permissions are stored in `.claude/settings.json`.

## 5. During development

Useful checkpoints:

```powershell
git status
git diff
```

Commit coherent units rather than one giant end-of-day change:

```powershell
git add -A
git commit -m "Describe the completed change"
```

Push the feature branch when you want the work backed up remotely or ready for a PR:

```powershell
git push -u origin HEAD
```

Claude Code is intentionally configured to ask before Git operations such as push, merge, rebase or branch switching.

## 6. Before opening or merging a PR

Run:

```powershell
.\scripts\dev-doctor.ps1 -Full
```

Minimum code gates are:

```text
npx tsc --noEmit
npm run lint
npm run build
```

Changes touching Auth, `/api/state`, project identity or Katedra ↔ Lekta handoff also require the relevant integration/browser workflow.

## 7. If `master` changes while Claude is working

Never delete or overwrite Claude's local work.

First preserve it on the current feature branch:

```powershell
git status
git add -A
git commit -m "WIP: preserve local work before master sync"
```

Then fetch and integrate deliberately:

```powershell
git fetch origin
git merge origin/master
```

If Git reports conflicts, that means both branches changed the same area. Resolve the files explicitly. Preserve the current Academic Suite architecture and the mandatory product boundary while integrating the feature.

Do not use `git reset --hard`, force-push or destructive clean commands as a shortcut.

## 8. Cross-product rules

Katedra is the content/process product. Lekta is the technical document verification product.

If a requested Katedra feature needs to inspect the real DOCX for margins, fonts, Word fields, TOC, citation mechanics, bibliography mechanics or deterministic formal compliance, implement that capability in Lekta and expose only the result/handoff to Katedra.

If Katedra needs a production database schema change, the authoritative migration belongs in the Lekta repository. Katedra then consumes the new shared contract.

Changes to shared contracts such as `projectId`, `LektaResult`, ruleset IDs or handoff fields must be coordinated across both repositories and tested end to end.

## 9. Two-laptop development

It is safe for Katedra and Lekta to live on different laptops.

Each laptop only needs its own clone and local environment. GitHub coordinates source code; Supabase coordinates the shared backend.

The rule remains:

```text
pull/fetch current source -> feature branch -> local work -> commit -> push -> PR -> CI -> merge
```

Never copy source files manually between laptops as the normal synchronization mechanism.

## 10. Quick health check

At any time run:

```powershell
.\scripts\dev-doctor.ps1
```

For full TypeScript/lint/build verification:

```powershell
.\scripts\dev-doctor.ps1 -Full
```
