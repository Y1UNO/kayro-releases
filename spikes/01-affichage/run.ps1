# Drives the spike: injects Ctrl+Alt+F9 (keybd_event), then F24 (harmless key), and
# samples a small pixel zone of the spike window to detect a white flash. Takes the keyboard!
param(
  [int]$Trials = 20,
  [int]$HiddenSeconds = 5,
  [string]$Exe = "$PSScriptRoot\..\..\target\release\spike-01-affichage.exe",
  [switch]$KeepRunning
)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class K { [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra); }
"@
function Press($vks) { foreach ($v in $vks) { [K]::keybd_event($v, 0, 0, [UIntPtr]::Zero) }; [array]::Reverse($vks); foreach ($v in $vks) { [K]::keybd_event($v, 0, 2, [UIntPtr]::Zero) } }
$proc = Get-Process -Name "spike-01-affichage" -ErrorAction SilentlyContinue
if (-not $proc) { $proc = Start-Process $Exe -PassThru; Start-Sleep -Seconds 3 }
Add-Type -AssemblyName System.Windows.Forms
$wa = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$x = [int](($wa.Width - 800) / 2); $y = [int](($wa.Height - 500) / 2)
$flashes = 0
for ($i = 1; $i -le $Trials; $i++) {
  Start-Sleep -Seconds $HiddenSeconds
  Press @(0x11, 0x12, 0x78)                      # Ctrl+Alt+F9
  Start-Sleep -Milliseconds 40
  $bmp = New-Object System.Drawing.Bitmap 800, 500
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($x, $y, 0, 0, $bmp.Size)
  $white = 0; $total = 0
  for ($px = 20; $px -lt 800; $px += 40) { for ($py = 20; $py -lt 500; $py += 40) { $c = $bmp.GetPixel($px, $py); $total++; if ($c.R -gt 235 -and $c.G -gt 235 -and $c.B -gt 235) { $white++ } } }
  if ($white -gt 0) { $flashes++; $bmp.Save("$PSScriptRoot\captures\flash_$i.png") }
  $g.Dispose(); $bmp.Dispose()
  Start-Sleep -Milliseconds 200
  Press @(0x87)                                   # F24
  Start-Sleep -Milliseconds 800                   # let the app hide itself
}
"flash trials (any near-white sampled pixel): $flashes / $Trials"
if (-not $KeepRunning) { Get-Process -Name "spike-01-affichage" -ErrorAction SilentlyContinue | Stop-Process }
