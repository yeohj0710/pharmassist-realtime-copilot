param(
  [ValidateRange(1024, 65526)]
  [int]$WebPort = 14273
)

$ErrorActionPreference = "Stop"
$appId = "pharmassist-realtime-copilot:v1"
$appIdPath = "/pharmassist-app-id.txt"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
$logDirectory = Join-Path $repoRoot "logs"
$logPath = Join-Path $logDirectory "pharmassist.log"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Test-TcpPortOpen {
  param([int]$Port)

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $result = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $result.AsyncWaitHandle.WaitOne(250)) { return $false }
    $client.EndConnect($result)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-PharmAssistIdentity {
  param([int]$Port)

  try {
    $response = Invoke-WebRequest -UseBasicParsing `
      -Uri "http://127.0.0.1:$Port$appIdPath" `
      -TimeoutSec 1 `
      -Headers @{ "Cache-Control" = "no-cache" }
    return $response.StatusCode -eq 200 -and $response.Content.Trim() -ceq $appId
  } catch {
    return $false
  }
}

$candidatePorts = $WebPort..($WebPort + 9)
foreach ($candidatePort in $candidatePorts) {
  if (Test-PharmAssistIdentity -Port $candidatePort) {
    Start-Process "http://127.0.0.1:$candidatePort"
    exit 0
  }
}

$selectedPort = $null
foreach ($candidatePort in $candidatePorts) {
  if (-not (Test-TcpPortOpen -Port $candidatePort)) {
    $selectedPort = $candidatePort
    break
  }
}
if ($null -eq $selectedPort) {
  throw "PharmAssist web ports $WebPort-$($WebPort + 9) are all occupied."
}

$host.UI.RawUI.WindowTitle = "PharmAssist Realtime Copilot"
"[$(Get-Date -Format o)] Starting PharmAssist on port $selectedPort" |
  Set-Content -Encoding utf8 -LiteralPath $logPath

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

$env:PHARMASSIST_WEB_PORT = [string]$selectedPort
$waitScript = Join-Path $PSScriptRoot "wait-and-open.ps1"
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", ('"{0}"' -f $waitScript),
  "-WebPort", $selectedPort,
  "-ExpectedAppId", $appId
)

"Starting local services" | Add-Content -Encoding utf8 -LiteralPath $logPath
& corepack pnpm dev:demo *>> $logPath
if ($LASTEXITCODE -ne 0) {
  "Launch failed: $LASTEXITCODE" | Add-Content -Encoding utf8 -LiteralPath $logPath
  exit $LASTEXITCODE
}
