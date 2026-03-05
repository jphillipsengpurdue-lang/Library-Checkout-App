$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

function Get-RepoRoot {
    if ($PSScriptRoot -and (Test-Path $PSScriptRoot)) {
        return (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
    }

    if ($MyInvocation -and $MyInvocation.MyCommand -and $MyInvocation.MyCommand.Path) {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        return (Resolve-Path (Join-Path $scriptDir "..\.."))
    }

    # Final fallback: assume script is run from repository root
    return (Resolve-Path (Get-Location))
}

function Ensure-Node {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Ok "Node.js already installed: $(node -v)"
        return
    }

    Write-Warn "Node.js not found. Installing Node.js LTS automatically via winget..."
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "winget is not available on this computer. Please install App Installer from Microsoft Store, then run setup again."
    }

    winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements

    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath"

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js install command ran, but node is still unavailable. Please restart computer and run setup again."
    }

    Write-Ok "Node.js installed: $(node -v)"
}

function Ensure-NpmPackages($repoRoot) {
    Write-Info "Installing app dependencies (one-time)..."
    Push-Location $repoRoot
    try {
        npm install
    }
    finally {
        Pop-Location
    }
    Write-Ok "Dependencies installed"
}


function Ensure-ElectronNativeModules($repoRoot) {
    Write-Info "Rebuilding native modules for Electron (fixes sqlite3 binding errors)..."
    Push-Location $repoRoot
    try {
        npm run rebuild:electron
    }
    finally {
        Pop-Location
    }
    Write-Ok "Electron native modules ready"
}

function New-DesktopShortcut($name, $targetPath, $arguments, $workingDir) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktop "$name.lnk"

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetPath
    $shortcut.Arguments = $arguments
    $shortcut.WorkingDirectory = $workingDir
    $shortcut.IconLocation = "$targetPath,0"
    $shortcut.Save()

    Write-Ok "Desktop shortcut created: $shortcutPath"
}

function Setup-Host($repoRoot) {
    $defaultDbPath = "C:\LibraryCheckout\data\library.db"
    $defaultPort = "4312"

    $dbPath = Read-Host "Host DB path [$defaultDbPath]"
    if ([string]::IsNullOrWhiteSpace($dbPath)) { $dbPath = $defaultDbPath }

    $port = Read-Host "Host port [$defaultPort]"
    if ([string]::IsNullOrWhiteSpace($port)) { $port = $defaultPort }

    $batPath = Join-Path $repoRoot "start-host.bat"
    @"
@echo off
set LIBRARY_DB_PATH=$dbPath
set LIBRARY_SERVER_PORT=$port
cd /d "$repoRoot"
npm run rebuild:electron
if errorlevel 1 goto :eof
npm run start:server
pause
"@ | Set-Content -Path $batPath -Encoding ASCII

    New-DesktopShortcut -name "Library Checkout - Host Server" -targetPath "cmd.exe" -arguments "/c \"$batPath\"" -workingDir $repoRoot
    Write-Ok "Host setup complete. Double-click 'Library Checkout - Host Server' on desktop to run host."
}

function Setup-Client($repoRoot) {
    $defaultServer = "http://BGC-LIB-SERVER:4312"
    $serverUrl = Read-Host "Host server URL [$defaultServer]"
    if ([string]::IsNullOrWhiteSpace($serverUrl)) { $serverUrl = $defaultServer }

    $batPath = Join-Path $repoRoot "start-client.bat"
    @"
@echo off
set LIBRARY_SERVER_URL=$serverUrl
cd /d "$repoRoot"
npm run rebuild:electron
if errorlevel 1 goto :eof
npm start
"@ | Set-Content -Path $batPath -Encoding ASCII

    New-DesktopShortcut -name "Library Checkout" -targetPath "cmd.exe" -arguments "/c \"$batPath\"" -workingDir $repoRoot
    Write-Ok "Client setup complete. Double-click 'Library Checkout' on desktop to launch app."
}

Write-Host "==============================================="
Write-Host " Library Checkout One-Click Setup (Windows)"
Write-Host "==============================================="

$repoRoot = Get-RepoRoot
Write-Info "Using app folder: $repoRoot"

Ensure-Node
Ensure-NpmPackages -repoRoot $repoRoot
Ensure-ElectronNativeModules -repoRoot $repoRoot

$mode = Read-Host "Type HOST or CLIENT"
if ($mode -match '^(HOST|H)$') {
    Setup-Host -repoRoot $repoRoot
}
elseif ($mode -match '^(CLIENT|C)$') {
    Setup-Client -repoRoot $repoRoot
}
else {
    throw "Invalid option. Please run again and type HOST or CLIENT."
}

Write-Host ""
Write-Ok "Setup finished successfully."
