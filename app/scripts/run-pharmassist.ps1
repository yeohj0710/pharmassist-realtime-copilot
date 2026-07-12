$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
$logDirectory = Join-Path $repoRoot "logs"
$logPath = Join-Path $logDirectory "pharmassist.log"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

$host.UI.RawUI.WindowTitle = "PharmAssist Realtime Copilot"
"[$(Get-Date -Format o)] Starting PharmAssist" | Set-Content -Encoding utf8 -LiteralPath $logPath

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  "Node.js 24 is required: https://nodejs.org" | Add-Content -Encoding utf8 -LiteralPath $logPath
  exit 1
}

if (-not (Test-Path -LiteralPath ".env")) {
  Copy-Item -LiteralPath ".env.example" -Destination ".env"
  ".env created (default: local demo with zero API cost)" | Add-Content -Encoding utf8 -LiteralPath $logPath
}

if (-not (Test-Path -LiteralPath "node_modules")) {
  "Installing first-run dependencies" | Add-Content -Encoding utf8 -LiteralPath $logPath
  & corepack pnpm install --frozen-lockfile *>> $logPath
  if ($LASTEXITCODE -ne 0) { throw "Dependency install failed: $LASTEXITCODE" }
}

$waitScript = Join-Path $PSScriptRoot "wait-and-open.ps1"
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", ('"{0}"' -f $waitScript)
)

"Starting local services" | Add-Content -Encoding utf8 -LiteralPath $logPath
& corepack pnpm dev:demo *>> $logPath
if ($LASTEXITCODE -ne 0) {
  "Launch failed: $LASTEXITCODE" | Add-Content -Encoding utf8 -LiteralPath $logPath
  exit $LASTEXITCODE
}
