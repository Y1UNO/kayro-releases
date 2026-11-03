<#
.SYNOPSIS
  Compile Kayro en release et cree/met a jour le raccourci "Kayro.lnk" sur le bureau.
.DESCRIPTION
  Relancable a volonte : le raccourci est reecrit au meme endroit (jamais de doublon).
  Si Kayro est ouvert, propose de le fermer doucement (Kayro.exe --quit = « Quitter », jamais de kill).
.PARAMETER CloseRunning
  Ferme Kayro sans poser la question s'il est ouvert.
.PARAMETER NoBuild
  Ne compile pas : met seulement le raccourci a jour (l'exe doit deja exister).
#>
[CmdletBinding()]
param(
    [switch]$CloseRunning,
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'target\release\Kayro.exe'
$icon = Join-Path $root 'src-tauri\icons\icon.ico'
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'Kayro.lnk'

function Stop-Here([string]$message) {
    Write-Host "Arret : $message" -ForegroundColor Red
    exit 1
}

function Get-RunningKayro {
    # Only the Kayro.exe of this repository (not a copy installed elsewhere).
    Get-Process -Name 'Kayro' -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and ($_.Path -ieq $exe) }
}

# 1. Kayro already open: the exe is locked, so it must be closed before the build.
$running = @(Get-RunningKayro)
if ($running.Count -gt 0) {
    $close = $CloseRunning.IsPresent
    if (-not $close -and [Environment]::UserInteractive) {
        try {
            $answer = Read-Host 'Kayro est ouvert. Le fermer doucement pour mettre a jour ? (o/N)'
            $close = $answer -match '^(o|oui|y|yes)$'
        }
        catch { $close = $false }  # console not interactive: same as answering no
    }
    if (-not $close) {
        Stop-Here 'Kayro est ouvert. Ferme-le, ou relance avec -CloseRunning.'
    }
    # The window's cross only hides Kayro (it lives in the notification area): `--quit` asks the
    # running one to quit as with « Quitter » (single instance), never a kill.
    Start-Process -FilePath $exe -ArgumentList '--quit' -WindowStyle Hidden
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-RunningKayro) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
    if (Get-RunningKayro) {
        Stop-Here 'Kayro ne s''est pas ferme (fenetre cachee ou confirmation en attente). Ferme-le a la main puis relance.'
    }
    Write-Host 'Kayro ferme.'
}

# 2. Release build (no installer).
if (-not $NoBuild) {
    Push-Location $root
    try {
        # The music mode's AI rhythm (src-tauri\resources\ai, out of git): fetched once if missing.
        & (Join-Path $PSScriptRoot 'fetch-ai.ps1')
        Write-Host 'Compilation release (npm run tauri build -- --no-bundle)...'
        # Step 18b: the updater's key, when there is one (only the bundles are signed).
        $key = Join-Path $env:USERPROFILE '.kayro\kayro-updater.key'
        if (Test-Path $key) {
            $env:TAURI_SIGNING_PRIVATE_KEY = $key
            $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
        }
        npm run tauri build -- --no-bundle
        if ($LASTEXITCODE -ne 0) { Stop-Here "la compilation a echoue (code $LASTEXITCODE)." }
    }
    finally {
        Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY, Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
        Pop-Location
    }
}
if (-not (Test-Path $exe)) { Stop-Here "exe introuvable : $exe" }
if (-not (Test-Path $icon)) { Stop-Here "icone introuvable : $icon" }

# 3. Desktop shortcut, rewritten in place, unless it already goes through the one-click launcher
#    (scripts\Kayro.cmd, installed by install-raccourcis.ps1): that one stays as it is.
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($lnk)
if ($link.TargetPath -and ($link.TargetPath -ieq (Join-Path $PSScriptRoot 'Kayro.cmd'))) {
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
    Write-Host "Pret : $exe (raccourci du lanceur conserve)" -ForegroundColor Green
    exit 0
}
$link.TargetPath = $exe
$link.WorkingDirectory = Split-Path -Parent $exe
$link.IconLocation = "$icon,0"
$link.Description = 'Kayro'
$link.Save()
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)

Write-Host "Pret : $lnk -> $exe" -ForegroundColor Green
