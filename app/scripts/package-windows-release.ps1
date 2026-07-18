$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $projectRoot
$releaseRoot = Join-Path $projectRoot "release"
$bundleRoot = Join-Path $releaseRoot "PharmAssist"
$projectFolderName = Split-Path -Leaf $projectRoot

if (Test-Path -LiteralPath $releaseRoot) {
  Remove-Item -LiteralPath $releaseRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $bundleRoot -Force | Out-Null

$prefix = "$projectFolderName/"
$trackedFiles = & git -C $repoRoot ls-files
foreach ($file in $trackedFiles) {
  $normalized = $file.Replace("\", "/")
  if (-not $normalized.StartsWith($prefix)) { continue }

  $destination = Join-Path $bundleRoot $normalized
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $repoRoot $normalized) -Destination $destination
}

$launcherName = -join @([char]0xC57D,[char]0xAD6D,' ',[char]0xC0C1,[char]0xB2F4,' ',[char]0xB3C4,[char]0xC6B0,[char]0xBBF8,'.exe')
Copy-Item -LiteralPath (Join-Path $repoRoot $launcherName) -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $repoRoot "README.md") -Destination $bundleRoot
$guidePath = Get-ChildItem -LiteralPath $repoRoot -File -Filter "*.html" | Select-Object -First 1 -ExpandProperty FullName
if (-not $guidePath) { throw "Root user guide HTML was not found." }
Copy-Item -LiteralPath $guidePath -Destination $bundleRoot -Force

$archivePath = Join-Path $releaseRoot "PharmAssist-Windows.zip"
Compress-Archive -Path (Join-Path $bundleRoot "*") -DestinationPath $archivePath -CompressionLevel Optimal
Write-Host "Created $archivePath"
