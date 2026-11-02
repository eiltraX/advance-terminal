# Advance Terminal V4

Advance Terminal is a standalone Electron desktop app for local terminal sessions, remote SSH connections, server management, SSH key generation, command shortcuts, audit logs, live console output, and session reports.

This package is **not Laravel** and is not cloud-hosted.

## Version

Current app version: **4.0.0**.

## Development baseline

Before new feature work, this baseline should stay true:

- `npm run check` passes.
- Local Terminal opens on Windows.
- `npm run check` works inside the app's Local Terminal.
- SSH password connections still work.
- Saved SSH passwords/passphrases are not written to `settings.json`.
- Reports can be generated and saved.
- Renderer helper files load before `renderer.js`.

## Main app screens

- Main Terminal Session screen
- Connections panel
- Commands panel
- Settings screen
- Appearance tab
- Terminal Actions tab
- SSH Keys tab
- Audit Log tab
- About tab
- Live Console drawer
- Session Report modal

## Development run

Open a terminal in this folder and run:

```bash
npm install
npm run check
npm start
```

On Windows, you can also double-click:

```text
Start-Advance-Terminal.bat
```

The BAT file checks Node.js, installs dependencies when `node_modules` is missing, runs the syntax check, and starts the app.

## Project structure

```text
src/main/main.js                       Electron main process and IPC
src/main/preload.js                    Safe renderer bridge
src/main/store.js                      Local settings and audit storage
src/main/secret-store.js               Encrypted saved credential storage
src/main/terminal-manager.js           Local and SSH terminal sessions
src/main/key-manager.js                SSH key generation
src/renderer/index.html                Renderer UI markup
src/renderer/renderer.js               Main renderer controller
src/renderer/js/renderer-foundation.js Shared safe UI/report helpers
src/renderer/js/renderer-terminal-helpers.js Terminal/session helpers
src/renderer/js/renderer-connection-helpers.js Connection list/health helpers
src/renderer/js/renderer-report-helpers.js Report/settings/runtime helpers
src/renderer/styles.css                Renderer styling
scripts/check-foundation.js            Baseline regression checks
```

## Renderer cleanup status

The renderer has been partially split into helper files. Keep new shared logic in the matching helper file instead of adding more utility code to `src/renderer/renderer.js`.

Load order in `index.html` must stay:

```text
renderer-foundation.js
renderer-terminal-helpers.js
renderer-connection-helpers.js
renderer-report-helpers.js
renderer.js
```

## Secure credential storage

Saved SSH passwords and SSH key passphrases are not written to `settings.json`.

Secrets are stored in the Electron `userData` folder through Electron `safeStorage` when encryption is available. The settings file keeps only non-secret connection metadata and flags such as `savePassword` and `savePassphrase`.

Settings export/import remains secret-safe:

- saved passwords are not exported
- key passphrases are not exported
- SSH private key file contents are not exported
- report history and audit logs are not imported from settings backups

## Windows build

The build is configured for Electron Builder and NSIS.

To create an unpacked Windows app folder:

```bash
npm run pack:win
```

To create a Windows installer:

```bash
npm run dist:win
```

Or run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Build-Windows-Installer.ps1
```

Build output is saved in:

```text
dist
```

Expected installer filename pattern:

```text
Advance Terminal-Setup-4.0.0-x64.exe
```

The app and installer use the bundled files in `build/`:

```text
build/icon.ico
build/icon.png
build/installer-dependency-checks.nsh
```

These files are included through Electron Builder `extraResources`.

## Features

- Local terminal sessions using bundled `node-pty`
- Remote SSH terminal sessions using the integrated `ssh2` engine
- Password SSH without Windows `ssh.exe`
- Private-key SSH using local private key files
- SSH key generation through local `ssh-keygen`
- Local settings stored in Electron `userData`
- Secure local credential storage through Electron `safeStorage`
- Local audit log
- Windows-style desktop UI
- Terminal action toolbar
- Daily scoped report export/copy flow
- Report History
- Error Assistant summaries

## Windows shell notes

For local terminal sessions, the default shell is PowerShell. You may set the Shell Path in Settings to:

```text
powershell.exe
cmd.exe
```

For Remote SSH, add a server in Settings and choose Private Key or Password authentication.

Generated SSH private keys are stored locally in the Electron `userData` folder.

## Final pre-development cleanup notes

This cleanup baseline:

- keeps saved credentials out of plaintext settings
- fixes Windows Local Terminal `npm`/`npx` command compatibility
- splits shared renderer helper logic into dedicated files
- adds `scripts/check-foundation.js` regression checks
- keeps installer/build metadata aligned with V4


## Auto-update release flow

Advance Terminal is configured for GitHub Releases auto-update:

```text
Repo: eiltraX/advance-terminal
Provider: GitHub Releases
Windows target: NSIS
```

Auto-update requires `electron-updater` as an app dependency. After applying the patch, run:

```powershell
npm install
npm run check
```

For normal local installer builds that do not publish:

```powershell
npm run dist:win
```

For release builds that publish update metadata and installer assets to GitHub Releases:

```powershell
npm run release:win
```

Before publishing, save a valid GitHub token locally as `GH_TOKEN`. Never commit or share the token.

```powershell
setx GH_TOKEN "PASTE_NEW_TOKEN_HERE"
```

Close PowerShell, reopen it, then verify only that the token exists:

```powershell
if ($env:GH_TOKEN) { "GH_TOKEN saved" } else { "GH_TOKEN missing" }
```

The installed app checks for updates on startup and also provides a manual Check for Updates button in Settings → About. Release builds should be made from the same source version that is uploaded to GitHub Releases.
