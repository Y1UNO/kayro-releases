# 5 silent starts (process creation -> tray_ready in the log), then a 2nd instance each time
# (must show the first window and exit fast), then the autostart registry check. No keyboard injection.
param([string]$Exe = "$PSScriptRoot\..\..\target\release\spike-05-tray-instance.exe", [int]$Runs = 5, [switch]$Shell)
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Collections.Generic;
public static class W {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static string VisibleTopLevel(uint pid) { var l2 = new List<string>(); EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) { var sb = new System.Text.StringBuilder(64); GetWindowText(h, sb, 64); RECT r; GetWindowRect(h, out r); l2.Add("[" + sb + "] " + (r.R - r.L) + "x" + (r.B - r.T)); } return true; }, IntPtr.Zero); return string.Join(" | ", l2); }
}
"@
$cap = "$PSScriptRoot\captures"; New-Item -ItemType Directory -Force $cap | Out-Null
$res = "$cap\results.jsonl"; Remove-Item $res -ErrorAction SilentlyContinue
function Lines { if (Test-Path $res) { Get-Content $res | ForEach-Object { $_ | ConvertFrom-Json } } else { @() } }
function WaitKind($kind, $pid0, $timeoutMs = 8000) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $timeoutMs) { if ((Test-Path $res) -and (Select-String -Path $res -SimpleMatch -Quiet "`"kind`":`"$kind`",`"pid`":$pid0,")) { return $true }; Start-Sleep -Milliseconds 5 }
  $false
}
function Launch($argList) {
  if ($Shell) { if ($argList) { return Start-Process $Exe -ArgumentList $argList -PassThru } else { return Start-Process $Exe -PassThru } }
  $psi = New-Object System.Diagnostics.ProcessStartInfo $Exe; $psi.UseShellExecute = $false; $psi.Arguments = $argList
  [System.Diagnostics.Process]::Start($psi)
}
$summary = @()
for ($i = 1; $i -le $Runs; $i++) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = Launch "--silent"
  $ok = WaitKind "tray_ready" $p.Id; $tray = $sw.ElapsedMilliseconds
  $ok2 = WaitKind "painted" $p.Id; $painted = $sw.ElapsedMilliseconds
  Start-Sleep -Milliseconds 300
  $visibleBefore = [W]::VisibleTopLevel($p.Id)
  $sw2 = [Diagnostics.Stopwatch]::StartNew()
  $second = Launch ""; $second.WaitForExit(5000) | Out-Null; $secondExitMs = $sw2.ElapsedMilliseconds
  Start-Sleep -Milliseconds 500
  $visibleAfter = [W]::VisibleTopLevel($p.Id)
  $startEpoch = ([DateTimeOffset]$p.StartTime).ToUnixTimeMilliseconds(); $trayLine = Lines | Where-Object { $_.kind -eq "tray_ready" -and $_.pid -eq $p.Id } | Select-Object -First 1; $mainLine = Lines | Where-Object { $_.kind -eq "main" -and $_.pid -eq $p.Id } | Select-Object -First 1; $setupLine = Lines | Where-Object { $_.kind -eq "setup_start" -and $_.pid -eq $p.Id } | Select-Object -First 1; $paintLine = Lines | Where-Object { $_.kind -eq "painted" -and $_.pid -eq $p.Id } | Select-Object -First 1
  $summary += [pscustomobject]@{ run = $i; main_from_proc_start_ms = ($mainLine.t - $startEpoch); setup_from_main_ms = ($setupLine.t - $mainLine.t); tray_from_proc_start_ms = ($trayLine.t - $startEpoch); painted_from_proc_start_ms = ($paintLine.t - $startEpoch); windows_visible_silent = $visibleBefore.Length; second_exit_ms = $secondExitMs; second_exited = $second.HasExited; windows_visible_after_2nd = $visibleAfter }
  Stop-Process -Id $p.Id -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 400
}
$summary | Format-Table -AutoSize | Out-String
"--- app-side log (ms since main) ---"
Lines | Where-Object { $_.kind -in "tray_ready", "painted", "second_instance_callback", "shown" } | Select-Object -First 12 | ForEach-Object { $_ | ConvertTo-Json -Compress }

"--- autostart ---"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Start-Process $Exe -ArgumentList "--autostart", "enable", "--exit" -Wait
"after enable : " + ((Get-ItemProperty $runKey).PSObject.Properties | Where-Object { $_.Name -match "Spike|spike" } | ForEach-Object { "$($_.Name) = $($_.Value)" })
Start-Process $Exe -ArgumentList "--autostart", "disable", "--exit" -Wait
$left = (Get-ItemProperty $runKey).PSObject.Properties | Where-Object { $_.Name -match "Spike|spike" }
"after disable: " + $(if ($left) { "STILL PRESENT: $($left.Name)" } else { "no spike entry in Run (clean)" })
Lines | Where-Object { $_.kind -eq "autostart" } | ForEach-Object { $_ | ConvertTo-Json -Compress }
