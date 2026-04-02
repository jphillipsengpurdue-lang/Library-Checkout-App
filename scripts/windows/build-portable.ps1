$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[ERR]  $msg" -ForegroundColor Red }

$repoRoot = if ($PSScriptRoot) { Resolve-Path (Join-Path $PSScriptRoot "..\..") } else { Resolve-Path (Get-Location) }
$distDir = Join-Path $repoRoot 'dist'
$logPath = Join-Path $repoRoot 'build-portable.log'

Write-Info "Repo root: $repoRoot"
Write-Info "Logging to: $logPath"

if (Test-Path $logPath) {
    Remove-Item $logPath -Force
}

Push-Location $repoRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is required to build app EXE. Run scripts/windows/one-click-setup.ps1 first."
    }

    Write-Info "Installing dependencies..."
    npm install 2>&1 | Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

    Write-Info "Rebuilding native modules for Electron..."
    npm run rebuild:electron 2>&1 | Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "npm run rebuild:electron failed" }

    Write-Info "Building Windows portable app EXE..."
    npm run dist:win:portable 2>&1 | Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "npm run dist:win:portable failed" }

    $portable = Get-ChildItem -Path $distDir -Filter "*.exe" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch 'Setup' } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($portable) {
        Write-Ok "Portable app EXE ready: $($portable.FullName)"
    } else {
        Write-Info "Build finished. Check dist folder for the generated .exe file."
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
