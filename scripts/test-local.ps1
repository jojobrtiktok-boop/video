<#
# PowerShell helper script to prepare, run and cleanup local test for the project.
# Usage:
#   - Run setup + server:  .\test-local.ps1
#   - Cleanup:            .\test-local.ps1 -Cleanup
# Notes: requires Node and ffmpeg in PATH.
#>
param(
    [switch]$Cleanup
)

function Write-Ok($m){ Write-Host "[OK]" $m -ForegroundColor Green }
function Write-Err($m){ Write-Host "[ERR]" $m -ForegroundColor Red }

$preferredUpload = 'Z:\projeto novo\backend\uploads'
$fallbackUpload  = 'h:\projeto novo\backend\uploads'
$backendDir      = 'h:\projeto novo\backend'

if (Test-Path 'Z:\') { $UPLOAD_DIR = $preferredUpload } else { $UPLOAD_DIR = $fallbackUpload }

if ($Cleanup) {
    Write-Host 'Running cleanup...'
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if (Test-Path $UPLOAD_DIR) {
        Write-Host 'Removing files in' $UPLOAD_DIR
        Remove-Item -Recurse -Force (Join-Path $UPLOAD_DIR '*') -ErrorAction SilentlyContinue
        Write-Ok 'Uploads cleared.'
    } else {
        Write-Host 'Upload directory not found:' $UPLOAD_DIR
    }
    exit 0
}

# Check node
try {
    $nv = (& node -v) 2>$null
    if (-not $nv) { throw 'node not found' }
    Write-Ok "Node found:" $nv
} catch {
    Write-Err "Node not found in PATH. Please install Node or ensure 'node' is available."
    exit 1
}

# Check ffmpeg
try {
    $fv = (& ffmpeg -version) 2>$null
    if (-not $fv) { throw 'ffmpeg not found' }
    Write-Ok 'ffmpeg found'
} catch {
    Write-Err 'ffmpeg not found. Install ffmpeg and ensure ffmpeg.exe is in PATH.'
    Write-Host 'Download: https://www.gyan.dev/ffmpeg/builds/ or https://ffmpeg.org/download.html'
    exit 1
}

# Create uploads dir if missing
if (-not (Test-Path $UPLOAD_DIR)) {
    New-Item -ItemType Directory -Path $UPLOAD_DIR -Force | Out-Null
    Write-Ok 'Created upload dir:' $UPLOAD_DIR
} else {
    Write-Ok 'Upload dir exists:' $UPLOAD_DIR
}

# Install deps if package.json exists
if (Test-Path (Join-Path $backendDir 'package.json')) {
    Push-Location $backendDir
    Write-Host 'Running npm install in' $backendDir '(may take a moment)'
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Err "npm install failed (exit $LASTEXITCODE)."; Pop-Location; exit 1 }
    Write-Ok 'Dependencies installed'
    Pop-Location
} else {
    Write-Err 'package.json not found in' $backendDir '- skipping npm install'
}

# Kill any existing Node process occupying the port before starting fresh
$existingNode = Get-Process -Name node -ErrorAction SilentlyContinue
if ($existingNode) {
    Write-Host 'Stopping existing node process(es)...'
    $existingNode | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Start server
Push-Location $backendDir
Write-Host 'Starting server: node index.js'
Start-Process -FilePath node -ArgumentList 'index.js' -WorkingDirectory $backendDir -WindowStyle Hidden
Start-Sleep -Seconds 2
try {
    $resp = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -ErrorAction Stop
    if ($resp.StatusCode -eq 200) { Write-Ok 'Server running and healthy at http://localhost:3000' }
} catch {
    Write-Host 'Could not reach health endpoint. Open a browser at http://localhost:3000 or check the backend logs.'
}
Pop-Location

Write-Host 'To stop and cleanup (delete uploads), run:'
Write-Host '    .\test-local.ps1 -Cleanup'
Write-Host ''
Write-Host 'To run a quick curl test (example):'
Write-Host '    curl.exe -X POST http://localhost:3000/api/process -F video=@C:\path\to\test.mp4 -F mode=blur'
