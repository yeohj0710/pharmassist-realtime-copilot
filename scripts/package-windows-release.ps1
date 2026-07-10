$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $repoRoot "release"
$bundleRoot = Join-Path $releaseRoot "PharmAssist"
$appRoot = Join-Path $bundleRoot "app"

if (Test-Path -LiteralPath $releaseRoot) {
  Remove-Item -LiteralPath $releaseRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $appRoot -Force | Out-Null

$appFiles = @(
  ".env.example",
  ".gitignore",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "turbo.json"
)

$appDirectories = @("apps/", "config/", "data/", "database/", "packages/", "scripts/", "tools/")
$trackedFiles = & git -C $repoRoot ls-files
foreach ($file in $trackedFiles) {
  $normalized = $file.Replace("\", "/")
  $isAppFile = $appFiles -contains $normalized
  $isAppDirectory = $appDirectories.Where({ $normalized.StartsWith($_) }).Count -gt 0
  if (-not ($isAppFile -or $isAppDirectory)) { continue }

  $destination = Join-Path $appRoot $normalized
  $destinationDirectory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $repoRoot $normalized) -Destination $destination
}

Copy-Item -LiteralPath (Join-Path $repoRoot "PharmAssist.exe") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $repoRoot "packaging\windows\README.md") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $repoRoot "packaging\windows\사용설명서.html") -Destination $bundleRoot

$archivePath = Join-Path $releaseRoot "PharmAssist-Windows.zip"
Compress-Archive -Path (Join-Path $bundleRoot "*") -DestinationPath $archivePath -CompressionLevel Optimal
Write-Host "Created $archivePath"
