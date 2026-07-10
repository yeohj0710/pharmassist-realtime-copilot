$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $PSScriptRoot "PharmAssistLauncher.cs"
$output = Join-Path $repoRoot "PharmAssist.exe"
$icon = Join-Path $repoRoot "assets\PharmAssist.ico"

& (Join-Path $PSScriptRoot "build-windows-icon.ps1")
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path -LiteralPath $csc)) {
  $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
& $csc /nologo /target:winexe "/out:$output" "/win32icon:$icon" /reference:System.dll /reference:System.Windows.Forms.dll $source
if ($LASTEXITCODE -ne 0) { throw "Launcher build failed: $LASTEXITCODE" }
Write-Host "Created: $output"
