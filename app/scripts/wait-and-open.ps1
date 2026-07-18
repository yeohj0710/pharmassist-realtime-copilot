param(
  [ValidateRange(1024, 65535)]
  [int]$WebPort = 14273,
  [string]$ExpectedAppId = "pharmassist-realtime-copilot:v1"
)

$deadline = (Get-Date).AddMinutes(3)
$baseUrl = "http://127.0.0.1:$WebPort"
$identityUrl = "$baseUrl/pharmassist-app-id.txt"

while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $identityUrl -TimeoutSec 2 -Headers @{
      "Cache-Control" = "no-cache"
    }
    if ($response.StatusCode -eq 200 -and $response.Content.Trim() -ceq $ExpectedAppId) {
      Start-Process $baseUrl
      exit 0
    }
  } catch {}
  Start-Sleep -Milliseconds 500
}

exit 1
