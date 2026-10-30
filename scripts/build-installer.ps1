<#
.SYNOPSIS
  Compile Kayro en release et produit l'installeur NSIS (Kayro_<version>_x64-setup.exe) signe pour
  les mises a jour, l'installeur maison qui le porte (Kayro_<version>_Installer.exe), et le dossier
  a publier (target\release\publish\<version>\ : les deux installeurs, la signature, latest.json).
.DESCRIPTION
  Pour envoyer Kayro a quelqu'un. Ne touche pas au raccourci du bureau (c'est le role de build-local.ps1),
  mais recompile target\release\Kayro.exe au passage : Kayro doit donc etre ferme.
  L'installeur ne contient aucune donnee utilisateur ni image de jeu (elles vivent dans %APPDATA%\Kayro).
  Signature (etape 18b) : la cle privee %USERPROFILE%\.kayro\kayro-updater.key, jamais dans le depot.
.PARAMETER CloseRunning
  Ferme Kayro doucement (Kayro.exe --quit) s'il est ouvert, sans poser la question.
#>
[CmdletBinding()]
param([switch]$CloseRunning)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'target\release\Kayro.exe'
$conf = Get-Content (Join-Path $root 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$version = $conf.version
$setup = Join-Path $root ("target\release\bundle\nsis\{0}_{1}_x64-setup.exe" -f $conf.productName, $version)
$key = Join-Path $env:USERPROFILE '.kayro\kayro-updater.key'

function Stop-Here([string]$message) {
    Write-Host "Arret : $message" -ForegroundColor Red
    exit 1
}

function Get-RunningKayro {
    Get-Process -Name 'Kayro' -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and ($_.Path -ieq $exe) }
}

if (-not (Test-Path $key)) { Stop-Here "cle de signature introuvable : $key (docs/MISES-A-JOUR.md)" }

# 1. Kayro open from this repository: its exe is locked, close it softly (never a kill).
if (@(Get-RunningKayro).Count -gt 0) {
    if (-not $CloseRunning) { Stop-Here 'Kayro est ouvert. Ferme-le, ou relance avec -CloseRunning.' }
    Start-Process -FilePath $exe -ArgumentList '--quit' -WindowStyle Hidden
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-RunningKayro) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
    if (Get-RunningKayro) { Stop-Here 'Kayro ne s''est pas ferme. Ferme-le a la main puis relance.' }
}

# 2. Release build + NSIS bundle, signed for the updater (targets, WebView2 mode: tauri.conf.json).
Push-Location $root
try {
    Write-Host 'Compilation release + installeur signe (npm run tauri build)...'
    $env:TAURI_SIGNING_PRIVATE_KEY = $key
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
    npm run tauri build
    if ($LASTEXITCODE -ne 0) { Stop-Here "la compilation a echoue (code $LASTEXITCODE)." }
}
finally {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY, Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
    Pop-Location
}

if (-not (Test-Path $setup)) { Stop-Here "installeur introuvable : $setup" }
if (-not (Test-Path "$setup.sig")) { Stop-Here "signature introuvable : $setup.sig" }
$size = (Get-Item $setup).Length / 1MB
Write-Host ("Pret : {0} ({1:N1} Mo)" -f $setup, $size) -ForegroundColor Green

# 3. Kayro's own installer (installer/): its page, then the window carrying the NSIS installer.
$styled = Join-Path $root ("target\release\bundle\{0}_{1}_Installer.exe" -f $conf.productName, $version)
Push-Location $root
try {
    Write-Host 'Installeur maison : page (Vite) puis fenetre (cargo)...'
    npx vite build --config installer/vite.config.ts
    if ($LASTEXITCODE -ne 0) { Stop-Here "la page de l'installeur n'a pas ete construite (code $LASTEXITCODE)." }
    $env:KAYRO_PAYLOAD = $setup
    cargo build --release -p kayro-setup
    if ($LASTEXITCODE -ne 0) { Stop-Here "l'installeur maison n'a pas compile (code $LASTEXITCODE)." }
}
finally {
    Remove-Item Env:KAYRO_PAYLOAD -ErrorAction SilentlyContinue
    Pop-Location
}
Copy-Item (Join-Path $root 'target\release\KayroSetup.exe') $styled -Force
$size = (Get-Item $styled).Length / 1MB
Write-Host ("Pret : {0} ({1:N1} Mo)" -f $styled, $size) -ForegroundColor Green

# 4. The folder to publish: both installers, the signature, and latest.json (what Kayro reads).
& (Join-Path $PSScriptRoot 'release-manifest.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
