<#
.SYNOPSIS
  Mesure Â« raccourci -> hub visible et peint Â» (etape 12), N essais, dans un dossier de donnees
  temporaire (les donnees de l'utilisateur ne sont pas touchees).
.DESCRIPTION
  Lance target\release\Kayro.exe avec APPDATA pointant vers un dossier temporaire et
  KAYRO_BENCH_SHOW=<fichier> : a chaque affichage par le raccourci, le coeur note
  l'instant de l'appui, la page rapporte 2 images apres l'affichage, et l'ecart est ajoute au
  fichier. Le script appuie sur Ctrl+Alt+H (keybd_event) : il PREND LE CLAVIER pendant l'essai.
  Un essai = masquer (raccourci), attendre -HiddenSeconds, afficher (raccourci, mesure).
.PARAMETER Mode
  immersive | window | widget
.PARAMETER Economy
  Mode econome (fenetre detruite quand cachee).
#>
[CmdletBinding()]
param(
    [ValidateSet('immersive', 'window', 'widget')][string]$Mode = 'window',
    [switch]$Economy,
    [int]$Trials = 20,
    [int]$HiddenSeconds = 3,
    [string]$Exe = (Join-Path (Split-Path -Parent $PSScriptRoot) 'target\release\Kayro.exe')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class KK {
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowW(string cls, string title);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
}
"@
function Press([byte[]]$vks) {
    foreach ($v in $vks) { [KK]::keybd_event($v, 0, 0, [UIntPtr]::Zero) }
    [array]::Reverse($vks)
    foreach ($v in $vks) { [KK]::keybd_event($v, 0, 2, [UIntPtr]::Zero) }
}
function ForegroundPid { $p = [uint32]0; [void][KK]::GetWindowThreadProcessId([KK]::GetForegroundWindow(), [ref]$p); $p }

if (-not (Test-Path $Exe)) { throw "Introuvable : $Exe (lancer scripts\build-local.ps1 -NoBuild d'abord, ou compiler)" }
if (Get-Process -Name Kayro -ErrorAction SilentlyContinue) { throw "Kayro est deja ouvert : le fermer avant la mesure (instance unique)." }

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("kayro-measure-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
$data = Join-Path $tmp 'Kayro'
New-Item -ItemType Directory -Force $data | Out-Null
$settings = @{ schemaVersion = 1; displayMode = $Mode; economyMode = [bool]$Economy; hotkey = 'Ctrl+Alt+H' } | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $data 'settings.json'), $settings, (New-Object Text.UTF8Encoding($false)))
$bench = Join-Path $tmp 'bench.txt'

$oldAppData = $env:APPDATA
$env:APPDATA = $tmp
$env:KAYRO_BENCH_SHOW = $bench
try {
    $proc = Start-Process $Exe -PassThru
} finally {
    $env:APPDATA = $oldAppData
    Remove-Item Env:\KAYRO_BENCH_SHOW -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 4   # first window, loaded and painted

$focused = 0
$focusedEarly = 0
$others = @()
$flashes = 0
for ($i = 1; $i -le $Trials; $i++) {
    Press @(0x11, 0x12, 0x48)            # Ctrl+Alt+H : hides
    Start-Sleep -Seconds $HiddenSeconds
    Press @(0x11, 0x12, 0x48)            # Ctrl+Alt+H : shows (measured)
    Start-Sleep -Milliseconds 150
    $early = (ForegroundPid) -eq $proc.Id
    Start-Sleep -Milliseconds 550
    $fgNow = ForegroundPid
    if ($fgNow -eq $proc.Id) { $focused++ } else { $others += (Get-Process -Id $fgNow -ErrorAction SilentlyContinue).ProcessName }
    if ($early) { $focusedEarly++ }
    if ($Mode -ne 'widget') {
        # Pixels sampled inside the hub's own window: any near-white one is a flash.
        $h = [KK]::FindWindowW('Tauri Window', [NullString]::Value)
        $r = New-Object KK+RECT
        if ([KK]::GetWindowRect($h, [ref]$r) -and ($r.R - $r.L) -gt 100) {
            $w = $r.R - $r.L; $ht = $r.B - $r.T
            $bmp = New-Object Drawing.Bitmap $w, $ht
            $g = [Drawing.Graphics]::FromImage($bmp)
            $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
            $white = 0
            for ($x = 10; $x -lt $w; $x += 60) { for ($y = 10; $y -lt $ht; $y += 60) { $c = $bmp.GetPixel($x, $y); if ($c.R -gt 235 -and $c.G -gt 235 -and $c.B -gt 235) { $white++ } } }
            if ($white -gt 0) { $flashes++ }
            $g.Dispose(); $bmp.Dispose()
        }
    }
}

$times = @(Get-Content $bench -ErrorAction SilentlyContinue | ForEach-Object { [double]::Parse($_, [Globalization.CultureInfo]::InvariantCulture) })
# The test instance only (its PID), working in a temp folder: it has no tray menu to drive.
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue

if ($times.Count -eq 0) { Write-Host "Aucune mesure recue."; exit 1 }
$sorted = $times | Sort-Object
$median = if ($sorted.Count % 2) { $sorted[($sorted.Count - 1) / 2] } else { ($sorted[$sorted.Count / 2 - 1] + $sorted[$sorted.Count / 2]) / 2 }
$p95 = $sorted[[math]::Min($sorted.Count - 1, [int][math]::Ceiling(0.95 * $sorted.Count) - 1)]
"{0} | econome={1} | essais={2} mesures={3}" -f $Mode, [bool]$Economy, $Trials, $times.Count
"mediane {0:N1} ms | min {1:N1} | p95 {2:N1} | pire cas {3:N1}" -f $median, $sorted[0], $p95, $sorted[-1]
"fenetre au premier plan : {0}/{1} apres 700 ms ({3}/{1} apres 150 ms) | echantillons blancs : {2}/{1}" -f $focused, $Trials, $flashes, $focusedEarly
if ($others.Count) { "au premier plan a la place : " + (($others | Group-Object | ForEach-Object { "$($_.Name) x$($_.Count)" }) -join ', ') }
"valeurs : " + (($times | ForEach-Object { $_.ToString('N0') }) -join ' ')
if ($Economy) {
    'journal (creation de la fenetre, page prete) :'
    Get-Content (Join-Path $data 'logs\*') -ErrorAction SilentlyContinue | Select-String 'window built|page ready' | Select-Object -Last 6 | ForEach-Object { $_.Line -replace '^\S+\s+INFO\s+', '' }
}
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
