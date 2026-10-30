<#
.SYNOPSIS
  Publie la version courante de Kayro (etape 18b) : cree au besoin le depot public des versions,
  puis une « Release » GitHub avec les fichiers de target\release\publish\<version>\.
.DESCRIPTION
  A lancer apres build-installer.ps1, et seulement avec l'accord de l'utilisateur (c'est public).
  Demande l'outil gh connecte (gh auth login). Le depot ne contient que les installeurs, la
  signature et latest.json : jamais le code.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$conf = Get-Content (Join-Path $root 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$version = $conf.version
$tag = "v$version"
$publish = Join-Path $root "target\release\publish\$version"

function Stop-Here([string]$message) {
    Write-Host "Arret : $message" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Stop-Here 'outil gh introuvable (winget install --id GitHub.cli -e).' }
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { Stop-Here 'gh n''est pas connecte (gh auth login --web).' }
if (-not (Test-Path (Join-Path $publish 'latest.json'))) { Stop-Here "rien a publier dans $publish (lance build-installer.ps1)." }

$endpoint = @($conf.plugins.updater.endpoints)[0]
if ($endpoint -notmatch '^https://github\.com/([^/]+)/([^/]+)/releases/') { Stop-Here "adresse de mise a jour inattendue : $endpoint" }
$repo = "$($Matches[1])/$($Matches[2])"

gh repo view $repo *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creation du depot public $repo..."
    gh repo create $repo --public --description 'Kayro : versions publiees (installeurs signes). Le code n''est pas ici.'
    if ($LASTEXITCODE -ne 0) { Stop-Here "le depot $repo n'a pas pu etre cree." }
}

gh release view $tag --repo $repo *> $null
if ($LASTEXITCODE -eq 0) { Stop-Here "la version $tag est deja publiee sur $repo." }

$latest = Get-Content (Join-Path $publish 'latest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$notesFile = Join-Path $env:TEMP "kayro-notes-$version.md"
[System.IO.File]::WriteAllText($notesFile, $latest.notes, (New-Object System.Text.UTF8Encoding $false))
$files = Get-ChildItem $publish -File | ForEach-Object { $_.FullName }
gh release create $tag @files --repo $repo --title "Kayro $version" --notes-file $notesFile
if ($LASTEXITCODE -ne 0) { Stop-Here "la publication de $tag a echoue." }
Remove-Item $notesFile -ErrorAction SilentlyContinue
Write-Host "Publie : https://github.com/$repo/releases/tag/$tag" -ForegroundColor Green
