param(
  [Parameter(Mandatory = $true)]
  [string]$Name,

  [ValidateSet('claude','feature','fix','chore')]
  [string]$Prefix = 'claude'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not (Test-Path '.git')) {
  throw "Nisi u Katedra Git repozitoriju."
}

$dirty = @(git status --porcelain)
if ($dirty.Count -gt 0) {
  Write-Host "Working tree ima lokalne izmjene:" -ForegroundColor Yellow
  git status --short
  throw "Sačuvaj postojeće izmjene commitom ili stashom prije otvaranja novog feature brancha."
}

$slug = $Name.ToLowerInvariant() -replace '[^a-z0-9]+','-'
$slug = $slug.Trim('-')
if (-not $slug) { throw "Naziv zadatka mora sadržavati barem jedno slovo ili broj." }
if ($slug.Length -gt 60) { $slug = $slug.Substring(0,60).Trim('-') }

$branchName = "$Prefix/$slug"

Write-Host "Fetching origin..." -ForegroundColor DarkCyan
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "git fetch origin nije uspio." }

Write-Host "Switching to master..." -ForegroundColor DarkCyan
git switch master
if ($LASTEXITCODE -ne 0) { throw "Ne mogu prijeći na master." }

Write-Host "Updating master with fast-forward only..." -ForegroundColor DarkCyan
git pull --ff-only origin master
if ($LASTEXITCODE -ne 0) {
  throw "Lokalni master odstupa od origin/master. Neću automatski prepisivati povijest."
}

$existing = (git branch --list $branchName).Trim()
if ($existing) {
  throw "Branch '$branchName' već postoji. Odaberi drugi naziv ili nastavi postojeći branch."
}

Write-Host "Creating $branchName..." -ForegroundColor DarkCyan
git switch -c $branchName
if ($LASTEXITCODE -ne 0) { throw "Kreiranje feature brancha nije uspjelo." }

Write-Host "`nSpremno za Claude Code." -ForegroundColor Green
Write-Host "Branch: $branchName" -ForegroundColor Cyan
Write-Host "CLAUDE.md i .claude/settings.json vrijede automatski iz roota projekta."
