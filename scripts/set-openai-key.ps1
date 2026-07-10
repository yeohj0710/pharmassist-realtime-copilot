$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot ".env"
$examplePath = Join-Path $repoRoot ".env.example"

if (-not (Test-Path -LiteralPath $envPath)) {
  Copy-Item -LiteralPath $examplePath -Destination $envPath
}

$secureKey = Read-Host "OpenAI API key (input is hidden)" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if (-not $key.StartsWith("sk-")) { throw "Invalid OpenAI API key format." }
  $content = Get-Content -Raw -Encoding utf8 -LiteralPath $envPath
  $content = [regex]::Replace($content, "(?m)^OPENAI_API_KEY=.*$", "OPENAI_API_KEY=$key")
  $content = [regex]::Replace($content, "(?m)^FEATURE_LLM_REFINEMENT=.*$", "FEATURE_LLM_REFINEMENT=true")
  $content = [regex]::Replace($content, "(?m)^FEATURE_REALTIME_TRANSCRIPTION=.*$", "FEATURE_REALTIME_TRANSCRIPTION=false")
  [IO.File]::WriteAllText($envPath, $content, [Text.UTF8Encoding]::new($false))
} finally {
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  $key = $null
}
Write-Host "Saved to local .env. Low-cost refinement is on; realtime audio is off. Git excludes this file." -ForegroundColor Green
