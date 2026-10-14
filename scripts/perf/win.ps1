# Kayro performance bench: Windows helper. One JSON line answered per command line read on stdin.
#   fg <pid>          brings the pid's window to the front (AttachThreadInput if needed)
#   fgpid             process that owns the foreground window
#   cost <pid> <s>    CPU of the pid's process tree and of the machine, GPU 3D of the tree, of dwm
#                     and of the machine (« GPU Engine » counters), private memory of the tree
#   screen            primary screen: device name and rectangle (the bench puts every mode there)
#   mem <pid>         private memory of the pid's process tree (MB), and per process name
#   awake on|off      keeps the PC and the screen awake (SetThreadExecutionState), no setting changed
#   quit
# No screen capture of any kind.
$ErrorActionPreference = "Stop"
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Collections.Generic;
public static class W {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  public static IntPtr MainWindow(uint pid) {
    IntPtr best = IntPtr.Zero; long area = 0;
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); RECT r;
      if (p == pid && IsWindowVisible(h) && GetWindowRect(h, out r)) { long a = (long)(r.R - r.L) * (r.B - r.T); if (a > area) { area = a; best = h; } }
      return true; }, IntPtr.Zero);
    return best;
  }
  public static uint FgPid() { uint p; GetWindowThreadProcessId(GetForegroundWindow(), out p); return p; }
  // Foreground by attaching to the foreground thread's input (the usual way round the foreground lock).
  public static void Raise(IntPtr h) {
    uint p; uint fgThread = GetWindowThreadProcessId(GetForegroundWindow(), out p); uint me = GetCurrentThreadId();
    bool att = fgThread != 0 && fgThread != me && AttachThreadInput(me, fgThread, true);
    BringWindowToTop(h); SetForegroundWindow(h);
    if (att) AttachThreadInput(me, fgThread, false);
  }
}
"@
$shell = New-Object -ComObject WScript.Shell

function Out($o) { [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 4)); [Console]::Out.Flush() }
function NameOf([int]$id) { (Get-Process -Id $id -ErrorAction SilentlyContinue).ProcessName }
function Tree([int]$root) {
  $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId
  $set = [System.Collections.Generic.HashSet[int]]::new(); [void]$set.Add($root)
  do { $n = $set.Count; foreach ($p in $all) { if ($set.Contains([int]$p.ParentProcessId)) { [void]$set.Add([int]$p.ProcessId) } } } while ($set.Count -ne $n)
  , $set
}
function CpuOf($ids) { $s = 0.0; foreach ($id in $ids) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($p -and $p.TotalProcessorTime) { $s += $p.TotalProcessorTime.TotalSeconds } }; $s }
function AllCpu { $s = 0.0; foreach ($p in Get-Process) { if ($p.Id -ne 0 -and $p.TotalProcessorTime) { $s += $p.TotalProcessorTime.TotalSeconds } }; $s }

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $a = $line.Trim() -split '\s+'
  try {
    switch ($a[0]) {
      'quit' { [void][W]::SetThreadExecutionState([uint32]2147483648); Out @{ ok = $true }; exit 0 }
      'awake' {
        # ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED, or ES_CONTINUOUS alone (back to normal).
        $f = if ($a[1] -eq 'on') { [uint32]2147483651 } else { [uint32]2147483648 }
        [void][W]::SetThreadExecutionState($f); Out @{ ok = $true }
      }
      'screen' {
        Add-Type -AssemblyName System.Windows.Forms
        $p = [System.Windows.Forms.Screen]::PrimaryScreen
        Out @{ name = $p.DeviceName; x = $p.Bounds.X; y = $p.Bounds.Y; width = $p.Bounds.Width; height = $p.Bounds.Height }
      }
      'mem' {
        $tree = Tree ([int]$a[1]); $mem = 0.0; $by = @{}
        foreach ($id in $tree) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($p) { $mem += $p.PrivateMemorySize64; $by["$($p.Id)"] = [math]::Round($p.PrivateMemorySize64 / 1MB, 1) } }
        Out @{ memMB = [math]::Round($mem / 1MB, 1); byPid = $by }
      }
      'fgpid' { $fp = [W]::FgPid(); Out @{ fg = $fp; fgName = (NameOf $fp) } }
      'fg' {
        $procId = [int]$a[1]; $ok = ([W]::FgPid() -eq $procId)
        for ($i = 0; $i -lt 4 -and -not $ok; $i++) {
          [void]$shell.AppActivate($procId)
          Start-Sleep -Milliseconds 150
          if ([W]::FgPid() -eq $procId) { $ok = $true; break }
          $h = [W]::MainWindow([uint32]$procId); if ($h -ne [IntPtr]::Zero) { [W]::Raise($h) }
          Start-Sleep -Milliseconds 150
          $ok = ([W]::FgPid() -eq $procId)
        }
        $fp = [W]::FgPid(); Out @{ ok = $ok; fg = $fp; fgName = (NameOf $fp) }
      }
      'cost' {
        $procId = [int]$a[1]; $secs = [double]$a[2]
        $tree = Tree $procId; $cores = [Environment]::ProcessorCount
        $dwm = @(Get-Process dwm -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
        $c0 = CpuOf $tree; $m0 = AllCpu; $t0 = Get-Date; $stop = $t0.AddSeconds($secs)
        # One call, one sample a second (the call's own start, ~1.5 s, is paid once).
        $sets = Get-Counter '\GPU Engine(*)\Utilization Percentage' -SampleInterval 1 -MaxSamples ([int][math]::Max(2, $secs - 2)) -ErrorAction SilentlyContinue
        while ((Get-Date) -lt $stop) { Start-Sleep -Milliseconds 50 }
        $gApp = @(); $gDwm = @(); $gAll = @()
        foreach ($set in $sets) {
          $app = 0.0; $dw = 0.0; $all = 0.0
          foreach ($x in $set.CounterSamples) {
            if ($x.InstanceName -match '^pid_(\d+)_.*engtype_3D') { $p = [int]$Matches[1]; $v = $x.CookedValue; $all += $v; if ($tree.Contains($p)) { $app += $v }; if ($dwm -contains $p) { $dw += $v } }
          }
          $gApp += $app; $gDwm += $dw; $gAll += $all
        }
        $wall = ((Get-Date) - $t0).TotalSeconds
        $mem = 0.0; foreach ($id in $tree) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($p) { $mem += $p.PrivateMemorySize64 } }
        $avg = { param($l) if ($l.Count) { [math]::Round(($l | Measure-Object -Average).Average, 2) } else { -1 } }
        Out @{ procs = $tree.Count; seconds = [math]::Round($wall, 1)
               cpu = [math]::Round(100.0 * ((CpuOf $tree) - $c0) / ($wall * $cores), 2)
               cpuMachine = [math]::Round(100.0 * ((AllCpu) - $m0) / ($wall * $cores), 2)
               gpuApp = (& $avg $gApp); gpuDwm = (& $avg $gDwm); gpuAll = (& $avg $gAll); gpuSamples = $gApp.Count
               memMB = [math]::Round($mem / 1MB, 1) }
      }
      default { Out @{ error = "unknown: $line" } }
    }
  } catch { Out @{ error = $_.Exception.Message } }
}
