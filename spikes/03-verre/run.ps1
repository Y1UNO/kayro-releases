# Runs the 7-step glass benchmark (~100 s). The spike window covers the primary monitor: do not touch the PC meanwhile.
param([string]$Exe = "$PSScriptRoot\..\..\target\release\spike-03-verre.exe")
$cap = Join-Path $PSScriptRoot "captures"
New-Item -ItemType Directory -Force $cap | Out-Null
$gpuOut = Join-Path $cap "gpu.jsonl"
$p = Start-Process $Exe -PassThru
$gpu = Start-Process powershell -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot "gpu.ps1"), "-RootPid", $p.Id, "-Out", $gpuOut -PassThru -WindowStyle Hidden
$p.WaitForExit(180000) | Out-Null
if (-not $p.HasExited) { Stop-Process -Id $p.Id; "TIMEOUT" }
Start-Sleep -Seconds 2; Stop-Process -Id $gpu.Id -ErrorAction SilentlyContinue
node (Join-Path $PSScriptRoot "summarize.mjs")
