param(
  [switch]$Install,
  [switch]$Verify
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Nedostaje '$Name'. Instaliraj ga i ponovno pokreni skriptu."
  }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "== Katedra local bootstrap ==" -ForegroundColor Cyan

Require-Command git
Require-Command node
Require-Command npm

if (-not (Test-Path '.git')) {
  throw "Ova skripta mora se pokrenuti unutar kloniranog Katedra Git repozitorija."
}

if (-not (Test-Path 'package.json')) {
  throw "package.json nije pronađen u očekivanom rootu repozitorija."
}

$origin = (git remote get-url origin 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $origin) {
  throw "Git remote 'origin' nije konfiguriran."
}

Write-Host "Repo:   $RepoRoot"
Write-Host "Origin: $origin"
Write-Host "Node:   $(node --version)"
Write-Host "npm:    $(npm --version)"
Write-Host "Git:    $(git --version)"

$branch = (git branch --show-current).Trim()
$dirty = @(git status --porcelain)
Write-Host "Branch: $branch"

Write-Host "`nFetching origin..." -ForegroundColor DarkCyan
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "git fetch origin nije uspio." }

if ($branch -eq 'master') {
  if ($dirty.Count -gt 0) {
    Write-Warning "Working tree nije čist. Neću automatski povući master jer bi to moglo ugroziti lokalne izmjene."
    Write-Host "Prvo sačuvaj izmjene na posebnom branchu/commitu, zatim ponovno pokreni bootstrap."
  } else {
    Write-Host "Updating master with fast-forward only..." -ForegroundColor DarkCyan
    git pull --ff-only origin master
    if ($LASTEXITCODE -ne 0) { throw "master se ne može fast-forwardati. Provjeri lokalnu Git povijest." }
  }
} else {
  Write-Host "Nisi na masteru; neću mijenjati trenutni feature branch." -ForegroundColor Yellow
  Write-Host "origin/master je osvježen i dostupan za namjerni merge/rebase."
}

if (-not (Test-Path '.env.local')) {
  Write-Warning ".env.local ne postoji. Skripta neće stvarati niti izmišljati tajne."
  Write-Host "Koristi .env.example kao popis potrebnih varijabli i lokalno napravi .env.local."
} else {
  Write-Host ".env.local postoji (vrijednosti se ne ispisuju)." -ForegroundColor Green
}

if ($Install -or -not (Test-Path 'node_modules')) {
  Write-Host "`nInstalling exact npm dependencies with npm ci..." -ForegroundColor DarkCyan
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci nije uspio." }
} else {
  Write-Host "node_modules postoji; preskačem npm ci. Koristi -Install za čistu reinstalaciju."
}

if ($Verify) {
  Write-Host "`nRunning TypeScript check..." -ForegroundColor DarkCyan
  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) { throw "TypeScript provjera nije prošla." }

  Write-Host "Running lint..." -ForegroundColor DarkCyan
  npm run lint
  if ($LASTEXITCODE -ne 0) { throw "Lint nije prošao." }

  Write-Host "Running production build..." -ForegroundColor DarkCyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Production build nije prošao." }
}

Write-Host "`nBootstrap završen." -ForegroundColor Green
Write-Host "Za novi Claude Code zadatak pokreni:"
Write-Host ".\scripts\new-feature.ps1 -Name \"opis zadatka\"" -ForegroundColor Cyan
