$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $PSScriptRoot "PharmAssistLauncher.cs"
$output = Join-Path $repoRoot "PharmAssist.exe"

Add-Type -Path $source -ReferencedAssemblies @("System.dll", "System.Windows.Forms.dll") -OutputAssembly $output -OutputType WindowsApplication
Write-Host "Created: $output"
