$ErrorActionPreference = "Stop"

$targetCmd = Resolve-Path (Join-Path $PSScriptRoot "Start-Mapster-LAN.cmd")
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Start Mapster LAN.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetCmd.Path
$shortcut.WorkingDirectory = $repoRoot.Path
$shortcut.Description = "Start Mapster server on local network"
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,13"
$shortcut.Save()

Write-Host "Created desktop shortcut: $shortcutPath"
