$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $repoRoot "assets"
$iconPath = Join-Path $assets "PharmAssist.ico"
$webPublic = Join-Path $repoRoot "apps\web\public"
New-Item -ItemType Directory -Path $assets, $webPublic -Force | Out-Null

Add-Type -AssemblyName System.Drawing

function New-PharmAssistPng([int]$Size) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $bitmap.SetResolution(96, 96)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $scale = $Size / 512.0
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $radius = 112 * $scale
    $diameter = 2 * $radius
    $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
    $path.AddArc($Size - $diameter, 0, $diameter, $diameter, 270, 90)
    $path.AddArc($Size - $diameter, $Size - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc(0, $Size - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    $graphics.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#1769E0')), $path)

    $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $graphics.FillRectangle($white, 154 * $scale, 112 * $scale, 78 * $scale, 326 * $scale)
    $graphics.FillRectangle($white, 205 * $scale, 112 * $scale, 73 * $scale, 68 * $scale)
    $graphics.FillRectangle($white, 205 * $scale, 296 * $scale, 73 * $scale, 68 * $scale)
    $graphics.FillEllipse($white, 210 * $scale, 112 * $scale, 212 * $scale, 252 * $scale)
    $blue = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#1769E0'))
    $graphics.FillEllipse($blue, 232 * $scale, 180 * $scale, 111 * $scale, 116 * $scale)

    $stream = [System.IO.MemoryStream]::new()
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return $stream.ToArray()
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = [System.Collections.Generic.List[byte[]]]::new()
foreach ($size in $sizes) { $images.Add((New-PharmAssistPng $size)) }
$stream = [System.IO.File]::Create($iconPath)
$writer = [System.IO.BinaryWriter]::new($stream)
try {
  $writer.Write([uint16]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]$sizes.Count)
  $offset = 6 + (16 * $sizes.Count)
  for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sizeByte = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
    $writer.Write([byte]$sizeByte)
    $writer.Write([byte]$sizeByte)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$images[$i].Length)
    $writer.Write([uint32]$offset)
    $offset += $images[$i].Length
  }
  foreach ($image in $images) { $writer.Write($image) }
}
finally {
  $writer.Dispose()
}

[System.IO.File]::WriteAllBytes((Join-Path $webPublic 'icon-192.png'), (New-PharmAssistPng 192))
[System.IO.File]::WriteAllBytes((Join-Path $webPublic 'icon-512.png'), (New-PharmAssistPng 512))
Write-Host "Created: $iconPath"
