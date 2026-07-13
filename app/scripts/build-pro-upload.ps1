$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot "..\..")
).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
$etcRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "etc"))
$staging = [System.IO.Path]::GetFullPath(
  (Join-Path $etcRoot "pro-upload-staging")
)
$output = Join-Path $repoRoot "PharmAssist-Pro-Upload.zip"
$backupRoot = Join-Path $etcRoot "backups\pro-upload"

if (-not $staging.StartsWith("$etcRoot\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe staging path: $staging"
}

if (Test-Path -LiteralPath $staging) {
  Remove-Item -LiteralPath $staging -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $staging "repository") -Force | Out-Null

$excluded = @(
  '(^|/)(node_modules|dist|reports|coverage|playwright-report|test-results|\.turbo|etc)(/|$)',
  '(^|/)\.env$',
  '\.(exe|zip|tsbuildinfo|png|ico)$'
) -join '|'

Push-Location $repoRoot
try {
  $tracked = git -c core.quotepath=false ls-files
  if ($LASTEXITCODE -ne 0) {
    throw "git ls-files failed"
  }

  $extra = @(
    'app/docs/PRO_OTC_DATA_REBUILD_BRIEF.md',
    'app/docs/PRO_OTC_DATA_REBUILD_PROMPT.txt',
    'app/docs/PRO_UPLOAD_MANIFEST.md',
    'app/scripts/build-pro-upload.ps1'
  )
  $selected = @($tracked + $extra) |
    Where-Object { $_ -and $_ -notmatch $excluded } |
    Sort-Object -Unique

  foreach ($relative in $selected) {
    $source = Join-Path $repoRoot $relative
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
      throw "Selected file missing: $relative"
    }
    $destination = Join-Path (Join-Path $staging "repository") $relative
    $destinationDirectory = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
  }

  Copy-Item -LiteralPath (Join-Path $repoRoot 'app/docs/PRO_OTC_DATA_REBUILD_PROMPT.txt') -Destination (Join-Path $staging '00_START_HERE.txt')
  Copy-Item -LiteralPath (Join-Path $repoRoot 'app/docs/PRO_OTC_DATA_REBUILD_BRIEF.md') -Destination (Join-Path $staging '01_PROJECT_BRIEF.md')
  Copy-Item -LiteralPath (Join-Path $repoRoot 'app/docs/PRO_UPLOAD_MANIFEST.md') -Destination (Join-Path $staging '02_UPLOAD_MANIFEST.md')
  $selected | Set-Content -Encoding utf8 -LiteralPath (Join-Path $staging 'FILE_LIST.txt')

  if (Test-Path -LiteralPath $output) {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backup = Join-Path $backupRoot 'PharmAssist-Pro-Upload.previous.zip'
    Move-Item -LiteralPath $output -Destination $backup -Force
  }

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::Open(
    $output,
    [System.IO.Compression.ZipArchiveMode]::Create
  )
  try {
    $stagingPrefix = $staging.TrimEnd('\') + '\'
    foreach ($file in Get-ChildItem -LiteralPath $staging -Recurse -File) {
      if (-not $file.FullName.StartsWith(
        $stagingPrefix,
        [System.StringComparison]::OrdinalIgnoreCase
      )) {
        throw "Unsafe archive source: $($file.FullName)"
      }
      $entryName = $file.FullName.Substring($stagingPrefix.Length).Replace('\', '/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive,
        $file.FullName,
        $entryName,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  } finally {
    $archive.Dispose()
  }
} finally {
  Pop-Location
  if (Test-Path -LiteralPath $staging) {
    Remove-Item -LiteralPath $staging -Recurse -Force
  }
}

$archive = Get-Item -LiteralPath $output
Write-Output "Created: $($archive.FullName)"
Write-Output "Bytes: $($archive.Length)"
Write-Output "Files: $($selected.Count + 4)"
