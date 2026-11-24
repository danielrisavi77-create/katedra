param(
  [string]$Task,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path -Parent $PSScriptRoot

function Invoke-WorkflowStep {
  param([string]$Command, [string[]]$Arguments)
  $global:LASTEXITCODE = 0
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Korak '$Command' nije uspio (exit $LASTEXITCODE). Workflow je zaustavljen."
  }
}

Push-Location -LiteralPath $repo
try {
  Write-Host '== Katedra: Claude Code -> Grok -> provjere ==' -ForegroundColor Cyan
  foreach ($command in @('git', 'node', 'npm', 'claude', 'grok')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
      throw "Nedostaje '$command' u PATH-u. Instaliraj alat i ponovno otvori terminal."
    }
  }
  Invoke-WorkflowStep -Command 'git' -Arguments @('rev-parse', '--is-inside-work-tree')
  Invoke-WorkflowStep -Command 'git' -Arguments @('status', '--short', '--branch')

  if ($DryRun) {
    Write-Host '1. Claude Code: interaktivna implementacija zadatka.'
    Write-Host '2. Grok: interaktivni pregled u permission-mode plan.'
    Write-Host '3. npm run typecheck, lint, test:ci, build (prekid na prvoj gresci).'
    Write-Host 'Dry run: AI sesije i provjere nisu pokrenute.'
    exit 0
  }
  if ([string]::IsNullOrWhiteSpace($Task)) {
    $Task = Read-Host 'Opisi razvojni zadatak'
  }
  if ([string]::IsNullOrWhiteSpace($Task)) { throw 'Zadatak ne smije biti prazan.' }

  $rules = @'
Work in this Katedra repository. Read AGENTS.md, CLAUDE.md and relevant
docs/architecture and docs/autonomous documents. Preserve all pre-existing
user changes. Inspect Git status and diffs before acting. Do not stash,
reset, discard work, commit, push, merge or deploy. If on master or detached
HEAD, ask the user to select a development branch before editing.
Never read or expose secrets, .env contents, credentials or student manuscript
files. Never send manuscript text through /api/state or shared logs.
Lekta is the only DOCX/compliance authority. Entitlements are project-specific
and server-authorized. Do not enable agentic flags or bypass release gates.
Keep the scope limited to the task; distinguish earlier changes from this work.
'@
  $implementation = @"
$rules
Implement the following development task. Add a focused regression test where
appropriate. For UI/integration changes verify localhost and browser checks.
Explain changes, tests and remaining issues to the user before ending.
TASK:
$Task
"@
  Write-Host "`nClaude Code: implementacija. Izadji iz sesije za nastavak." -ForegroundColor Cyan
  Invoke-WorkflowStep -Command 'claude' -Arguments @('--permission-mode', 'default', $implementation)

  $review = @"
$rules
Review only; do not edit files or execute mutating commands. Inspect current
staged and unstaged diffs and relevant untracked source files. Earlier local
changes may be unrelated; do not attribute all changes to this task.
Check correctness, regressions, authorization, privacy and missing tests.
Report findings by severity with file and line references, then testing gaps
and remaining risks. Say explicitly if there are no findings. Do not infer
approval merely from passing tests. Do not create report files.
The launcher will run typecheck, lint, test:ci and build after you exit.
TASK TO REVIEW:
$Task
"@
  Write-Host "`nGrok: pregled. Izadji iz sesije za pokretanje provjera." -ForegroundColor Cyan
  Invoke-WorkflowStep -Command 'grok' -Arguments @('--permission-mode', 'plan', '--no-subagents', $review)

  foreach ($check in @('typecheck', 'lint', 'test:ci', 'build')) {
    Write-Host "`nProvjera: $check" -ForegroundColor Cyan
    Invoke-WorkflowStep -Command 'npm' -Arguments @('run', $check)
  }
  Invoke-WorkflowStep -Command 'git' -Arguments @('status', '--short', '--branch')
  Write-Host 'Provjere su prosle. Pregledaj Grokove nalaze prije prihvacanja promjena.' -ForegroundColor Green
  Write-Host 'Zavrsena Grok sesija nije automatsko odobrenje koda.'
}
catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
finally { Pop-Location }
