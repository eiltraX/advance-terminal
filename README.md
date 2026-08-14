# Advance Terminal v6.5.1

**Advance Terminal** is an open-source Windows desktop terminal and SSH workspace maintained by **Artlie Digital**.

Website: https://www.artliedigital.com
Repository: https://github.com/eiltraX/advance-terminal

Advance Terminal is built with Electron and provides local terminal sessions, SSH connections, terminal profiles, workspaces, split terminals, advanced tabs, command shortcuts, activity logging, session reports, and Windows-focused terminal tooling.

## Current Version

**6.5.1**

The top-right application badge displays the complete installed version, for example:

```text
Advance Terminal V6.5.1
```

## Highlights

### Terminal Profiles

Create reusable terminal profiles for:

- PowerShell
- Command Prompt
- Git Bash
- WSL
- custom executables

Profiles can define arguments, starting directories, environment variables, icons, colors, and the default local terminal.

### Command Palette

Open the Command Palette with:

```text
Ctrl+Shift+P
```

Search and launch:

- Terminal Profiles
- Local connections
- SSH connections
- saved commands
- open tabs
- Terminal Actions
- Settings pages
- common application actions

### Workspaces

Save and restore complete working environments, including:

- Local and SSH tabs
- working directories
- Terminal Profiles
- tab order
- active tab
- split-terminal layouts
- toolbar layout
- window size and position
- optional startup workspace

SSH passwords and key passphrases are not stored inside Workspace definitions.

### Split Terminals

- Split Right
- Split Down
- up to four panes per tab
- Local, SSH, and Terminal Profile sessions per pane
- draggable split dividers
- active-pane command and clipboard targeting
- close individual panes
- Workspace save/restore support

### Advanced Tabs

- rename tabs
- pin/unpin tabs
- persistent pinned tabs
- tab colors
- duplicate tabs
- drag/reorder tabs
- reopen closed tabs
- close other tabs
- close tabs to the right
- Workspace metadata persistence

### Toolbar Builder v2

Terminal Actions support:

- drag-and-drop ordering
- separators
- button groups
- dropdown menus
- custom keyboard shortcuts
- custom icons
- custom colors
- Local-only actions
- SSH-only actions
- Administrator-only actions
- Terminal Profile-specific actions
- instant Save Toolbar updates

### Terminal Improvements

- native xterm scrolling and scrollback
- responsive Windows resize/Snap layouts
- smart Ctrl+C behavior
- Ctrl+V paste
- Ctrl+Shift+C / Ctrl+Shift+V
- highlight + right-click copy
- safe paste protection
- Activity Feed close/reopen support
- Administrator status and Restart as Administrator
- searchable New Terminal / connection picker

## Development Baseline

Before release work, the following should remain true:

- `npm run check` passes.
- Local terminals open normally on Windows.
- terminal input, scrollback, mouse-wheel scrolling, and native scrollbar work.
- SSH password and private-key connections still work.
- saved SSH passwords/passphrases are not written to `settings.json`.
- Workspaces restore without storing SSH secrets.
- pinned tabs survive restart.
- split terminals resize correctly.
- Toolbar Builder actions remain compatible.
- reports can be generated and saved.
- renderer helper files load before `renderer.js`.

## Development

Install dependencies:

```bash
npm install
```

Run validation:

```bash
npm run check
```

Start the application:

```bash
npm start
```

On Windows you can also run:

```text
Start-Advance-Terminal.bat
```

## Project Structure

```text
src/main/main.js                         Electron main process and IPC
src/main/preload.js                      Safe renderer bridge
src/main/store.js                        Local settings, workspaces and audit storage
src/main/secret-store.js                 Encrypted saved credential storage
src/main/terminal-manager.js             Local and SSH terminal sessions
src/main/key-manager.js                  SSH key generation
src/renderer/index.html                  Renderer UI markup
src/renderer/renderer.js                 Main renderer controller
src/renderer/js/renderer-foundation.js   Shared safe UI/report helpers
src/renderer/js/renderer-terminal-helpers.js
                                         Terminal/session helpers
src/renderer/js/renderer-connection-helpers.js
                                         Connection list/health helpers
src/renderer/js/renderer-report-helpers.js
                                         Report/settings/runtime helpers
src/renderer/styles.css                  Renderer styling
scripts/check-foundation.js              Baseline regression checks
build/                                   Installer icons and NSIS resources
```

Renderer helper load order in `src/renderer/index.html` must remain:

```text
renderer-foundation.js
renderer-terminal-helpers.js
renderer-connection-helpers.js
renderer-report-helpers.js
renderer.js
```

## Secure Credential Storage

Saved SSH passwords and SSH key passphrases are not written to plaintext `settings.json`.

Advance Terminal uses Electron `safeStorage` for saved credentials when encryption is available. Non-secret connection metadata and flags such as `savePassword` and `savePassphrase` may remain in the settings file.

Settings export/import is designed to exclude:

- saved passwords
- key passphrases
- SSH private-key contents
- report history
- audit logs

## Network and Privacy

Advance Terminal includes network features that are used for functions such as:

- connecting to SSH hosts configured by the user
- checking GitHub Releases for application updates
- downloading application updates when requested or enabled

Advance Terminal should not use network access to silently execute remote commands or connect to arbitrary hosts that were not configured by the user.

See the full [Code signing policy](CODE_SIGNING_POLICY.md) for the project privacy and signing policy.

## Windows Build

Advance Terminal uses Electron Builder with an NSIS Windows installer.

Create an unpacked Windows build:

```bash
npm run pack:win
```

Create the Windows installer:

```bash
npm run dist:win
```

Or:

```powershell
powershell -ExecutionPolicy Bypass -File .\Build-Windows-Installer.ps1
```

Build output is written to:

```text
dist/
```

Release assets normally include:

```text
Advance-Terminal-Setup-6.5.1-x64.exe
Advance-Terminal-Setup-6.5.1-x64.exe.blockmap
latest.yml
```

The application and installer use resources from:

```text
build/icon.ico
build/icon.png
build/installer-dependency-checks.nsh
```

## Auto Updates

Advance Terminal uses GitHub Releases for Windows update metadata.

```text
Repository: eiltraX/advance-terminal
Provider: GitHub Releases
Windows target: NSIS
```

For normal local builds:

```powershell
npm run dist:win
```

For configured release builds:

```powershell
npm run release:win
```

Never commit GitHub tokens, SignPath API tokens, private keys, passwords, or other credentials to this repository.

## Installation

Download the latest official Windows installer from the GitHub Releases page and run it.

Windows may display security warnings for unsigned releases. Official releases are intended to use trusted code signing once the project is approved for the SignPath Foundation open-source signing program.

## Uninstallation

Advance Terminal can be uninstalled through Windows:

1. Open **Settings**.
2. Open **Apps → Installed apps**.
3. Find **Advance Terminal**.
4. Choose **Uninstall**.

The installer is configured not to automatically delete the application data directory on uninstall. This helps prevent accidental loss of local settings and connection definitions.

## Code signing policy

**Free code signing provided by SignPath.io, certificate by SignPath Foundation.**

Advance Terminal's complete code signing and privacy policy is available in [CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md).

Current project roles:

- **Committer / reviewer:** eiltraX / Artlie Digital
- **Approver:** eiltraX / Artlie Digital

Every official signing request must be manually approved by an authorized approver.

Official signed builds must originate from the public Advance Terminal source repository and the approved trusted build workflow.

## License

Advance Terminal source code is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 **Artlie Digital**
https://www.artliedigital.com

## Branding

The MIT License applies to the source code. It does not permit third parties to falsely represent modified builds as official Artlie Digital releases.

See [TRADEMARKS.md](TRADEMARKS.md) for the project's branding policy.

## Security

Do not commit or publish:

- `.env` files
- GitHub tokens
- SignPath API tokens
- SSH private keys
- saved passwords
- key passphrases
- local backup ZIPs
- Electron `userData`
- generated `dist/` files unless intentionally published as release assets

Report security-sensitive issues privately to Artlie Digital through the official project contact channels.

## Maintainer

**Artlie Digital**
https://www.artliedigital.com
