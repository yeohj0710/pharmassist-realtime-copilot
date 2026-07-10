$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

$host.UI.RawUI.WindowTitle = "PharmAssist Realtime Copilot"
Write-Host "Starting PharmAssist..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js 24 is required: https://nodejs.org" -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

if (-not (Test-Path -LiteralPath ".env")) {
  Copy-Item -LiteralPath ".env.example" -Destination ".env"
  Write-Host ".env created (default: local demo with zero API cost)" -ForegroundColor Green
}

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host "Installing first-run dependencies..." -ForegroundColor Yellow
  & corepack pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw "Dependency install failed: $LASTEXITCODE" }
}

$waitScript = Join-Path $PSScriptRoot "wait-and-open.ps1"
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", ('"{0}"' -f $waitScript)
)

Write-Host "Server is running. Close this window to stop PharmAssist." -ForegroundColor Green
& corepack pnpm dev:demo
if ($LASTEXITCODE -ne 0) {
  Write-Host "Launch failed: $LASTEXITCODE" -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit $LASTEXITCODE
}
