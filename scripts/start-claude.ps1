param()

$ErrorActionPreference = 'Stop'

function Stop-WithMessage([string]$Message) {
  Write-Host ''
  Write-Host $Message -ForegroundColor Red
  Write-Host ''
  Read-Host 'Pritisni Enter za zatvaranje'
  exit 1
}

$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo

Write-Host '== Katedra one-click launcher ==' -ForegroundColor Cyan
Write-Host "Repo: $repo"

foreach ($cmd in @('git', 'node', 'npm', 'claude')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Stop-WithMessage "Nedostaje naredba '$cmd'. Provjeri da je instalirana i dostupna u PATH-u."
  }
}

$origin = (git remote get-url origin 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $origin) {
  Stop-WithMessage 'Ovaj folder nema ispravno postavljen Git origin.'
}

Write-Host "Origin: $origin"

# Uvijek osvježi remote reference, ali nikad ne prepisuj lokalni rad.
git fetch origin
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage 'git fetch origin nije uspio.'
}

$branch = (git branch --show-current).Trim()
$dirty = [bool](git status --porcelain)

if ($dirty) {
  Write-Host ''
  Write-Host "Nastavljam postojeći rad na branchu: $branch" -ForegroundColor Yellow
  Write-Host 'Lokalne promjene se NE diraju i NE pullaju automatski.'
}
elseif ($branch -eq 'master') {
  Write-Host ''
  Write-Host 'Master je čist. Sinkroniziram ga s GitHubom...' -ForegroundColor Green
  git pull --ff-only origin master
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage 'Master se ne može sigurno fast-forwardati. Pokreni dev-doctor ili riješi divergirano stanje prije nastavka.'
  }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $newBranch = "claude/session-$stamp"
  git switch -c $newBranch
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "Nisam uspio napraviti branch $newBranch."
  }
  $branch = $newBranch
  Write-Host "Napravljen novi sigurni branch: $branch" -ForegroundColor Green
}
else {
  Write-Host ''
  Write-Host "Nastavljam postojeći čisti branch: $branch" -ForegroundColor Green
}

if (Test-Path '.\scripts\dev-doctor.ps1') {
  Write-Host ''
  Write-Host 'Brza provjera projekta...' -ForegroundColor Cyan
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\dev-doctor.ps1'
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Dev doctor je prijavio problem. Claude se ipak može otvoriti radi popravka.' -ForegroundColor Yellow
  }
}

Write-Host ''
Write-Host "Otvaram Claude Code na branchu: $branch" -ForegroundColor Cyan
Write-Host 'Kad izađeš iz Claudea, ovaj prozor će pokazati što se promijenilo.'
Write-Host ''

& claude
$claudeExit = $LASTEXITCODE

Write-Host ''
Write-Host '== Stanje nakon Claude sesije ==' -ForegroundColor Cyan
git status --short --branch

if ($claudeExit -ne 0) {
  Write-Host ''
  Write-Host "Claude je završio s exit kodom $claudeExit." -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Ništa nije automatski commitano, pushano ni mergeano.' -ForegroundColor DarkGray
Write-Host 'To ostaje svjesna završna odluka nakon pregleda promjena.' -ForegroundColor DarkGray
Read-Host 'Pritisni Enter za zatvaranje'
