<#
.SYNOPSIS
  Lanceur « un clic » de Kayro (raccourci Bureau, via Kayro.cmd).
.DESCRIPTION
  - Sources plus récentes que target\release\Kayro.exe (dernier commit git ou fichiers modifiés
    dans src\, src-tauri\src\, package.json…) : recompile en release avec build-local.ps1 dans une
    petite fenêtre « Mise à jour de Kayro… », puis lance l'exe tout neuf.
  - Sinon : lance l'exe tout de suite.
  - Compilation en échec : affiche l'erreur (fin du journal) et lance la dernière version qui marchait.
  - Kayro déjà ouvert : pas de mise à jour (l'exe est verrouillé), la fenêtre ouverte est affichée.
    Avec -Force (raccourci « Kayro — mettre à jour ») : Kayro est d'abord quitté doucement
    (Kayro.exe --quit, comme « Quitter »), puis recompilé et relancé.
  Données : celles de l'utilisateur (%APPDATA%\Kayro), comme l'app installée.
#>
# -Force : quitte Kayro s'il est ouvert et recompile même si tout est à jour.
# -CheckOnly : dit seulement s'il faut recompiler.
param([switch]$Force, [switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'target\release\Kayro.exe'
$logDir = Join-Path $env:LOCALAPPDATA 'Kayro-lanceur'
$log = Join-Path $logDir 'derniere-compilation.log'
# Time of the last successful update (a build that changes nothing does not touch the exe).
$stamp = Join-Path $logDir 'derniere-compilation.ok'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

function Show-Message([string]$text, [string]$icon = 'Information') {
    [void][System.Windows.Forms.MessageBox]::Show($text, 'Kayro', 'OK', $icon)
}

function Start-Kayro {
    if (Test-Path $exe) { Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe) }
    else { Show-Message "Kayro n'a encore jamais été compilé et la compilation a échoué.`n`nJournal : $log" 'Error' }
}

function Get-RunningKayro {
    Get-Process -Name 'Kayro' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and ($_.Path -ieq $exe) }
}

# Newest change of the sources that end up in the exe (presets and tests are not in the build).
function Get-SourcesTime {
    $newest = [datetime]::MinValue
    $dirs = 'src', 'src-tauri\src', 'src-tauri\icons', 'public'
    foreach ($d in $dirs) {
        $p = Join-Path $root $d
        if (-not (Test-Path $p)) { continue }
        Get-ChildItem -Path $p -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '\\design\\presets\\' -and $_.Name -notmatch '\.test\.tsx?$' } |
            ForEach-Object { if ($_.LastWriteTime -gt $newest) { $newest = $_.LastWriteTime } }
    }
    $files = 'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'src-tauri\Cargo.toml', 'Cargo.lock', 'src-tauri\tauri.conf.json', 'src-tauri\build.rs'
    foreach ($f in $files) {
        $p = Join-Path $root $f
        if ((Test-Path $p) -and (Get-Item $p).LastWriteTime -gt $newest) { $newest = (Get-Item $p).LastWriteTime }
    }
    try {
        $ct = git -C $root log -1 --format=%ct 2>$null
        if ($ct) {
            $commit = [DateTimeOffset]::FromUnixTimeSeconds([long]$ct).LocalDateTime
            if ($commit -gt $newest) { $newest = $commit }
        }
    }
    catch { }  # git missing: file times only
    $newest
}

# Runs build-local.ps1 hidden, with a small progress window. Returns $true on success.
function Invoke-Update {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'Kayro'
    $form.Size = New-Object System.Drawing.Size(380, 140)
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $true
    $form.TopMost = $true
    $form.ControlBox = $false
    $iconPath = Join-Path $root 'src-tauri\icons\icon.ico'
    if (Test-Path $iconPath) { $form.Icon = New-Object System.Drawing.Icon($iconPath) }
    $label = New-Object System.Windows.Forms.Label
    $label.Text = "Mise à jour de Kayro…`nCompilation de la dernière version (1 à 3 minutes)."
    $label.Font = New-Object System.Drawing.Font('Segoe UI', 10)
    $label.Location = New-Object System.Drawing.Point(16, 14)
    $label.Size = New-Object System.Drawing.Size(340, 42)
    $bar = New-Object System.Windows.Forms.ProgressBar
    $bar.Style = 'Marquee'
    $bar.MarqueeAnimationSpeed = 30
    $bar.Location = New-Object System.Drawing.Point(16, 62)
    $bar.Size = New-Object System.Drawing.Size(332, 18)
    $form.Controls.AddRange(@($label, $bar))

    # Redirected by cmd, not by PowerShell: in Windows PowerShell 5.1 a redirected native stderr
    # (cargo's progress) becomes error records, which would stop build-local.ps1.
    $script = Join-Path $PSScriptRoot 'build-local.ps1'
    $argList = "/d /c powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`" > `"$log`" 2>&1"
    $proc = Start-Process -FilePath $env:ComSpec -ArgumentList $argList -WorkingDirectory $root -WindowStyle Hidden -PassThru
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 500
    $timer.Add_Tick({ if ($proc.HasExited) { $timer.Stop(); $form.Close() } })
    $timer.Start()
    [void]$form.ShowDialog()
    $proc.WaitForExit()
    if ($proc.ExitCode -ne 0 -or -not (Test-Path $exe)) { return $false }
    Set-Content -Path $stamp -Value (Get-Date -Format o)
    return $true
}

# Asks the running Kayro to quit as with « Quitter » (never a kill). False if it is still open.
function Stop-KayroGently {
    Start-Process -FilePath $exe -ArgumentList '--quit' -WindowStyle Hidden
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-RunningKayro) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
    return -not (Get-RunningKayro)
}

# 1. Already open: show it (single instance), no update while the exe is locked. Asked for an
#    update (-Force): quit it gently first.
if (-not $CheckOnly -and @(Get-RunningKayro).Count -gt 0) {
    if (-not $Force) { Start-Kayro; exit 0 }
    if (-not (Stop-KayroGently)) {
        Show-Message "Kayro ne s'est pas fermé (une confirmation attend peut-être).`n`nQuitte-le depuis son icône (clic droit → Quitter), puis relance « Kayro — mettre à jour »." 'Warning'
        exit 1
    }
}

# 2. Up to date: start at once.
$built = if (Test-Path $exe) { (Get-Item $exe).LastWriteTime } else { [datetime]::MinValue }
if ((Test-Path $stamp) -and (Get-Item $stamp).LastWriteTime -gt $built) { $built = (Get-Item $stamp).LastWriteTime }
$sources = Get-SourcesTime
$stale = $Force -or -not (Test-Path $exe) -or ($sources -gt $built)
if ($CheckOnly) { "sources : $sources`nexe    : $built`na recompiler : $stale"; exit 0 }
if (-not $stale) { Start-Kayro; exit 0 }

# 3. Update, then start the new exe — or the last one that worked.
if (Invoke-Update) { Start-Kayro; exit 0 }
$tail = if (Test-Path $log) { (Get-Content $log -Tail 25) -join "`n" } else { '(pas de journal)' }
$fallback = if (Test-Path $exe) { "Kayro va s'ouvrir dans sa dernière version qui marchait." } else { '' }
Show-Message "La mise à jour de Kayro a échoué. $fallback`n`nFin du journal :`n$tail`n`nJournal complet : $log" 'Warning'
Start-Kayro
