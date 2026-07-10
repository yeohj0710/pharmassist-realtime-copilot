$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:4173" -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      Start-Process "http://127.0.0.1:4173"
      exit 0
    }
  } catch {
    Start-Sleep -Milliseconds 500
  }
}
exit 1
