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

Write-Host '== Katedra - Zavrsi ==' -ForegroundColor Cyan
Write-Host "Repo: $repo"

foreach ($cmd in @('git', 'node', 'npm')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Stop-WithMessage "Nedostaje naredba '$cmd'."
  }
}

$origin = (git remote get-url origin 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $origin) {
  Stop-WithMessage 'Git origin nije ispravno postavljen.'
}

# Osvjezi remote stanje. Ne mijenja lokalni rad.
git fetch origin
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage 'git fetch origin nije uspio.'
}

$branch = (git branch --show-current).Trim()
$dirty = [bool](git status --porcelain)

# Finish nikad ne objavljuje izravno s mastera. Ako je korisnik ipak radio na
# masteru, prvo ga premjesti na rescue branch bez gubitka promjena.
if ($branch -eq 'master') {
  $ahead = [int](git rev-list --count origin/master..HEAD)
  if (-not $dirty -and $ahead -eq 0) {
    Write-Host ''
    Write-Host 'Nema lokalnog rada za objavu.' -ForegroundColor Green
    Read-Host 'Pritisni Enter za zatvaranje'
    exit 0
  }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $branch = "claude/rescue-finish-$stamp"
  git switch -c $branch
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage 'Nisam uspio napraviti rescue branch prije objave.'
  }
  Write-Host "Rad je sigurno premjesten na: $branch" -ForegroundColor Yellow
}

Write-Host ''
Write-Host "Branch: $branch" -ForegroundColor Cyan
Write-Host 'Pokrecem punu provjeru prije objave...' -ForegroundColor Cyan

powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\dev-doctor.ps1' -Full
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage 'Provjera nije prosla. Nista nije commitano ni pushano.'
}

$dirty = [bool](git status --porcelain)
if ($dirty) {
  Write-Host ''
  Write-Host 'Sve promjene iz ove Claude sesije ulaze u commit.' -ForegroundColor Cyan
  git add -A
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage 'git add nije uspio.'
  }

  $stampMessage = Get-Date -Format 'yyyy-MM-dd HH:mm'
  $commitMessage = "Claude session update $stampMessage"
  git commit -m $commitMessage
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage 'Commit nije uspio.'
  }
}
else {
  Write-Host 'Working tree je cist; objavljujem postojece lokalne commitove.' -ForegroundColor Green
}

$ahead = [int](git rev-list --count origin/master..HEAD)
if ($ahead -eq 0) {
  Write-Host ''
  Write-Host 'Nema commitova iznad origin/master za objavu.' -ForegroundColor Green
  Read-Host 'Pritisni Enter za zatvaranje'
  exit 0
}

Write-Host ''
Write-Host 'Pusham branch na GitHub...' -ForegroundColor Cyan
git push -u origin $branch
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage 'Push nije uspio. Lokalni commitovi su sacuvani.'
}

# GitHub Action automatski otvara draft PR za claude/* brancheve. Kao fallback,
# otvori compare stranicu u browseru; ako je PR vec napravljen, GitHub ce ga pokazati.
$repoSlug = $null
if ($origin -match 'github\.com[:/](?<slug>[^/]+/[^/.]+)(\.git)?$') {
  $repoSlug = $Matches['slug']
}

if ($repoSlug) {
  $branchEscaped = [uri]::EscapeDataString($branch)
  $compareUrl = "https://github.com/$repoSlug/compare/master...$branchEscaped?expand=1"
  Start-Process $compareUrl
}

Write-Host ''
Write-Host 'Gotovo.' -ForegroundColor Green
Write-Host 'Provjera: PROSLA' -ForegroundColor Green
Write-Host "Branch: $branch"
Write-Host 'Commit/push: GOTOVO' -ForegroundColor Green
Write-Host 'Draft PR: GitHub ga otvara automatski; browser je otvoren kao fallback.' -ForegroundColor Green
Write-Host ''
Write-Host 'Merge u master se NE radi automatski.' -ForegroundColor Yellow
Write-Host 'Nakon toga samo reci ChatGPT-u: "provjeri Katedru i mergeaj".' -ForegroundColor Cyan
Write-Host ''
Read-Host 'Pritisni Enter za zatvaranje'
