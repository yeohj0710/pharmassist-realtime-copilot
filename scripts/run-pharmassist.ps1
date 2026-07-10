$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

$host.UI.RawUI.WindowTitle = "PharmAssist Realtime Copilot"
Write-Host "PharmAssist 시작 중..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js 24가 필요합니다: https://nodejs.org" -ForegroundColor Red
  Read-Host "Enter를 누르면 종료합니다"
  exit 1
}

if (-not (Test-Path -LiteralPath ".env")) {
  Copy-Item -LiteralPath ".env.example" -Destination ".env"
  Write-Host ".env 생성 완료 (기본: API 비용 0원 로컬 데모)" -ForegroundColor Green
}

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host "첫 실행 의존성 설치 중..." -ForegroundColor Yellow
  & corepack pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw "의존성 설치 실패: $LASTEXITCODE" }
}

$waitScript = Join-Path $PSScriptRoot "wait-and-open.ps1"
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", ('"{0}"' -f $waitScript)
)

Write-Host "서버 실행 중. 이 창을 닫으면 PharmAssist가 종료됩니다." -ForegroundColor Green
& corepack pnpm dev:demo
if ($LASTEXITCODE -ne 0) {
  Write-Host "실행 실패: $LASTEXITCODE" -ForegroundColor Red
  Read-Host "Enter를 누르면 종료합니다"
  exit $LASTEXITCODE
}
