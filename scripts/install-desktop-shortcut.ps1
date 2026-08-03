$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$startLauncher = Join-Path $repo 'Katedra-Claude.cmd'
$finishLauncher = Join-Path $repo 'Katedra-Zavrsi.cmd'

foreach ($launcher in @($startLauncher, $finishLauncher)) {
  if (-not (Test-Path -LiteralPath $launcher)) {
    throw "Ne nalazim launcher: $launcher"
  }
}

$desktop = [Environment]::GetFolderPath('Desktop')
$wsh = New-Object -ComObject WScript.Shell

function New-KatedraShortcut(
  [string]$Name,
  [string]$Target,
  [string]$Description,
  [int]$IconIndex
) {
  $shortcutPath = Join-Path $desktop "$Name.lnk"
  $shortcut = $wsh.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $Target
  $shortcut.WorkingDirectory = $repo
  $shortcut.Description = $Description
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,$IconIndex"
  $shortcut.Save()
  return $shortcutPath
}

$startPath = New-KatedraShortcut -Name 'Katedra - Claude' -Target $startLauncher -Description 'Pokreni sigurnu Katedra razvojnu sesiju u Claude Codeu' -IconIndex 220
$finishPath = New-KatedraShortcut -Name 'Katedra - Zavrsi' -Target $finishLauncher -Description 'Provjeri, commitaj i pushaj Katedra Claude sesiju te otvori draft PR' -IconIndex 167

Write-Host ''
Write-Host 'Desktop shortcuti su instalirani:' -ForegroundColor Green
Write-Host $startPath
Write-Host $finishPath
Write-Host ''
Write-Host 'Workflow od sada:' -ForegroundColor Cyan
Write-Host '1. Dvoklik "Katedra - Claude" za pocetak rada.'
Write-Host '2. Izadi iz Claude Codea kad zavrsis.'
Write-Host '3. Dvoklik "Katedra - Zavrsi" za provjeru, commit, push i draft PR.'
Write-Host '4. U ChatGPT-u reci: "provjeri Katedru i mergeaj".'
Write-Host ''
Read-Host 'Pritisni Enter za zatvaranje'
