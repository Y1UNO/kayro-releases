# Samples GPU engine utilisation of a process tree every second -> captures/gpu.jsonl (epoch ms).
param([Parameter(Mandatory)][int]$RootPid, [string]$Out = "$PSScriptRoot\captures\gpu.jsonl", [int]$MaxSeconds = 150)
function TreePids($root) {
  $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId
  $set = [System.Collections.Generic.HashSet[int]]::new(); [void]$set.Add($root)
  do { $n = $set.Count; foreach ($p in $all) { if ($set.Contains([int]$p.ParentProcessId)) { [void]$set.Add([int]$p.ProcessId) } } } while ($set.Count -ne $n)
  $set
}
Remove-Item $Out -ErrorAction SilentlyContinue
$stop = (Get-Date).AddSeconds($MaxSeconds); $tree = TreePids $RootPid; $i = 0
while ((Get-Date) -lt $stop -and (Get-Process -Id $RootPid -ErrorAction SilentlyContinue)) {
  if (($i++ % 5) -eq 0) { $tree = TreePids $RootPid }
  $s = (Get-Counter '\GPU Engine(*)\Utilization Percentage' -SampleInterval 1 -MaxSamples 1).CounterSamples
  $mine = $s | Where-Object { $_.InstanceName -match '^pid_(\d+)_' -and $tree.Contains([int]$Matches[1]) }
  $g3d = ($mine | Where-Object { $_.InstanceName -match 'engtype_3D' } | Measure-Object CookedValue -Sum).Sum
  $allSum = ($mine | Measure-Object CookedValue -Sum).Sum
  $t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $inv = [Globalization.CultureInfo]::InvariantCulture
  Add-Content $Out ([string]::Format($inv, '{{"kind":"gpu","t":{0},"gpu3d":{1:F2},"gpu_all":{2:F2} }}', $t, [double]$g3d, [double]$allSum))
}
