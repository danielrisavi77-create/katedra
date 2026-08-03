$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $repo 'Katedra-Claude.cmd'

if (-not (Test-Path -LiteralPath $launcher)) {
  throw "Ne nalazim launcher: $launcher"
}

$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Katedra - Claude.lnk'

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $repo
$shortcut.Description = 'Pokreni Katedra razvojnu sesiju u Claude Codeu'
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$shortcut.Save()

Write-Host ''
Write-Host 'Desktop shortcut je instaliran:' -ForegroundColor Green
Write-Host $shortcutPath
Write-Host ''
Write-Host 'Od sada samo dvoklikni "Katedra - Claude" na Desktopu.' -ForegroundColor Cyan
Write-Host ''
Read-Host 'Pritisni Enter za zatvaranje'
