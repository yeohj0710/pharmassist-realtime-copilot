$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot ".env"
$examplePath = Join-Path $repoRoot ".env.example"

if (-not (Test-Path -LiteralPath $envPath)) {
  Copy-Item -LiteralPath $examplePath -Destination $envPath
}

$secureKey = Read-Host "OpenAI API key (화면에 표시되지 않음)" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if (-not $key.StartsWith("sk-")) { throw "올바른 OpenAI API key 형식이 아닙니다." }
  $content = Get-Content -Raw -Encoding utf8 -LiteralPath $envPath
  $content = [regex]::Replace($content, "(?m)^OPENAI_API_KEY=.*$", "OPENAI_API_KEY=$key")
  $content = [regex]::Replace($content, "(?m)^FEATURE_LLM_REFINEMENT=.*$", "FEATURE_LLM_REFINEMENT=true")
  $content = [regex]::Replace($content, "(?m)^FEATURE_REALTIME_TRANSCRIPTION=.*$", "FEATURE_REALTIME_TRANSCRIPTION=false")
  [IO.File]::WriteAllText($envPath, $content, [Text.UTF8Encoding]::new($false))
} finally {
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  $key = $null
}
Write-Host "로컬 .env에 저장했습니다. 저비용 refinement만 켜고 음성 API는 껐습니다. Git에는 포함되지 않습니다." -ForegroundColor Green
