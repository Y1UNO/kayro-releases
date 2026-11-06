<#
.SYNOPSIS
  Prepare le dossier a publier de la version courante (etape 18b) : target\release\publish\<version>\
  avec les deux installeurs, la signature et latest.json (ce que Kayro lit pour se mettre a jour).
.DESCRIPTION
  Appele par build-installer.ps1 ; peut etre relance seul (sans recompiler) apres la fabrication.
  Les notes sont la derniere entree de installer\ui\patchNotes.json.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$conf = Get-Content (Join-Path $root 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$version = $conf.version
$setup = Join-Path $root ("target\release\bundle\nsis\{0}_{1}_x64-setup.exe" -f $conf.productName, $version)
$styled = Join-Path $root ("target\release\bundle\{0}_{1}_Installer.exe" -f $conf.productName, $version)

function Stop-Here([string]$message) {
    Write-Host "Arret : $message" -ForegroundColor Red
    exit 1
}

foreach ($f in $setup, "$setup.sig", $styled) { if (-not (Test-Path $f)) { Stop-Here "introuvable : $f" } }
$endpoint = @($conf.plugins.updater.endpoints)[0]
if ($endpoint -notmatch '^https://github\.com/([^/]+)/([^/]+)/releases/') { Stop-Here "adresse de mise a jour inattendue : $endpoint" }
$repo = "$($Matches[1])/$($Matches[2])"
$tag = "v$version"

$publish = Join-Path $root "target\release\publish\$version"
New-Item -ItemType Directory -Force $publish | Out-Null
Copy-Item $setup, "$setup.sig", $styled $publish -Force

# Windows PowerShell 5 reads a JSON array as one object holding the array: index it directly.
$all = Get-Content (Join-Path $root 'installer\ui\patchNotes.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$entry = $all[$all.Count - 1]
if ($entry.version -ne ($version -replace '\.0$', '') -and $entry.version -ne $version) {
    Stop-Here "la derniere entree des patch notes ($($entry.version)) n'est pas la version $version."
}
$notes = ($entry.points | ForEach-Object { "- $_" }) -join "`n"
$latest = [ordered]@{
    version   = $version
    notes     = $notes
    pub_date  = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    platforms = [ordered]@{
        'windows-x86_64' = [ordered]@{
            signature = (Get-Content "$setup.sig" -Raw).Trim()
            url       = "https://github.com/$repo/releases/download/$tag/$(Split-Path $setup -Leaf)"
        }
    }
}
$json = $latest | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $publish 'latest.json'), $json, (New-Object System.Text.UTF8Encoding $false))
Write-Host "A publier : $publish ($repo, $tag)" -ForegroundColor Green
