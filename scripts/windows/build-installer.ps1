$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[ERR]  $msg" -ForegroundColor Red }

$repoRoot = if ($PSScriptRoot) { Resolve-Path (Join-Path $PSScriptRoot "..\..") } else { Resolve-Path (Get-Location) }
$distDir = Join-Path $repoRoot 'dist'
$logPath = Join-Path $repoRoot 'build-installer.log'

Write-Info "Repo root: $repoRoot"
Write-Info "Logging to: $logPath"

if (Test-Path $logPath) {
    Remove-Item $logPath -Force
}

Push-Location $repoRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is required to build installer. Run scripts/windows/one-click-setup.ps1 first."
    }

    Write-Info "Installing dependencies..."
    npm install 2>&1 | Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

    Write-Info "Rebuilding native modules for Electron..."
    npm run rebuild:electron 2>&1 | Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "npm run rebuild:electron failed" }

    Write-Info "Building Windows installer (.exe)..."
    npm run dist:win 2>&1 | Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "npm run dist:win failed" }

    $installer = Get-ChildItem -Path $distDir -Filter "*Setup*.exe" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($installer) {
        Write-Ok "Build complete: $($installer.FullName)"
    } else {
        Write-Info "Build finished, but installer filename didn't match *Setup*.exe. Check dist folder."
    }

    if (Test-Path $distDir) {
        Start-Process explorer.exe $distDir
    }

    exit 0
}
catch {
    Write-Err $_.Exception.Message
    Write-Err "See full log: $logPath"
    exit 1
}
finally {
    Pop-Location
}
