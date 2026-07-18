$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $projectRoot
$source = Join-Path $PSScriptRoot "PharmAssistLauncher.cs"
$outputName = -join @([char]0xC57D,[char]0xAD6D,' ',[char]0xC0C1,[char]0xB2F4,' ',[char]0xB3C4,[char]0xC6B0,[char]0xBBF8,'.exe')
$output = Join-Path $repoRoot $outputName
$compiledOutput = Join-Path $repoRoot "etc\PharmAssist-launcher.exe"
$icon = Join-Path $projectRoot "assets\PharmAssist.ico"

& (Join-Path $PSScriptRoot "build-windows-icon.ps1")
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path -LiteralPath $csc)) {
  $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
& $csc /nologo /codepage:65001 /target:winexe "/out:$compiledOutput" "/win32icon:$icon" /reference:System.dll /reference:System.Windows.Forms.dll $source
if ($LASTEXITCODE -ne 0) { throw "Launcher build failed: $LASTEXITCODE" }
Move-Item -LiteralPath $compiledOutput -Destination $output -Force
Write-Host "Created: $output"
