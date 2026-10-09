# Runs one variant (css|acrylic|mica) end to end. No keyboard injection; moves only the spike window.
# Screenshots cover only the widget zone (+24 px margin) and go to captures/ (ignored by Git).
param(
  [Parameter(Mandatory)][ValidateSet("css", "acrylic", "mica")][string]$Variant,
  [string]$Exe = "$PSScriptRoot\..\..\target\release\spike-02-widget.exe"
)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public static class W {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  public static string Probe(int x, int y, out uint pid) {
    IntPtr h = WindowFromPoint(new POINT { X = x, Y = y });
    GetWindowThreadProcessId(GetAncestor(h, 2), out pid);
    var sb = new StringBuilder(256); GetClassName(h, sb, 256); return sb.ToString();
  }
}
"@
$cap = "$PSScriptRoot\captures"
Remove-Item "$cap\stage_${Variant}_*.txt", "$cap\results_$Variant.jsonl" -ErrorAction SilentlyContinue
$p = Start-Process $Exe -ArgumentList "--variant", $Variant -PassThru

function WaitStage($name, $timeoutS = 30) {
  $f = "$cap\stage_${Variant}_$name.txt"; $t = [Diagnostics.Stopwatch]::StartNew()
  while (-not (Test-Path $f)) { if ($t.Elapsed.TotalSeconds -gt $timeoutS) { throw "timeout waiting stage $name" }; Start-Sleep -Milliseconds 30 }
  Get-Content $f | ConvertFrom-Json
}
function Shot($g, $name) {
  $m = 24; $bmp = New-Object System.Drawing.Bitmap ($g.w + 2 * $m), ($g.h + 2 * $m)
  $gr = [System.Drawing.Graphics]::FromImage($bmp)
  $gr.CopyFromScreen($g.x - $m, $g.y - $m, 0, 0, $bmp.Size)
  $bmp.Save("$cap\${Variant}_$name.png"); $gr.Dispose(); $bmp.Dispose()
}

$g = WaitStage "idle";      Start-Sleep -Milliseconds 100; Shot $g "idle"
$g = WaitStage "expanded";  Start-Sleep -Milliseconds 100; Shot $g "expanded"
$null = WaitStage "collapsed"
$g = WaitStage "probe"
foreach ($pt in @(@("corner top-left", ($g.x + 1), ($g.y + 1)), @("center", ($g.x + [int]($g.w / 2)), ($g.y + [int]($g.h / 2))), @("just outside left", ($g.x - 6), ($g.y + [int]($g.h / 2))))) {
  $pid2 = [uint32]0; $cls = [W]::Probe($pt[1], $pt[2], [ref]$pid2)
  "{0,-18} -> class={1} owner={2}" -f $pt[0], $cls, $(if ($pid2 -eq $p.Id) { "SPIKE WINDOW (blocks clicks)" } else { "another window (click-through)" })
}
$null = WaitStage "done" 15
Stop-Process -Id $p.Id -ErrorAction SilentlyContinue
"--- results_$Variant.jsonl ---"
Get-Content "$cap\results_$Variant.jsonl" | Where-Object { $_ -match '"kind":"(resize|frames)"' }
