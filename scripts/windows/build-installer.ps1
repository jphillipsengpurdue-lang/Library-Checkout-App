$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }

$repoRoot = if ($PSScriptRoot) { Resolve-Path (Join-Path $PSScriptRoot "..\..") } else { Resolve-Path (Get-Location) }
Write-Info "Repo root: $repoRoot"

Push-Location $repoRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is required to build installer. Run ONE_CLICK_SETUP.bat first."
    }

    Write-Info "Installing dependencies..."
    npm install

    Write-Info "Building Windows installer (.exe)..."
    npm run dist:win

    Write-Ok "Build complete. Check the dist folder for the setup .exe file."
}
finally {
    Pop-Location
}
