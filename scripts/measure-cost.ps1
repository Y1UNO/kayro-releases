# Cost of the running app (dev workshop "Mesurer", step 12b): CPU and GPU of the whole process tree
# (the app + its msedgewebview2 children) over -Seconds. Prints one JSON line.
# CPU = processor time used by the tree / (wall time x logical cores), in % of the machine.
# GPU = "GPU Engine" counters of the tree's PIDs, 3D engines, averaged over the samples taken
# (Get-Counter is slow with hundreds of instances: a few samples only, an order of magnitude).
param([ValidateRange(3, 60)][int]$Seconds = 10, [string[]]$Names = @("hub", "Kayro"))
$ErrorActionPreference = "Stop"
$inv = [Globalization.CultureInfo]::InvariantCulture

function TreePids([int]$root) {
  $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId
  $set = [System.Collections.Generic.HashSet[int]]::new(); [void]$set.Add($root)
  do { $n = $set.Count; foreach ($p in $all) { if ($set.Contains([int]$p.ParentProcessId)) { [void]$set.Add([int]$p.ProcessId) } } } while ($set.Count -ne $n)
  , $set
}
function CpuSeconds($pids) {
  $sum = 0.0
  foreach ($id in $pids) {
    $p = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($p -and $p.TotalProcessorTime) { $sum += $p.TotalProcessorTime.TotalSeconds }
  }
  $sum
}

$root = Get-Process -Name $Names -ErrorAction SilentlyContinue | Sort-Object StartTime -Descending | Select-Object -First 1
if (-not $root) { Write-Output '{"error":"app not running"}'; exit 0 }
$tree = TreePids $root.Id
$cores = [Environment]::ProcessorCount
$cpu0 = CpuSeconds $tree
$t0 = Get-Date
$stop = $t0.AddSeconds($Seconds)
$gpu = [System.Collections.Generic.List[double]]::new()
while ((Get-Date) -lt $stop) {
  $s = (Get-Counter '\GPU Engine(*)\Utilization Percentage' -SampleInterval 1 -MaxSamples 1 -ErrorAction SilentlyContinue).CounterSamples
  $mine = $s | Where-Object { $_.InstanceName -match '^pid_(\d+)_.*engtype_3D' -and $tree.Contains([int]$Matches[1]) }
  $gpu.Add([double](($mine | Measure-Object CookedValue -Sum).Sum))
}
$wall = ((Get-Date) - $t0).TotalSeconds
$cpu = 100.0 * ((CpuSeconds $tree) - $cpu0) / ($wall * $cores)
$gpuAvg = if ($gpu.Count -gt 0) { ($gpu | Measure-Object -Average).Average } else { -1 }
Write-Output ([string]::Format($inv, '{{"process":"{0}","procs":{1},"seconds":{2:F1},"cpu":{3:F2},"gpu3d":{4:F2},"gpuSamples":{5}}}', $root.ProcessName, $tree.Count, $wall, $cpu, $gpuAvg, $gpu.Count))
