<#
Automated ffmpeg installer (PowerShell)
- Downloads ffmpeg "essentials" zip from gyan.dev
- Extracts and places ffmpeg folder under preferred destination (Z:\ffmpeg or h:\projeto novo\ffmpeg)
- Adds the bin folder to the user PATH via setx

Usage (PowerShell):
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  & "h:\projeto novo\scripts\install-ffmpeg.ps1"
#>

$ErrorActionPreference = 'Stop'

# Preferred destination
$preferred = 'Z:\ffmpeg'
$fallback  = 'h:\projeto novo\ffmpeg'
$destRoot  = if (Test-Path 'Z:\') { $preferred } else { $fallback }
$zipPath   = Join-Path $env:TEMP 'ffmpeg-release-essentials.zip'
$tempDir   = Join-Path $env:TEMP 'ffmpeg_extract'

# Remote URL (Gyan builds - essentials)
$ffUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'

Write-Host "Destination: $destRoot"
Write-Host "Downloading ffmpeg (this may take a minute)..."

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }

Invoke-WebRequest -Uri $ffUrl -OutFile $zipPath -UseBasicParsing
Write-Host "Download complete: $zipPath"

Write-Host "Extracting..."
Expand-Archive -Path $zipPath -DestinationPath $tempDir

# Find extracted folder that contains bin\ffmpeg.exe
$found = Get-ChildItem -Path $tempDir -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'bin\ffmpeg.exe') } | Select-Object -First 1
if (-not $found) {
    Write-Error "Could not find extracted ffmpeg bin. Extraction path: $tempDir"
    exit 1
}

$sourceFolder = $found.FullName
$ffmpegBin = Join-Path $destRoot 'bin'

# Move/copy to destination
if (-not (Test-Path $destRoot)) { New-Item -ItemType Directory -Path $destRoot -Force | Out-Null }
# Remove existing dest bin to avoid stale files
if (Test-Path $ffmpegBin) { Remove-Item -Recurse -Force $ffmpegBin }

Copy-Item -Path (Join-Path $sourceFolder '*') -Destination $destRoot -Recurse -Force

# Ensure bin exists
if (-not (Test-Path $ffmpegBin)) {
    Write-Error "Unexpected: bin folder not found at $ffmpegBin"qna
    exit 1
}

# Update user PATH
$currentPath = (Get-Item -Path Env:Path).Value
$newPath = "$currentPath;$ffmpegBin"
Write-Host "Adding $ffmpegBin to user PATH (setx)"
setx PATH "$newPath" | Out-Null

Write-Host "Cleaning temporary files..."
Remove-Item $zipPath -Force
Remove-Item $tempDir -Recurse -Force

Write-Host "Done. Close and re-open PowerShell (or log off) so PATH changes take effect."
Write-Host "Verify with: ffmpeg -version"