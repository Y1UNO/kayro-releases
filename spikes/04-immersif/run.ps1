# Starts the immersive window on monitor index $Monitor, then for each stage: reads the window
# styles (Alt+Tab eligibility) and samples a thin strip along the bottom of the monitor to see whether
# the taskbar is covered (strip colour == page background). No keyboard injection.
param([int]$Monitor = 0, [string]$Extra = "", [string]$Exe = "$PSScriptRoot\..\..\target\release\spike-04-immersif.exe")
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
public static class W {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int idx);
  [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  public static uint ForegroundPid() { uint p; GetWindowThreadProcessId(GetForegroundWindow(), out p); return p; }
  public static string Describe(uint pid) {
    var res = new List<string>();
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) {
      var sb = new StringBuilder(128); GetClassName(h, sb, 128);
      int style = GetWindowLong(h, -16), ex = GetWindowLong(h, -20); bool owner = GetWindow(h, 4) != IntPtr.Zero;
      if (true)
        res.Add(string.Format("class={0} style=0x{1:X8} ex=0x{2:X8} WS_CAPTION={3} TOOLWINDOW={4} APPWINDOW={5} hasOwner={6} => AltTab={7}",
          sb, style, ex, (style & 0xC00000) == 0xC00000, (ex & 0x80) != 0, (ex & 0x40000) != 0, owner, ((ex & 0x40000) != 0 || ((ex & 0x80) == 0 && !owner))));
    } return true; }, IntPtr.Zero);
    return string.Join("\n", res);
  }
}
"@
$cap = "$PSScriptRoot\captures"; New-Item -ItemType Directory -Force $cap | Out-Null
Remove-Item (Join-Path $cap "stage_*.txt") -ErrorAction SilentlyContinue
$p = Start-Process $Exe -ArgumentList "--monitor $Monitor $Extra" -PassThru

function WaitStage($name, $timeoutS = 40) {
  $f = "$cap\stage_$name.txt"; $t = [Diagnostics.Stopwatch]::StartNew()
  while (-not (Test-Path $f)) { if ($t.Elapsed.TotalSeconds -gt $timeoutS) { return $null }; Start-Sleep -Milliseconds 30 }
  Start-Sleep -Milliseconds 150; Get-Content $f | ConvertFrom-Json
}
function Strip($g, $name) {
  $cx = $g.x + [int]($g.w / 2); $cy = $g.y + [int]($g.h / 2)
  $scr = [System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.Bounds.Contains($cx, $cy) } | Select-Object -First 1
  $b = $scr.Bounds
  $bmp = New-Object System.Drawing.Bitmap $b.Width, 6
  $gr = [System.Drawing.Graphics]::FromImage($bmp); $gr.CopyFromScreen($b.X, $b.Bottom - 6, 0, 0, $bmp.Size)
  $match = 0; $n = 0; $sr = 0; $sg = 0; $sb = 0
  for ($x = 4; $x -lt $b.Width; $x += 16) { for ($y = 0; $y -lt 6; $y += 2) { $c = $bmp.GetPixel($x, $y); $n++; $sr += $c.R; $sg += $c.G; $sb += $c.B; if ([Math]::Abs($c.R - 23) -le 6 -and [Math]::Abs($c.G - 16) -le 6 -and [Math]::Abs($c.B - 33) -le 6) { $match++ } } }
  $gr.Dispose(); $bmp.Dispose()
  "{0,-16} window=({1},{2}) {3}x{4}  monitor={5} bounds={6}x{7}@({8},{9}) work={10}x{11}  bottom-strip==page-bg: {12}/{13} => taskbar {14} avgRGB=({15},{16},{17}) foregroundIsSpike={18}" -f $name, $g.x, $g.y, $g.w, $g.h, $scr.DeviceName, $b.Width, $b.Height, $b.X, $b.Y, $scr.WorkingArea.Width, $scr.WorkingArea.Height, $match, $n, $(if ($match -ge 0.9 * $n) { "COVERED" } else { "visible" }), [int]($sr / $n), [int]($sg / $n), [int]($sb / $n), ([W]::ForegroundPid() -eq $script:p.Id)
}

foreach ($s in @("immersive", "moved0", "moved1", "fullscreen", "after_fullscreen")) {
  $g = WaitStage $s
  if (-not $g) { "stage $s : timeout"; continue }
  Strip $g $s
  if ($s -eq "immersive") { "window styles:`n" + [W]::Describe($p.Id) }
}
$p.WaitForExit(20000) | Out-Null; if (-not $p.HasExited) { Stop-Process -Id $p.Id }
"--- results.jsonl ---"; Get-Content "$cap\results.jsonl"
