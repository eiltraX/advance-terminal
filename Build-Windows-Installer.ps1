$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-File {
    param(
        [string]$Path,
        [string]$Message
    )
    if (-not (Test-Path $Path)) {
        throw $Message
    }
}

function Run-Cmd {
    param(
        [Parameter(Mandatory=$true)][string]$Exe,
        [Parameter(ValueFromRemainingArguments=$true)][string[]]$ArgumentList
    )

    Write-Host ("> " + $Exe + " " + ($ArgumentList -join " ")) -ForegroundColor DarkGray
    & $Exe @ArgumentList

    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE`: $Exe $($ArgumentList -join ' ')"
    }
}

function Get-NodeMajorVersion {
    param([string]$NodeExe)
    $raw = (& $NodeExe -v).Trim()
    if ($raw -notmatch '^v(\d+)\.') {
        throw "Unable to read Node.js version. Found: $raw"
    }
    return [int]$Matches[1]
}

Write-Host "Advance Terminal Windows Installer Builder" -ForegroundColor Green
Write-Host "Project: $PSScriptRoot"

Set-Location $PSScriptRoot

Write-Step "Checking build dependencies"
$nodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    throw "node.exe was not found. Install Node.js LTS, then reopen PowerShell."
}

$nodeExe = $nodeCommand.Source
$nodeDir = Split-Path $nodeExe -Parent
$npmCmd = Join-Path $nodeDir "npm.cmd"
$npxCmd = Join-Path $nodeDir "npx.cmd"

Assert-File $npmCmd "npm.cmd was not found beside node.exe. Reinstall Node.js LTS and make sure npm is included. Expected: $npmCmd"
Assert-File $npxCmd "npx.cmd was not found beside node.exe. Reinstall Node.js LTS and make sure npm is included. Expected: $npxCmd"

$nodeMajor = Get-NodeMajorVersion $nodeExe
if ($nodeMajor -lt 18) {
    throw "Node.js 18 or newer is required to build this installer. Current version: $(& $nodeExe -v)"
}

Write-Host "Node: $(& $nodeExe -v)"
Write-Host "npm:  $(& $npmCmd -v)"
Write-Host "Using npm: $npmCmd"
Write-Host "Using npx: $npxCmd"

Assert-File ".\package.json" "package.json was not found. Run this script inside the Advance Terminal project folder."

Write-Step "Cleaning old build output"
if (Test-Path ".\dist") { Remove-Item ".\dist" -Recurse -Force }
if (Test-Path ".\release") { Remove-Item ".\release" -Recurse -Force }

Write-Step "Installing / refreshing npm packages"
Run-Cmd $npmCmd install --include=dev

Write-Step "Checking JavaScript syntax"
Run-Cmd $npmCmd run check

Write-Step "Confirming pinned Electron Builder setup"
$electronCmd = Join-Path $PSScriptRoot "node_modules\.bin\electron.cmd"
$builderCmd = Join-Path $PSScriptRoot "node_modules\.bin\electron-builder.cmd"
Assert-File $electronCmd "Local Electron binary was not found after npm install. Expected: $electronCmd"
Assert-File $builderCmd "Local Electron Builder binary was not found after npm install. Expected: $builderCmd"
Run-Cmd $electronCmd --version
Run-Cmd $builderCmd --version

Write-Step "Rebuilding native Electron dependencies"
Run-Cmd $builderCmd install-app-deps

Write-Step "Building Windows NSIS installer"
Run-Cmd $builderCmd --win --x64

Write-Step "Done"
$setupFiles = Get-ChildItem -Path ".\dist" -Filter "*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
if ($setupFiles) {
    Write-Host "Installer created:" -ForegroundColor Green
    $setupFiles | ForEach-Object { Write-Host "  $($_.FullName)" }
} else {
    throw "Build finished, but no installer EXE was found in dist. Check the build output above."
}
