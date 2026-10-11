<#
.SYNOPSIS
  Lanceur « un clic » de l'atelier de DA (raccourci Bureau « Kayro (atelier) », via Kayro-atelier.cmd).
.DESCRIPTION
  1. Port 1420 : réutilise le serveur Vite de Kayro s'il tourne déjà ; si un autre programme
     occupe le port, dit lequel et propose de le fermer ; sinon démarre Vite (sortie dans
     %LOCALAPPDATA%\Kayro-lanceur\atelier.log, fin du journal affichée en cas d'échec).
  2. Ouvre http://localhost:1420/dev/atelier dans le navigateur par défaut.
  3. Lance la vraie fenêtre WebView2 (npm run dev:atelier-bench, rechargement à chaud) avec des
     données temporaires (%TEMP%\Kayro-atelier) et sa propre identité (fr.yiuno.hub.atelier) :
     elle tourne à côté de Kayro sans toucher à ses données.
  Fermer cette fenêtre de console (ou la fenêtre de l'atelier) arrête l'atelier.
.PARAMETER ServerOnly
  Test : s'arrête après le serveur (pas de navigateur, pas de fenêtre).
.PARAMETER NoBrowser
  N'ouvre pas le navigateur.
#>
param([switch]$ServerOnly, [switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$port = 1420
$url = "http://localhost:$port/dev/atelier"
$logDir = Join-Path $env:LOCALAPPDATA 'Kayro-lanceur'
$log = Join-Path $logDir 'atelier.log'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$Host.UI.RawUI.WindowTitle = "Kayro (atelier) - fermer cette fenetre arrete l'atelier"
Add-Type -AssemblyName System.Windows.Forms

function Write-Step([string]$text, [string]$color = 'Gray') {
    Write-Host $text -ForegroundColor $color
    # While Vite runs, its redirection holds the log: the console alone then has the message.
    try { Add-Content -Path $log -Value "[$(Get-Date -Format 'HH:mm:ss')] $text" -Encoding UTF8 -ErrorAction Stop }
    catch { }
}

# Keeps the console open so the message can be read (the shortcut window would vanish).
function Stop-WithError([string]$text) {
    Write-Step $text 'Red'
    Write-Host ''
    Write-Host "Journal : $log" -ForegroundColor Yellow
    [void](Read-Host 'Appuie sur Entrée pour fermer')
    exit 1
}

# Vite listens on "localhost", which is often [::1] only (IPv6): test both loopbacks.
function Test-Port([int]$p) {
    foreach ($addr in '::1', '127.0.0.1') {
        $family = if ($addr -eq '::1') { [Net.Sockets.AddressFamily]::InterNetworkV6 } else { [Net.Sockets.AddressFamily]::InterNetwork }
        $c = New-Object Net.Sockets.TcpClient($family)
        # A refused connection takes ~2 s on Windows: wait 300 ms at most (loopback answers at once).
        try { if ($c.ConnectAsync($addr, $p).Wait(300) -and $c.Connected) { return $true } }
        catch { } finally { $c.Dispose() }
    }
    $false
}

function Get-PortOwner([int]$p) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) { return $null }
    Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)"
}

# Kayro's own Vite server answers the workshop endpoint (vite/atelier.ts) with JSON.
function Test-KayroVite {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$port/__atelier/presets" -UseBasicParsing -TimeoutSec 5
        return ($r.StatusCode -eq 200 -and $r.Content.TrimStart().StartsWith('{'))
    }
    catch { return $false }
}

# A shortcut may start with a shorter PATH than a terminal: find node/npm/cargo explicitly.
function Resolve-Tool([string]$name, [string[]]$candidates) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Source }
    foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
    return $null
}

Set-Content -Path $log -Value "=== Atelier Kayro, $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" -Encoding UTF8

$nodeDirs = @(
    (Join-Path $env:ProgramFiles 'nodejs'),
    (Join-Path ${env:ProgramFiles(x86)} 'nodejs'),
    $env:NVM_SYMLINK,
    (Join-Path $env:LOCALAPPDATA 'Programs\nodejs')
) | Where-Object { $_ }
$npm = Resolve-Tool 'npm.cmd' ($nodeDirs | ForEach-Object { Join-Path $_ 'npm.cmd' })
$node = Resolve-Tool 'node.exe' ($nodeDirs | ForEach-Object { Join-Path $_ 'node.exe' })
$cargo = Resolve-Tool 'cargo.exe' @((Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'))
if (-not $npm -or -not $node) { Stop-WithError "Node.js introuvable (npm : $npm, node : $node). Installe Node.js ou ajoute-le au PATH." }
if (-not $ServerOnly -and -not $cargo) { Stop-WithError 'Rust (cargo) introuvable. Installe Rust (rustup) ou ajoute ~\.cargo\bin au PATH.' }
# Children (npm scripts, tauri, cargo) find the same tools.
$extra = @((Split-Path $node), (Split-Path $npm)) + $(if ($cargo) { @(Split-Path $cargo) } else { @() })
$env:PATH = (($extra | Select-Object -Unique) -join ';') + ';' + $env:PATH
Write-Step "node : $node"
Write-Step "npm  : $npm"
if ($cargo) { Write-Step "cargo : $cargo" }

# 1. Port 1420.
$vite = $null
if (Test-Port $port) {
    if (Test-KayroVite) {
        Write-Step "Serveur Vite de Kayro déjà en marche sur le port $port : réutilisé." 'Green'
    }
    else {
        $owner = Get-PortOwner $port
        $who = if ($owner) { "$($owner.Name) (PID $($owner.ProcessId))`n$($owner.CommandLine)" } else { 'un programme inconnu' }
        Write-Step "Le port $port est occupé par $who" 'Yellow'
        $answer = [System.Windows.Forms.MessageBox]::Show(
            "Le port $port, nécessaire à l'atelier, est occupé par :`n`n$who`n`nFermer ce programme ?",
            'Kayro (atelier)', 'YesNo', 'Warning')
        if ($answer -ne 'Yes' -or -not $owner) { Stop-WithError "Port $port occupé : atelier non démarré." }
        Stop-Process -Id $owner.ProcessId -Force
        $deadline = (Get-Date).AddSeconds(10)
        while ((Test-Port $port) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
        if (Test-Port $port) { Stop-WithError "Le port $port est toujours occupé." }
        Write-Step "$($owner.Name) fermé."
    }
}
if (-not (Test-Port $port)) {
    Write-Step 'Démarrage du serveur de développement (Vite)…'
    # Redirected by cmd (not PowerShell): appended to the log, read back on failure.
    $vite = Start-Process -FilePath $env:ComSpec -WorkingDirectory $root -WindowStyle Hidden -PassThru `
        -ArgumentList "/d /c `"`"$npm`" run dev >> `"$log`" 2>&1`""
    $deadline = (Get-Date).AddSeconds(60)
    while (-not (Test-Port $port)) {
        if ($vite.HasExited -or (Get-Date) -gt $deadline) {
            $why = if ($vite.HasExited) { "Vite s'est arrêté (code $($vite.ExitCode))" } else { 'pas de réponse en 60 s' }
            Write-Host ''
            Write-Host '--- Fin de la sortie de Vite ---' -ForegroundColor Yellow
            Get-Content $log -Tail 30 | ForEach-Object { Write-Host $_ }
            Write-Host '--------------------------------' -ForegroundColor Yellow
            if (-not $vite.HasExited) { & taskkill.exe /PID $vite.Id /T /F | Out-Null }
            Stop-WithError "Le serveur de développement n'a pas démarré sur le port $port : $why."
        }
        Start-Sleep -Milliseconds 500
    }
    Write-Step "Serveur prêt : http://localhost:$port" 'Green'
}
if ($ServerOnly) {
    Write-Step 'Test -ServerOnly : arrêt avant le navigateur et la fenêtre.'
    if ($vite -and -not $vite.HasExited) { & taskkill.exe /PID $vite.Id /T /F | Out-Null; Write-Step 'Serveur arrêté.' }
    exit 0
}

# 2. The workshop in the default browser.
if (-not $NoBrowser) { Start-Process $url }

# 3. The real WebView2 window, with temporary data.
$data = Join-Path $env:TEMP 'Kayro-atelier'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$env:APPDATA = $data
Write-Step "Atelier : $url"
Write-Step "Données de l'atelier : $data\Kayro (tes vraies données ne sont pas touchées)"
Write-Step 'Compilation puis ouverture de la fenêtre (environ 30 s la première fois)…' 'Cyan'
Push-Location $root
try {
    & $env:ComSpec /d /c "`"$npm`" run dev:atelier-bench"
    $code = $LASTEXITCODE
}
finally {
    Pop-Location
    # Stop the dev server only if this script started it.
    if ($vite -and -not $vite.HasExited) { & taskkill.exe /PID $vite.Id /T /F | Out-Null }
}
if ($code -ne 0) { Stop-WithError "La fenêtre de l'atelier s'est arrêtée avec le code $code (voir les messages ci-dessus)." }
