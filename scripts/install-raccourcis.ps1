<#
.SYNOPSIS
  Crée (ou remplace) les raccourcis du Bureau : « Kayro » et « Kayro — mettre à jour ».
.DESCRIPTION
  À lancer une fois (clic droit → Exécuter avec PowerShell). Relançable sans doublon.
  - Kayro                  → target\release\Kayro.exe : l'exe de production, tel quel (tes données).
  - Kayro — mettre à jour  → scripts\Kayro.cmd -Force : quitte Kayro doucement s'il est ouvert,
                             recompile en release, puis relance l'exe.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$icon = Join-Path $root 'src-tauri\icons\icon.ico'
if (-not (Test-Path $icon)) { throw "Icône introuvable : $icon" }

$exe = Join-Path $root 'target\release\Kayro.exe'
if (-not (Test-Path $exe)) { throw "Exe de production introuvable : $exe (lance d'abord scripts\build-local.ps1)" }

$shell = New-Object -ComObject WScript.Shell
function New-Shortcut([string]$name, [string]$target, [string]$arguments, [string]$workDir, [int]$windowStyle, [string]$description) {
    $lnk = Join-Path $desktop "$name.lnk"
    $link = $shell.CreateShortcut($lnk)
    $link.TargetPath = $target
    $link.Arguments = $arguments
    $link.WorkingDirectory = $workDir
    $link.IconLocation = "$icon,0"
    $link.WindowStyle = $windowStyle  # 1 = normal, 7 = minimized
    $link.Description = $description
    $link.Save()
    Write-Host "Raccourci : $lnk" -ForegroundColor Green
}

New-Shortcut 'Kayro' $exe '' (Split-Path -Parent $exe) 1 'Kayro (exe de production)'
# Minimized: the .cmd only hands over to a hidden PowerShell (its progress window shows the build).
New-Shortcut 'Kayro — mettre à jour' (Join-Path $PSScriptRoot 'Kayro.cmd') '-Force' $root 7 'Kayro : recompiler la dernière version puis relancer'
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
