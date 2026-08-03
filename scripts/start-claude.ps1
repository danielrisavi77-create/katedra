param()

$ErrorActionPreference = 'Stop'

function Stop-WithMessage([string]$Message) {
  Write-Host ''
  Write-Host $Message -ForegroundColor Red
  Write-Host ''
  Read-Host 'Pritisni Enter za zatvaranje'
  exit 1
}

function Start-NewClaudeBranch {
  Write-Host ''
  Write-Host 'Sinkroniziram master s GitHubom...' -ForegroundColor Green

  git switch master
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage 'Ne mogu se prebaciti na master.'
  }

  git pull --ff-only origin master
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage 'Master se ne može sigurno fast-forwardati. Pokreni dev-doctor prije nastavka.'
  }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $newBranch = "claude/session-$stamp"
  git switch -c $newBranch
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "Nisam uspio napraviti branch $newBranch."
  }

  return $newBranch
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

# Osvježi remote reference, ali nikad ne prepisuj lokalni rad.
git fetch origin
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage 'git fetch origin nije uspio.'
}

$branch = (git branch --show-current).Trim()
$dirty = [bool](git status --porcelain)

if ($dirty) {
  if ($branch -eq 'master') {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $rescueBranch = "claude/rescue-$stamp"

    Write-Host ''
    Write-Host 'Na masteru postoje lokalne promjene.' -ForegroundColor Yellow
    Write-Host "Automatski ih spašavam na: $rescueBranch"

    git switch -c $rescueBranch
    if ($LASTEXITCODE -ne 0) {
      Stop-WithMessage 'Nisam uspio napraviti rescue branch. Lokalne promjene nisu dirane.'
    }
    $branch = $rescueBranch
  }

  Write-Host ''
  Write-Host "Nastavljam postojeći rad na branchu: $branch" -ForegroundColor Yellow
  Write-Host 'Lokalne promjene se NE diraju i NE pullaju automatski.'
}
elseif ($branch -eq 'master') {
  $branch = Start-NewClaudeBranch
  Write-Host "Napravljen novi sigurni branch: $branch" -ForegroundColor Green
}
else {
  # Ako je trenutni čisti branch već dio origin/mastera, posao je završen:
  # automatski kreni iz svježeg mastera u novoj sesiji.
  git merge-base --is-ancestor HEAD origin/master 2>$null
  $alreadyMerged = ($LASTEXITCODE -eq 0)

  if ($alreadyMerged) {
    Write-Host ''
    Write-Host "Branch '$branch' je već mergean u master." -ForegroundColor Green
    $branch = Start-NewClaudeBranch
    Write-Host "Napravljen novi sigurni branch: $branch" -ForegroundColor Green
  }
  else {
    Write-Host ''
    Write-Host "Nastavljam postojeći čisti branch: $branch" -ForegroundColor Green
  }
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
