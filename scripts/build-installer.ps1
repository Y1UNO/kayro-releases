<#
.SYNOPSIS
  Compile Kayro en release et produit l'installeur NSIS (Kayro_<version>_x64-setup.exe).
.DESCRIPTION
  Pour envoyer Kayro a quelqu'un. Ne touche pas au raccourci du bureau (c'est le role de build-local.ps1),
  mais recompile target\release\Kayro.exe au passage : Kayro doit donc etre ferme.
  L'installeur ne contient aucune donnee utilisateur ni image de jeu (elles vivent dans %APPDATA%\Kayro).
.PARAMETER CloseRunning
  Ferme Kayro doucement (Kayro.exe --quit) s'il est ouvert, sans poser la question.
#>
[CmdletBinding()]
param([switch]$CloseRunning)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'target\release\Kayro.exe'
$conf = Get-Content (Join-Path $root 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$setup = Join-Path $root ("target\release\bundle\nsis\{0}_{1}_x64-setup.exe" -f $conf.productName, $conf.version)

function Stop-Here([string]$message) {
    Write-Host "Arret : $message" -ForegroundColor Red
    exit 1
}

function Get-RunningKayro {
    Get-Process -Name 'Kayro' -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and ($_.Path -ieq $exe) }
}

# 1. Kayro open from this repository: its exe is locked, close it softly (never a kill).
if (@(Get-RunningKayro).Count -gt 0) {
    if (-not $CloseRunning) { Stop-Here 'Kayro est ouvert. Ferme-le, ou relance avec -CloseRunning.' }
    Start-Process -FilePath $exe -ArgumentList '--quit' -WindowStyle Hidden
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-RunningKayro) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
    if (Get-RunningKayro) { Stop-Here 'Kayro ne s''est pas ferme. Ferme-le a la main puis relance.' }
}

# 2. Release build + NSIS bundle (targets and WebView2 mode come from tauri.conf.json).
Push-Location $root
try {
    Write-Host 'Compilation release + installeur (npm run tauri build)...'
    npm run tauri build
    if ($LASTEXITCODE -ne 0) { Stop-Here "la compilation a echoue (code $LASTEXITCODE)." }
}
finally { Pop-Location }

if (-not (Test-Path $setup)) { Stop-Here "installeur introuvable : $setup" }
$size = (Get-Item $setup).Length / 1MB
Write-Host ("Pret : {0} ({1:N1} Mo)" -f $setup, $size) -ForegroundColor Green
