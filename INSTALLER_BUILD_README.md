# Advance Terminal v6.5.0 — Windows Installer Build Guide

Advance Terminal is maintained by **Artlie Digital**.

Website: https://www.artliedigital.com
Repository: https://github.com/eiltraX/advance-terminal

This document describes how to validate, run, and build the Windows installer for Advance Terminal v6.5.0.

## Build Output

Advance Terminal uses Electron Builder with an NSIS Windows installer.

The expected release assets are:

```text
dist/Advance-Terminal-Setup-6.5.0-x64.exe
dist/Advance-Terminal-Setup-6.5.0-x64.exe.blockmap
dist/latest.yml
```

The exact names are controlled by `package.json`.

## Build Prerequisites

Required on the build computer:

- Windows 10 or Windows 11
- Node.js 18 or newer
- npm and npx
- Internet access when dependencies need to be downloaded
- Visual Studio Build Tools with the Desktop development with C++ workload if a native `node-pty` rebuild requires it

End users do not need Node.js or npm to run the installed application.

## Development Validation

From the Advance Terminal project root:

```powershell
npm install
npm run check
```

`npm run check` performs:

- JavaScript syntax validation
- Advance Terminal foundation/regression checks

A release should not be built when this command fails.

## Start the Development App

Run:

```powershell
npm start
```

Or double-click:

```text
Start-Advance-Terminal.bat
```

The BAT file:

- changes to the project directory automatically
- verifies `node.exe` and `npm.cmd`
- installs dependencies when `node_modules` is missing
- runs `npm run check`
- starts Advance Terminal

## Build the Windows Installer

### Standard npm build

Run:

```powershell
npm run dist:win
```

### Build helper script

You can also run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Build-Windows-Installer.ps1
```

The helper script:

1. verifies Node.js 18 or newer
2. verifies `npm.cmd` and `npx.cmd`
3. removes old `dist/` and `release/` output
4. runs `npm install --include=dev`
5. runs `npm run check`
6. verifies the local Electron and Electron Builder binaries
7. runs Electron Builder `install-app-deps`
8. builds the Windows x64 NSIS installer
9. reports the generated installer path

## Important Build Files

```text
package.json
package-lock.json
build/icon.ico
build/icon.png
build/installer-dependency-checks.nsh
Build-Windows-Installer.ps1
Start-Advance-Terminal.bat
```

The Electron Builder configuration in `package.json` controls:

- Windows target
- NSIS installer behavior
- application icon
- installer icon
- artifact filename
- `asar` / `asarUnpack`
- bundled resources
- GitHub Releases publishing
- update metadata

## Native Dependencies

Advance Terminal includes native dependencies such as `node-pty`.

Electron Builder rebuilds compatible native application dependencies before packaging.

If a native rebuild fails, install/update Visual Studio Build Tools with the C++ desktop workload and retry the build.

## Main Runtime Components

Advance Terminal uses:

- Electron for the desktop application runtime
- `node-pty` for local terminal sessions
- `ssh2` for integrated SSH connections
- Electron `safeStorage` for supported encrypted local credential storage
- xterm.js for terminal rendering

## Secure Build Rules

Never commit or publish:

- `.env` files
- GitHub access tokens
- SignPath API tokens
- SSH private keys
- passwords or passphrases
- local `__smallzip/` backups
- `node_modules/`
- generated `dist/` output as source files

Release artifacts should be uploaded through the release/build process rather than committed to the source tree.

## GitHub Releases

The project is configured to use:

```text
Repository: eiltraX/advance-terminal
Provider: GitHub Releases
Windows target: NSIS
```

For a normal local installer build:

```powershell
npm run dist:win
```

If the configured release publishing workflow is used:

```powershell
npm run release:win
```

A GitHub token must be provided through the environment when publishing directly with Electron Builder. Never place the token in source files.

## Auto-Update Assets

For Electron auto-update to work correctly, the GitHub release must contain matching artifacts generated from the same build:

```text
Advance-Terminal-Setup-6.5.0-x64.exe
Advance-Terminal-Setup-6.5.0-x64.exe.blockmap
latest.yml
```

Do not rename the installer or blockmap after building unless `latest.yml` is regenerated to match.

## Code Signing

Advance Terminal is preparing to use SignPath Foundation open-source code signing.

The source repository includes:

```text
LICENSE
TRADEMARKS.md
CODE_SIGNING_POLICY.md
```

The project code signing policy is documented in:

[CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md)

Until the SignPath trusted build/signing workflow is approved and configured, locally generated installers are unsigned development/release artifacts.

Official signed builds should originate from the approved repository and trusted build workflow.

## Release Verification

Before publishing a release:

```powershell
npm run check
```

Then build:

```powershell
npm run dist:win
```

Verify:

- the installer launches
- Local Terminal works
- SSH connections work
- terminal input/scrolling works
- Workspaces restore
- split terminals work
- pinned tabs survive restart
- Toolbar Builder settings persist
- the app version badge shows the expected version
- installer, blockmap, and `latest.yml` filenames match

## License

Advance Terminal source code is licensed under the MIT License.

Copyright (c) 2026 Artlie Digital
https://www.artliedigital.com
