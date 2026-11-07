<#
.SYNOPSIS
  Recupere les fichiers de l'IA du rythme du mode musique dans src-tauri\resources\ai (hors git).
.DESCRIPTION
  Beat This! small0 et son spectrogramme (CPJKU, licence MIT, conversions ONNX sur Hugging Face) et
  ONNX Runtime 1.31.1 (Microsoft, licence MIT, tire du paquet officiel PyPI). Chaque fichier est
  verifie par son empreinte SHA-256 ; un fichier deja present et juste n'est pas retelecharge.
  Voir docs/MODE-MUSIQUE.md.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'src-tauri\resources\ai'
New-Item -ItemType Directory -Force $dir | Out-Null

$files = @(
    @{ Name = 'beat-this-small0.onnx'; Sha = 'c462b064a4033050ca6a5354bf866ff4610ab1fd8f1dec1e494b20b22d870aea'
       Url = 'https://huggingface.co/ashudesai/songbird-models/resolve/main/small0.onnx' },
    @{ Name = 'beat-this-logmel.onnx'; Sha = '161bf43d3c258a3f5e98c609721dca6d259b8c75404a56c4c135ddd36dcdd8ad'
       Url = 'https://huggingface.co/tuneperfect/beat-this-onnx/resolve/main/logmel.onnx' },
    @{ Name = 'LICENSE-beat-this'; Sha = $null
       Url = 'https://huggingface.co/tuneperfect/beat-this-onnx/resolve/main/LICENSE' }
)

function Test-Sha([string]$path, [string]$sha) {
    (Test-Path $path) -and (-not $sha -or (Get-FileHash $path -Algorithm SHA256).Hash -ieq $sha)
}

foreach ($f in $files) {
    $path = Join-Path $dir $f.Name
    if (Test-Sha $path $f.Sha) { Write-Host "ok   $($f.Name)"; continue }
    Write-Host "...  $($f.Name)"
    Invoke-WebRequest -Uri $f.Url -OutFile $path -UseBasicParsing
    if (-not (Test-Sha $path $f.Sha)) { Remove-Item $path; throw "empreinte fausse : $($f.Name)" }
}

# ONNX Runtime: onnxruntime.dll and its licence, from Microsoft's wheel on PyPI (a zip).
$dll = Join-Path $dir 'onnxruntime.dll'
$dllSha = '68d0d5f502be4509e2a16f932627a95137d748b2fae519027f80125c0b1f550b'
if (Test-Sha $dll $dllSha) { Write-Host 'ok   onnxruntime.dll' } else {
    Write-Host '...  onnxruntime.dll (ONNX Runtime 1.31.1, PyPI)'
    $wheel = Join-Path $env:TEMP 'kayro-onnxruntime.zip'
    $url = 'https://files.pythonhosted.org/packages/59/bf/a1d282b4c753ba3e9b31f4c11abd2bc2390513dc5e3792ca3b78e42401c3/onnxruntime-1.31.1-cp313-cp313-win_amd64.whl'
    Invoke-WebRequest -Uri $url -OutFile $wheel -UseBasicParsing
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($wheel)
    try {
        foreach ($e in $zip.Entries) {
            if ($e.FullName -eq 'onnxruntime/capi/onnxruntime.dll') {
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dll, $true)
            }
            if ($e.FullName -eq 'onnxruntime/LICENSE') {
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, (Join-Path $dir 'LICENSE-onnxruntime'), $true)
            }
        }
    } finally { $zip.Dispose(); Remove-Item $wheel }
    if (-not (Test-Sha $dll $dllSha)) { Remove-Item $dll -ErrorAction SilentlyContinue; throw 'empreinte fausse : onnxruntime.dll' }
}
Write-Host "Pret : $dir"
