<#
.SYNOPSIS
  Crée (ou remplace) les deux raccourcis du Bureau : « Kayro » et « Kayro (atelier) ».
.DESCRIPTION
  À lancer une fois (clic droit → Exécuter avec PowerShell). Relançable sans doublon.
  - Kayro            → scripts\Kayro.cmd : met à jour si besoin, puis ouvre Kayro (tes données).
  - Kayro (atelier)  → scripts\Kayro-atelier.cmd : atelier de DA + vraie fenêtre (données temporaires).
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$icon = Join-Path $root 'src-tauri\icons\icon.ico'
if (-not (Test-Path $icon)) { throw "Icône introuvable : $icon" }

$shell = New-Object -ComObject WScript.Shell
function New-Shortcut([string]$name, [string]$target, [int]$windowStyle, [string]$description) {
    $lnk = Join-Path $desktop "$name.lnk"
    $link = $shell.CreateShortcut($lnk)
    $link.TargetPath = $target
    $link.WorkingDirectory = $root
    $link.IconLocation = "$icon,0"
    $link.WindowStyle = $windowStyle  # 1 = normal, 7 = minimized
    $link.Description = $description
    $link.Save()
    Write-Host "Raccourci : $lnk" -ForegroundColor Green
}

# Minimized: the .cmd only hands over to a hidden PowerShell, nothing to show.
New-Shortcut 'Kayro' (Join-Path $PSScriptRoot 'Kayro.cmd') 7 'Kayro (mis à jour automatiquement)'
New-Shortcut 'Kayro (atelier)' (Join-Path $PSScriptRoot 'Kayro-atelier.cmd') 1 "Kayro : atelier de direction artistique"
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
