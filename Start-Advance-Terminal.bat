@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Advance Terminal - Developer Runner

REM Run this BAT from the Advance Terminal source folder.
REM It uses npm.cmd instead of npm to avoid Windows "Select an app to open npm" file-association issues.

cd /d "%~dp0"

echo.
echo ==========================================
echo  Advance Terminal - Developer Runner
echo ==========================================
echo Current folder:
echo %CD%
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found in PATH.
    echo Install Node.js LTS, then reopen this BAT.
    echo.
    pause
    exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm.cmd was not found in PATH.
    echo Node.js may be installed incorrectly.
    echo Reinstall Node.js LTS and enable "Add to PATH".
    echo.
    pause
    exit /b 1
)

echo Node:
node.exe -v
echo NPM:
call npm.cmd -v
echo.

if not exist package.json (
    echo ERROR: package.json was not found.
    echo This BAT must be placed in the Advance Terminal source folder.
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo node_modules folder not found.
    echo Installing dependencies now...
    echo.
    call npm.cmd install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo Running syntax check...
call npm.cmd run check
if errorlevel 1 (
    echo.
    echo ERROR: npm run check failed.
    pause
    exit /b 1
)

echo.
echo Starting Advance Terminal...
echo Close the app window to return here.
echo.
call npm.cmd start

echo.
echo Advance Terminal closed.
pause
endlocal
