param(
  [switch]$Full
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Pass([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Fail([string]$Message) { Write-Host "[FAIL] $Message" -ForegroundColor Red }

Write-Host "== Katedra dev doctor ==" -ForegroundColor Cyan

foreach ($cmd in @('git','node','npm')) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) {
    Pass "$cmd je dostupan"
  } else {
    Fail "$cmd nije pronađen"
    exit 1
  }
}

if (-not (Test-Path '.git')) { Fail 'Nije Git repozitorij'; exit 1 }
if (-not (Test-Path 'package.json')) { Fail 'package.json nedostaje'; exit 1 }

$origin = (git remote get-url origin 2>$null)
if ($LASTEXITCODE -eq 0 -and $origin) { Pass "origin: $origin" } else { Fail "origin nije konfiguriran"; exit 1 }

$branch = (git branch --show-current).Trim()
if ($branch -eq 'master') {
  Warn "Trenutno si na masteru. Za razvoj koristi .\scripts\new-feature.ps1."
} else {
  Pass "Razvojni branch: $branch"
}

$dirty = @(git status --porcelain)
if ($dirty.Count -eq 0) {
  Pass 'Working tree je čist'
} else {
  Warn "Working tree ima $($dirty.Count) lokalnih promjena"
  git status --short
}

git fetch origin --quiet
if ($LASTEXITCODE -eq 0) {
  Pass 'origin fetch uspješan'
  $counts = (git rev-list --left-right --count HEAD...origin/master).Trim() -split '\s+'
  if ($counts.Count -ge 2) {
    $localOnly = [int]$counts[0]
    $masterOnly = [int]$counts[1]
    if ($masterOnly -gt 0) { Warn "Tvoj branch je iza origin/master za $masterOnly commit(a)" }
    else { Pass 'Branch nije iza origin/master' }
    if ($localOnly -gt 0) { Write-Host "[INFO] Lokalni branch ima $localOnly commit(a) koji nisu na origin/master" -ForegroundColor DarkCyan }
  }
} else {
  Warn 'git fetch origin nije uspio; remote status nije provjeren'
}

Write-Host "Node $(node --version), npm $(npm --version)"

if (Test-Path 'node_modules') { Pass 'node_modules postoji' } else { Warn 'node_modules nedostaje; pokreni npm ci' }

if (Test-Path '.env.local') {
  Pass '.env.local postoji (vrijednosti se ne ispisuju)'
  $envText = Get-Content '.env.local' -Raw
  foreach ($name in @('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_APP_URL')) {
    if ($envText -match "(?m)^$([regex]::Escape($name))\s*=\s*.+$") { Pass "$name je postavljen" }
    else { Warn "$name nije pronađen u .env.local" }
  }
} else {
  Warn '.env.local nedostaje'
}

if ($Full) {
  Write-Host "`nRunning full verification..." -ForegroundColor DarkCyan

  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) { Fail 'TypeScript check'; exit 1 } else { Pass 'TypeScript check' }

  npm run lint
  if ($LASTEXITCODE -ne 0) { Fail 'Lint'; exit 1 } else { Pass 'Lint' }

  npm run build
  if ($LASTEXITCODE -ne 0) { Fail 'Production build'; exit 1 } else { Pass 'Production build' }
}

Write-Host "`nDoctor završen." -ForegroundColor Cyan
