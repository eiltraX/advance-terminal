const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen } = require('electron');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { Client } = require('ssh2');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (_) {
  autoUpdater = null;
}

const { readSettings, saveSettings, addAuditLog, getSettingsFilePath, createSettingsAutoBackup } = require('./store');
const { generateSshKey } = require('./key-manager');
const { TerminalManager } = require('./terminal-manager');
const {
  getServerSecret,
  getSecretStorageStatus,
  saveAppSecret,
  getAppSecret,
  hasAppSecret,
  deleteAppSecret
} = require('./secret-store');

let mainWindow = null;
let pendingSettingsImport = null;
let pendingSettingsRepair = null;
const terminalManager = new TerminalManager();
let connectionHealthCheckInFlight = null;
const execFileAsync = promisify(execFile);
const appStartedAt = Date.now();

const UPDATE_STARTUP_DELAY_MS = 4500;
const UPDATE_MANIFEST_URL = 'https://github.com/eiltraX/advance-terminal/releases/latest/download/latest.yml';
const UPDATE_DOWNLOAD_BASE_URL = 'https://github.com/eiltraX/advance-terminal/releases/download';
const UPDATE_HTTP_TIMEOUT_MS = 15000;
let updateStatus = {
  ok: true,
  status: 'idle',
  message: 'Update checker is idle.',
  currentVersion: null,
  availableVersion: null,
  downloaded: false,
  manualDownloadUrl: null,
  progressPercent: null,
  updatedAt: new Date().toISOString()
};
let updateCheckInFlight = false;
let updateDownloadedReady = false;
let updateHandlersReady = false;
let pendingManifestUpdate = null;

function getAppIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'build', 'icon.ico');
  }

  return path.join(__dirname, '../../build/icon.ico');
}

function quotePowerShellLiteral(value) {
  return `'${String(value || '').replace(/'/g, "''")}'`;
}

function quoteWindowsCommandLineArgument(value) {
  const text = String(value ?? '');

  if (!text) {
    return '""';
  }

  if (!/[\s"]/u.test(text)) {
    return text;
  }

  let quoted = '"';
  let backslashes = 0;

  for (const character of text) {
    if (character === '\\') {
      backslashes += 1;
      continue;
    }

    if (character === '"') {
      quoted += '\\'.repeat((backslashes * 2) + 1);
      quoted += '"';
      backslashes = 0;
      continue;
    }

    quoted += '\\'.repeat(backslashes);
    quoted += character;
    backslashes = 0;
  }

  quoted += '\\'.repeat(backslashes * 2);
  quoted += '"';
  return quoted;
}

async function isWindowsProcessElevated() {
  if (process.platform !== 'win32') {
    return false;
  }

  const script = [
    '$identity = [Security.Principal.WindowsIdentity]::GetCurrent()',
    '$principal = New-Object Security.Principal.WindowsPrincipal($identity)',
    '$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
  ].join('; ');

  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script
    ], {
      windowsHide: true,
      timeout: 5000
    });

    return String(stdout || '').trim().toLowerCase() === 'true';
  } catch (_) {
    return false;
  }
}

function getElevatedRelaunchArgs() {
  if (process.defaultApp) {
    return [app.getAppPath(), ...process.argv.slice(2)];
  }

  return process.argv.slice(1);
}

async function restartAsAdministrator() {
  if (process.platform !== 'win32') {
    return {
      ok: false,
      error: 'Administrator restart is only available on Windows.'
    };
  }

  if (await isWindowsProcessElevated()) {
    return {
      ok: true,
      alreadyElevated: true
    };
  }

  const executable = process.execPath;
  const launchArgs = getElevatedRelaunchArgs();
  const argumentLine = launchArgs.map(quoteWindowsCommandLineArgument).join(' ');
  const argumentExpression = argumentLine
    ? ` -ArgumentList ${quotePowerShellLiteral(argumentLine)}`
    : '';
  const workingDirectory = process.cwd();
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `Start-Process -FilePath ${quotePowerShellLiteral(executable)}${argumentExpression} -WorkingDirectory ${quotePowerShellLiteral(workingDirectory)} -Verb RunAs | Out-Null`
  ].join('; ');

  try {
    await execFileAsync('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script
    ], {
      windowsHide: true,
      timeout: 120000
    });

    setTimeout(() => {
      app.quit();
    }, 180);

    return {
      ok: true,
      restarting: true
    };
  } catch (_) {
    return {
      ok: false,
      error: 'Administrator restart was cancelled or could not be started.'
    };
  }
}


async function findWindowsExecutable(commandName) {
  if (process.platform !== 'win32') {
    return '';
  }

  try {
    const { stdout } = await execFileAsync('where.exe', [commandName], {
      windowsHide: true,
      timeout: 5000
    });

    const first = String(stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);

    return first || '';
  } catch (_) {
    return '';
  }
}

async function detectTerminalProfileShells() {
  const results = [];

  const add = (kind, name, executable, available, source = '') => {
    results.push({
      kind,
      name,
      executable: String(executable || ''),
      available: Boolean(available),
      source
    });
  };

  if (process.platform === 'win32') {
    const powershell = await findWindowsExecutable('powershell.exe');
    const pwsh = await findWindowsExecutable('pwsh.exe');
    const cmd = await findWindowsExecutable('cmd.exe');
    const wsl = await findWindowsExecutable('wsl.exe');

    add('powershell', 'Windows PowerShell', powershell || 'powershell.exe', Boolean(powershell), 'PATH');
    add('powershell', 'PowerShell 7', pwsh || 'pwsh.exe', Boolean(pwsh), 'PATH');
    add('cmd', 'Command Prompt', cmd || 'cmd.exe', Boolean(cmd), 'PATH');
    add('wsl', 'Windows Subsystem for Linux', wsl || 'wsl.exe', Boolean(wsl), 'PATH');

    const gitCandidates = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'usr', 'bin', 'bash.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe')
    ].filter(Boolean);

    const gitBash = gitCandidates.find((candidate) => {
      try {
        return fs.statSync(candidate).isFile();
      } catch (_) {
        return false;
      }
    }) || '';

    add(
      'git-bash',
      'Git Bash',
      gitBash || 'C:\\Program Files\\Git\\bin\\bash.exe',
      Boolean(gitBash),
      gitBash ? 'Common install path' : 'Not detected'
    );

    return results;
  }

  const defaultShell = process.env.SHELL || '/bin/bash';
  add('custom', path.basename(defaultShell) || 'Shell', defaultShell, Boolean(defaultShell), 'SHELL');
  return results;
}

function resolveTerminalProfileForServer(settings, server, requestedProfileId = '') {
  const profiles = Array.isArray(settings?.terminalProfiles) ? settings.terminalProfiles : [];
  const profileId = String(requestedProfileId || server?.profileId || '').trim();
  const profile = profiles.find((item) => item.id === profileId) || null;

  if (!profile) {
    return { server, profile: null };
  }

  const effectiveServer = {
    ...(server || {}),
    id: server?.id || `terminal-profile:${profile.id}`,
    type: 'local',
    name: server?.name || profile.name || 'Terminal Profile',
    description: server?.description || 'Terminal Profile',
    group: server?.group || 'Profiles',
    profileId: profile.id,
    shell: profile.executable || server?.shell || '',
    workingDirectory: String(server?.workingDirectory || '').trim()
      || String(profile.workingDirectory || '').trim(),
    terminalProfile: profile
  };

  return {
    server: effectiveServer,
    profile
  };
}


function getUserSshPath() {
  return path.join(app.getPath('home'), '.ssh');
}

function getAppSshPath() {
  return path.join(app.getPath('userData'), 'ssh-keys');
}

function getSshKeyLocations() {
  return [
    {
      id: 'system',
      label: 'Windows .ssh folder',
      path: getUserSshPath()
    },
    {
      id: 'app',
      label: 'Advance Terminal keys',
      path: getAppSshPath()
    }
  ];
}

function isIgnoredSshKeyFile(fileName) {
  const lowerName = String(fileName || '').toLowerCase();

  if (!lowerName || lowerName.endsWith('.pub')) {
    return true;
  }

  return new Set([
    'authorized_keys',
    'known_hosts',
    'known_hosts.old',
    'config'
  ]).has(lowerName);
}

function looksLikeSshPrivateKey(filePath, fileName) {
  if (isIgnoredSshKeyFile(fileName)) {
    return false;
  }

  try {
    const stat = fs.statSync(filePath);

    if (!stat.isFile() || stat.size <= 0 || stat.size > 1024 * 1024) {
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8').slice(0, 8192);

    return /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(content)
      || /^PuTTY-User-Key-File-/m.test(content);
  } catch (_) {
    return false;
  }
}

function listAvailableSshKeys() {
  const keys = [];
  const seen = new Set();

  getSshKeyLocations().forEach((location) => {
    if (!fs.existsSync(location.path)) {
      return;
    }

    let entries = [];

    try {
      entries = fs.readdirSync(location.path, { withFileTypes: true });
    } catch (_) {
      return;
    }

    entries.forEach((entry) => {
      if (!entry.isFile()) {
        return;
      }

      const privateKeyPath = path.join(location.path, entry.name);
      const resolvedPath = path.resolve(privateKeyPath);

      if (seen.has(resolvedPath) || !looksLikeSshPrivateKey(privateKeyPath, entry.name)) {
        return;
      }

      seen.add(resolvedPath);

      let stat = null;

      try {
        stat = fs.statSync(privateKeyPath);
      } catch (_) {
        stat = null;
      }

      const publicKeyPath = `${privateKeyPath}.pub`;
      const hasPublicKey = fs.existsSync(publicKeyPath);

      keys.push({
        id: Buffer.from(resolvedPath).toString('base64'),
        name: entry.name,
        privateKeyPath,
        publicKeyPath,
        hasPublicKey,
        locationId: location.id,
        locationLabel: location.label,
        locationPath: location.path,
        sizeBytes: stat ? stat.size : 0,
        modifiedAt: stat ? stat.mtime.toISOString() : null
      });
    });
  });

  keys.sort((a, b) => {
    if (a.locationId !== b.locationId) {
      return a.locationId === 'system' ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });

  return keys;
}

function getPublicKeyForPrivateKey(privateKeyPath) {
  const safePath = String(privateKeyPath || '').trim();

  if (!safePath || safePath.toLowerCase().endsWith('.pub')) {
    return { ok: false, error: 'Select a private key, not a .pub file.' };
  }

  const publicKeyPath = `${safePath}.pub`;

  if (!fs.existsSync(publicKeyPath)) {
    return {
      ok: false,
      error: `Public key file not found: ${publicKeyPath}`
    };
  }

  try {
    return {
      ok: true,
      publicKeyPath,
      publicKey: fs.readFileSync(publicKeyPath, 'utf8').trim()
    };
  } catch (error) {
    return {
      ok: false,
      error: `Could not read public key: ${error.message}`
    };
  }
}

function ensureDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
  }
}

async function openSshKeyLocation(payload = {}) {
  const target = payload || {};

  if (target.privateKeyPath) {
    const privateKeyPath = String(target.privateKeyPath);

    if (fs.existsSync(privateKeyPath)) {
      shell.showItemInFolder(privateKeyPath);
      return { ok: true };
    }

    const parentPath = path.dirname(privateKeyPath);
    if (parentPath && fs.existsSync(parentPath)) {
      const error = await shell.openPath(parentPath);
      return error ? { ok: false, error } : { ok: true };
    }

    return { ok: false, error: 'Private key folder was not found.' };
  }

  const location = getSshKeyLocations().find((item) => item.id === target.locationId)
    || getSshKeyLocations()[0];

  ensureDirectory(location.path);
  const error = await shell.openPath(location.path);

  return error ? { ok: false, error } : { ok: true };
}


function getArchiveTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('') + '-' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function sanitizeArchiveName(value) {
  return String(value || 'ssh-key')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'ssh-key';
}

function resolveSshKeyForArchive(privateKeyPath) {
  const safePath = String(privateKeyPath || '').trim();

  if (!safePath || safePath.toLowerCase().endsWith('.pub')) {
    return { ok: false, error: 'Select a private key, not a .pub file.' };
  }

  const resolvedPath = path.resolve(safePath);
  const key = listAvailableSshKeys().find((item) => path.resolve(item.privateKeyPath) === resolvedPath);

  if (!key) {
    return { ok: false, error: 'Private key was not found in the managed SSH key list.' };
  }

  if (!fs.existsSync(key.privateKeyPath) || !looksLikeSshPrivateKey(key.privateKeyPath, key.name)) {
    return { ok: false, error: 'Selected file is not a valid SSH private key.' };
  }

  return { ok: true, key };
}

function getArchiveFolderForKey(key) {
  const sourceDirectory = path.dirname(key.privateKeyPath);
  const archiveRoot = path.join(sourceDirectory, '__advance_terminal_archived_keys');
  const baseName = `${getArchiveTimestamp()}-${sanitizeArchiveName(key.name)}`;
  let archiveFolder = path.join(archiveRoot, baseName);
  let counter = 2;

  ensureDirectory(archiveRoot);

  while (fs.existsSync(archiveFolder)) {
    archiveFolder = path.join(archiveRoot, `${baseName}-${counter}`);
    counter += 1;
  }

  fs.mkdirSync(archiveFolder, { recursive: true, mode: 0o700 });
  return archiveFolder;
}

function moveFileToArchive(sourcePath, archiveFolder) {
  if (!fs.existsSync(sourcePath)) {
    return null;
  }

  const targetPath = path.join(archiveFolder, path.basename(sourcePath));
  fs.renameSync(sourcePath, targetPath);

  return {
    from: sourcePath,
    to: targetPath
  };
}

function archiveSshKeyPair(privateKeyPath) {
  const resolved = resolveSshKeyForArchive(privateKeyPath);

  if (!resolved.ok) {
    return resolved;
  }

  const { key } = resolved;
  const archiveFolder = getArchiveFolderForKey(key);
  const archivedFiles = [];

  const privateResult = moveFileToArchive(key.privateKeyPath, archiveFolder);
  if (privateResult) {
    archivedFiles.push({
      type: 'private',
      ...privateResult
    });
  }

  const publicKeyPath = `${key.privateKeyPath}.pub`;
  const publicResult = moveFileToArchive(publicKeyPath, archiveFolder);
  if (publicResult) {
    archivedFiles.push({
      type: 'public',
      ...publicResult
    });
  }

  if (!archivedFiles.length) {
    return { ok: false, error: 'No key files were archived.' };
  }

  return {
    ok: true,
    keyName: key.name,
    privateKeyPath: key.privateKeyPath,
    archiveFolder,
    archivedFiles
  };
}




function getSafeUpdateInfo(info = {}) {
  return {
    version: info.version || null,
    releaseDate: info.releaseDate || null,
    releaseName: info.releaseName || null
  };
}


function normalizeVersion(value) {
  return String(value || '')
    .trim()
    .replace(/^v/i, '')
    .replace(/[^0-9A-Za-z.+-].*$/, '');
}

function compareVersions(left, right) {
  const leftParts = normalizeVersion(left).split(/[.-]/).filter(Boolean);
  const rightParts = normalizeVersion(right).split(/[.-]/).filter(Boolean);
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || '0';
    const rightPart = rightParts[index] || '0';
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;

    if (leftNumber !== null && rightNumber !== null) {
      if (leftNumber > rightNumber) return 1;
      if (leftNumber < rightNumber) return -1;
      continue;
    }

    const compared = leftPart.localeCompare(rightPart, undefined, { numeric: true, sensitivity: 'base' });
    if (compared > 0) return 1;
    if (compared < 0) return -1;
  }

  return 0;
}

function isNewerVersion(candidateVersion, currentVersion = app.getVersion()) {
  return compareVersions(candidateVersion, currentVersion) > 0;
}

function buildUpdateDownloadUrl(version, filePath) {
  const safeVersion = normalizeVersion(version);
  const safeFilePath = String(filePath || '').trim();

  if (!safeVersion || !safeFilePath || /[/\\]/.test(safeFilePath)) {
    return null;
  }

  return `${UPDATE_DOWNLOAD_BASE_URL}/v${safeVersion}/${encodeURIComponent(safeFilePath)}`;
}

function requestText(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'User-Agent': `Advance Terminal/${app.getVersion()}`
      }
    }, (response) => {
      const statusCode = Number(response.statusCode || 0);
      const location = response.headers.location;

      if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
        response.resume();

        if (redirectCount >= 5) {
          reject(new Error('Too many redirects while checking update manifest.'));
          return;
        }

        const redirectUrl = new URL(location, url).toString();
        requestText(redirectUrl, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Update manifest request failed with HTTP ${statusCode}.`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

    request.setTimeout(UPDATE_HTTP_TIMEOUT_MS, () => {
      request.destroy(new Error('Update manifest request timed out.'));
    });

    request.on('error', reject);
  });
}

function parseUpdateManifest(content) {
  const text = String(content || '');
  const versionMatch = text.match(/^version:\s*['"]?([^'"\r\n]+)['"]?/m);
  const pathMatch = text.match(/^path:\s*['"]?([^'"\r\n]+)['"]?/m)
    || text.match(/^\s*-\s+url:\s*['"]?([^'"\r\n]+)['"]?/m);
  const releaseDateMatch = text.match(/^releaseDate:\s*['"]?([^'"\r\n]+)['"]?/m);

  const version = normalizeVersion(versionMatch?.[1]);
  const filePath = String(pathMatch?.[1] || '').trim();

  if (!version) {
    throw new Error('Update manifest does not contain a valid version.');
  }

  return {
    version,
    filePath,
    downloadUrl: buildUpdateDownloadUrl(version, filePath),
    releaseDate: releaseDateMatch?.[1] || null
  };
}

async function getLatestUpdateManifest() {
  const manifest = parseUpdateManifest(await requestText(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`));
  const currentVersion = app.getVersion();

  return {
    ok: true,
    ...manifest,
    currentVersion,
    isNewer: isNewerVersion(manifest.version, currentVersion)
  };
}

function sendManifestUpdateAvailable(manifest, message) {
  const safeManifest = manifest || pendingManifestUpdate || {};

  return sendUpdateStatus(
    'available',
    message || `Update ${safeManifest.version || ''} is available. Downloading...`.trim(),
    {
      availableVersion: safeManifest.version || null,
      downloaded: false,
      manualDownloadUrl: safeManifest.downloadUrl || null,
      progressPercent: null,
      info: {
        version: safeManifest.version || null,
        releaseDate: safeManifest.releaseDate || null,
        releaseName: null
      }
    }
  );
}

function sendUpdateStatus(status, message, details = {}) {
  updateStatus = {
    ...updateStatus,
    ...details,
    ok: details.ok !== false,
    status,
    message: String(message || ''),
    currentVersion: app.getVersion(),
    updatedAt: new Date().toISOString()
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:status', updateStatus);
  }

  return updateStatus;
}

function getAutoUpdaterAvailability() {
  if (!autoUpdater) {
    return {
      ok: false,
      error: 'electron-updater is not installed. Run npm install before building releases.'
    };
  }

  if (!app.isPackaged) {
    return {
      ok: false,
      error: 'Update checks are available in the installed app only.'
    };
  }

  return { ok: true };
}

function setupAutoUpdater() {
  if (updateHandlersReady || !autoUpdater) {
    return;
  }

  updateHandlersReady = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    updateCheckInFlight = true;
    sendUpdateStatus('checking', 'Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    updateCheckInFlight = false;
    updateDownloadedReady = false;
    sendUpdateStatus(
      'available',
      `Update ${info?.version || ''} is available. Downloading...`.trim(),
      {
        availableVersion: info?.version || null,
        downloaded: false,
        progressPercent: null,
        info: getSafeUpdateInfo(info)
      }
    );
  });

  autoUpdater.on('update-not-available', (info) => {
    updateCheckInFlight = false;
    updateDownloadedReady = false;

    if (pendingManifestUpdate && isNewerVersion(pendingManifestUpdate.version)) {
      sendManifestUpdateAvailable(
        pendingManifestUpdate,
        `Update ${pendingManifestUpdate.version} is available. Auto-download was not started, so use Download Installer.`
      );
      return;
    }

    sendUpdateStatus(
      'current',
      'You are using the latest available version.',
      {
        availableVersion: info?.version || null,
        downloaded: false,
        manualDownloadUrl: null,
        progressPercent: null,
        info: getSafeUpdateInfo(info)
      }
    );
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.max(0, Math.min(100, Number(progress?.percent || 0)));

    sendUpdateStatus(
      'downloading',
      `Downloading update ${percent.toFixed(0)}%...`,
      {
        progressPercent: percent,
        downloaded: false,
        bytesPerSecond: Number(progress?.bytesPerSecond || 0),
        transferred: Number(progress?.transferred || 0),
        total: Number(progress?.total || 0)
      }
    );
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateCheckInFlight = false;
    updateDownloadedReady = true;
    sendUpdateStatus(
      'downloaded',
      `Update ${info?.version || ''} is ready to install.`.trim(),
      {
        availableVersion: info?.version || null,
        downloaded: true,
        progressPercent: 100,
        info: getSafeUpdateInfo(info)
      }
    );
  });

  autoUpdater.on('error', (error) => {
    updateCheckInFlight = false;

    if (pendingManifestUpdate && isNewerVersion(pendingManifestUpdate.version)) {
      sendManifestUpdateAvailable(
        pendingManifestUpdate,
        `Update ${pendingManifestUpdate.version} is available, but auto-download failed. Use Download Installer.`
      );
      return;
    }

    sendUpdateStatus(
      'error',
      `Update check failed: ${error?.message || String(error || 'Unknown error')}`,
      {
        ok: false,
        downloaded: updateDownloadedReady
      }
    );
  });
}

async function checkForUpdates({ manual = false } = {}) {
  const availability = getAutoUpdaterAvailability();

  if (!availability.ok) {
    const status = sendUpdateStatus(
      manual ? 'unavailable' : 'idle',
      availability.error,
      { ok: false }
    );

    return status;
  }

  setupAutoUpdater();

  if (updateCheckInFlight) {
    return sendUpdateStatus('checking', 'An update check is already running.');
  }

  pendingManifestUpdate = null;

  try {
    updateCheckInFlight = true;
    sendUpdateStatus('checking', manual ? 'Manual update check started...' : 'Automatic update check started...');

    let manifest = null;

    try {
      manifest = await getLatestUpdateManifest();
    } catch (manifestError) {
      manifest = {
        ok: false,
        error: manifestError?.message || String(manifestError || 'Could not read update manifest.')
      };
    }

    if (manifest?.ok && !manifest.isNewer) {
      updateCheckInFlight = false;
      updateDownloadedReady = false;
      pendingManifestUpdate = null;

      return sendUpdateStatus(
        'current',
        'You are using the latest available version.',
        {
          availableVersion: manifest.version || null,
          downloaded: false,
          manualDownloadUrl: null,
          progressPercent: null,
          info: {
            version: manifest.version || null,
            releaseDate: manifest.releaseDate || null,
            releaseName: null
          }
        }
      );
    }

    if (manifest?.ok && manifest.isNewer) {
      pendingManifestUpdate = manifest;
      sendManifestUpdateAvailable(manifest, `Update ${manifest.version} is available. Downloading...`);
    }

    await autoUpdater.checkForUpdates();

    if (
      manifest?.ok
      && manifest.isNewer
      && !updateDownloadedReady
      && !['available', 'downloading', 'downloaded'].includes(String(updateStatus.status || ''))
    ) {
      updateCheckInFlight = false;
      return sendManifestUpdateAvailable(
        manifest,
        `Update ${manifest.version} is available. Use Download Installer if auto-download does not start.`
      );
    }

    return updateStatus;
  } catch (error) {
    updateCheckInFlight = false;

    if (pendingManifestUpdate && isNewerVersion(pendingManifestUpdate.version)) {
      return sendManifestUpdateAvailable(
        pendingManifestUpdate,
        `Update ${pendingManifestUpdate.version} is available, but auto-download failed. Use Download Installer.`
      );
    }

    return sendUpdateStatus(
      'error',
      `Update check failed: ${error?.message || String(error || 'Unknown error')}`,
      { ok: false }
    );
  }
}

function installDownloadedUpdate() {
  const availability = getAutoUpdaterAvailability();

  if (!availability.ok) {
    return sendUpdateStatus('unavailable', availability.error, { ok: false });
  }

  if (!updateDownloadedReady) {
    if (updateStatus.manualDownloadUrl) {
      shell.openExternal(updateStatus.manualDownloadUrl).catch(() => {});
      return sendUpdateStatus(
        'available',
        `Opened update installer download for ${updateStatus.availableVersion || 'the latest version'}. Run the installer manually after it downloads.`,
        {
          availableVersion: updateStatus.availableVersion || null,
          downloaded: false,
          manualDownloadUrl: updateStatus.manualDownloadUrl,
          progressPercent: null
        }
      );
    }

    return sendUpdateStatus('idle', 'No downloaded update is ready to install.', { ok: false });
  }

  try {
    terminalManager.closeAll();
  } catch (_) {
    // Ignore terminal cleanup failures while installing an update.
  }

  sendUpdateStatus('installing', 'Installing update and restarting...');
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });

  return updateStatus;
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 420,
    minHeight: 360,
    title: 'Advance Terminal',
    icon: getAppIconPath(),
    frame: true,
    autoHideMenuBar: false,
    backgroundColor: '#f3f3f3',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    terminalManager.closeAll();
    mainWindow = null;
  });
}


function getRuntimeStats() {
  const memory = process.memoryUsage();

  return {
    ok: true,
    status: 'running',
    label: 'Background server running',
    pid: process.pid,
    uptimeSeconds: Math.max(0, Math.floor((Date.now() - appStartedAt) / 1000)),
    memoryRssBytes: memory.rss,
    memoryHeapUsedBytes: memory.heapUsed,
    sessions: terminalManager.sessions ? terminalManager.sessions.size : 0,
    browserWindows: BrowserWindow.getAllWindows().length,
    address: process.env.ADVANCE_TERMINAL_STATUS_ADDRESS || 'local://desktop',
    updatedAt: new Date().toISOString()
  };
}


function valueOrEmpty(value) {
  return typeof value === 'string' ? value : String(value || '');
}


function getStoredSecretsForServer(server, providedSecrets = {}) {
  const secrets = {
    ...(providedSecrets && typeof providedSecrets === 'object' ? providedSecrets : {})
  };

  if (!server || server.type !== 'remote') {
    return secrets;
  }

  if (server.authType === 'key') {
    if (!String(secrets.passphrase || '') && server.savePassphrase) {
      const storedPassphrase = getServerSecret(server.id, 'passphrase');

      if (storedPassphrase) {
        secrets.passphrase = storedPassphrase;
      }
    }
  } else if (!String(secrets.password || '') && server.savePassword) {
    const storedPassword = getServerSecret(server.id, 'password');

    if (storedPassword) {
      secrets.password = storedPassword;
    }
  }

  return secrets;
}

function withStoredSecrets(server, providedSecrets = {}) {
  const secrets = getStoredSecretsForServer(server, providedSecrets);
  const safeServer = { ...server };

  if (safeServer.type === 'remote') {
    if (safeServer.authType === 'key') {
      safeServer.passphrase = String(secrets.passphrase || '');
    } else {
      safeServer.password = String(secrets.password || '');
    }
  }

  return safeServer;
}

function quoteForPosixShell(value) {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function normalizeHealthLine(line) {
  return String(line || '').replace(/\r/g, '').trim();
}

function createHealthResult(server) {
  return {
    ok: false,
    serverId: server?.id || '',
    serverName: server?.name || 'Connection',
    type: server?.type === 'remote' ? 'remote' : 'local',
    status: 'error',
    summary: 'Health check failed.',
    checks: [],
    badges: [],
    projectTypes: [],
    versions: {},
    startFolder: server?.workingDirectory || '',
    checkedAt: new Date().toISOString()
  };
}

function pushHealthCheck(result, label, status, message) {
  result.checks.push({
    label,
    status,
    message: String(message || '')
  });
}

function finalizeHealthResult(result) {
  const statuses = result.checks.map((check) => check.status);
  const hasError = statuses.includes('error');
  const hasWarning = statuses.includes('warning');

  result.ok = !hasError;
  result.status = hasError ? 'error' : (hasWarning ? 'warning' : 'ready');

  if (result.status === 'ready') {
    result.summary = 'Connection is ready.';
  } else if (result.status === 'warning') {
    result.summary = 'Connection works, but review the warnings.';
  } else {
    result.summary = 'Connection needs attention.';
  }

  const badges = [];

  if (result.type === 'remote') {
    badges.push(result.status === 'ready' ? 'SSH Ready' : (result.status === 'warning' ? 'SSH Warning' : 'SSH Issue'));
  } else {
    badges.push(result.status === 'ready' ? 'Local Ready' : (result.status === 'warning' ? 'Local Warning' : 'Local Issue'));
  }

  result.projectTypes.forEach((project) => badges.push(project));

  if (result.versions?.php) {
    badges.push(result.versions.php.replace(/^PHP\s*/i, 'PHP '));
  }

  result.badges = Array.from(new Set(badges)).slice(0, 4);
  return result;
}

function detectLocalProject(server) {
  const result = createHealthResult(server);
  const folder = String(server.workingDirectory || '').trim() || os.homedir();
  const isWslProfile = server?.terminalProfile?.kind === 'wsl';

  if (isWslProfile) {
    if (String(server.workingDirectory || '').trim()) {
      pushHealthCheck(result, 'Start folder', 'warning', `WSL path will be applied when the profile launches: ${server.workingDirectory}`);
    } else {
      pushHealthCheck(result, 'Start folder', 'ready', 'WSL will use its default Linux home/root behavior.');
    }

    pushHealthCheck(result, 'Terminal profile', 'ready', `WSL executable: ${server.terminalProfile.executable || 'wsl.exe'}`);
    pushHealthCheck(result, 'Project detected', 'warning', 'Project markers are checked inside WSL after the terminal opens.');
    return finalizeHealthResult(result);
  }

  if (String(server.workingDirectory || '').trim()) {
    if (fs.existsSync(folder) && fs.statSync(folder).isDirectory()) {
      pushHealthCheck(result, 'Start folder', 'ready', `Found: ${folder}`);
    } else {
      pushHealthCheck(result, 'Start folder', 'error', `Not found: ${folder}`);
      return finalizeHealthResult(result);
    }
  } else {
    pushHealthCheck(result, 'Start folder', 'warning', `Empty. Local terminal will open: ${folder}`);
  }

  const projectTypes = [];

  const exists = (name) => fs.existsSync(path.join(folder, name));

  if (exists('artisan')) {
    projectTypes.push('Laravel');
  }

  if (exists('wp-config.php')) {
    projectTypes.push('WordPress');
  }

  if (exists('package.json')) {
    projectTypes.push('Node');
  }

  if (exists('composer.json')) {
    projectTypes.push('Composer');
  }

  if (exists('.git')) {
    projectTypes.push('Git');
  }

  result.projectTypes = projectTypes;

  if (projectTypes.length) {
    pushHealthCheck(result, 'Project detected', 'ready', projectTypes.join(', '));
  } else {
    pushHealthCheck(result, 'Project detected', 'warning', 'No Laravel, Node, Composer, WordPress, or Git project marker found.');
  }

  pushHealthCheck(result, 'Terminal type', 'ready', 'Local terminal configuration is readable.');
  return finalizeHealthResult(result);
}

function buildRemoteHealthCommand(startFolder) {
  const folder = String(startFolder || '').trim() || '/';

  return [
    `cd ${quoteForPosixShell(folder)} 2>/dev/null && echo "__AT_START_FOLDER_OK__" || echo "__AT_START_FOLDER_MISSING__"`,
    '[ -f artisan ] && echo "PROJECT:Laravel"',
    '[ -f wp-config.php ] && echo "PROJECT:WordPress"',
    '[ -f package.json ] && echo "PROJECT:Node"',
    '[ -f composer.json ] && echo "PROJECT:Composer"',
    '[ -d .git ] && echo "PROJECT:Git"',
    'php -r "echo PHP_VERSION;" 2>/dev/null | sed "s/^/PHP:/"',
    'composer --version 2>/dev/null | head -n 1 | sed "s/^/COMPOSER:/"',
    'node --version 2>/dev/null | head -n 1 | sed "s/^/NODE:/"',
    'npm --version 2>/dev/null | head -n 1 | sed "s/^/NPM:/"',
    'pwd 2>/dev/null | sed "s/^/PWD:/"'
  ].join(' ; ');
}

function parseRemoteHealthOutput(output, server, result) {
  const lines = String(output || '')
    .split(/\n/)
    .map(normalizeHealthLine)
    .filter(Boolean);

  const startFolder = String(server.workingDirectory || '').trim() || '/';

  if (lines.includes('__AT_START_FOLDER_OK__')) {
    pushHealthCheck(result, 'Start folder', 'ready', `Found: ${startFolder}`);
  } else if (lines.includes('__AT_START_FOLDER_MISSING__')) {
    pushHealthCheck(result, 'Start folder', 'error', `Not found: ${startFolder}`);
  } else {
    pushHealthCheck(result, 'Start folder', 'warning', 'Could not confirm start folder.');
  }

  const projectTypes = [];
  const versions = {};

  lines.forEach((line) => {
    if (line.startsWith('PROJECT:')) {
      projectTypes.push(line.replace('PROJECT:', '').trim());
    } else if (line.startsWith('PHP:')) {
      versions.php = `PHP ${line.replace('PHP:', '').trim()}`;
    } else if (line.startsWith('COMPOSER:')) {
      versions.composer = line.replace('COMPOSER:', '').trim();
    } else if (line.startsWith('NODE:')) {
      versions.node = `Node ${line.replace('NODE:', '').trim()}`;
    } else if (line.startsWith('NPM:')) {
      versions.npm = `NPM ${line.replace('NPM:', '').trim()}`;
    } else if (line.startsWith('PWD:')) {
      result.resolvedFolder = line.replace('PWD:', '').trim();
    }
  });

  result.projectTypes = Array.from(new Set(projectTypes));
  result.versions = versions;

  if (result.projectTypes.length) {
    pushHealthCheck(result, 'Project detected', 'ready', result.projectTypes.join(', '));
  } else {
    pushHealthCheck(result, 'Project detected', 'warning', 'No Laravel, Node, Composer, WordPress, or Git project marker found.');
  }

  const toolMessages = [];

  if (versions.php) {
    toolMessages.push(versions.php);
  }

  if (versions.composer) {
    toolMessages.push('Composer found');
  }

  if (versions.node) {
    toolMessages.push(versions.node);
  }

  if (versions.npm) {
    toolMessages.push(versions.npm);
  }

  pushHealthCheck(
    result,
    'Runtime tools',
    toolMessages.length ? 'ready' : 'warning',
    toolMessages.length ? toolMessages.join(', ') : 'No PHP, Composer, Node, or NPM version detected.'
  );
}

function testRemoteConnectionHealth(server) {
  return new Promise((resolve) => {
    const result = createHealthResult(server);
    const conn = new Client();
    let settled = false;
    let output = '';

    const finish = (finalResult) => {
      if (settled) {
        return;
      }

      settled = true;

      try {
        conn.end();
      } catch (_) {
        // Ignore close failures.
      }

      resolve(finalizeHealthResult(finalResult));
    };

    const host = String(server.host || '').trim();
    const username = String(server.username || '').trim();
    const port = Number(server.port || 22);

    if (!host || !username) {
      pushHealthCheck(result, 'SSH configuration', 'error', 'Host/IP and SSH username are required.');
      finish(result);
      return;
    }

    const config = {
      host,
      port,
      username,
      readyTimeout: 15000
    };

    if (server.keepAlive !== false) {
      config.keepaliveInterval = 15000;
      config.keepaliveCountMax = 2;
    }

    const authType = server.authType === 'key' && String(server.privateKeyPath || '').trim() ? 'key' : 'password';

    if (authType === 'key') {
      const privateKeyPath = String(server.privateKeyPath || '').trim();

      if (!privateKeyPath || !fs.existsSync(privateKeyPath)) {
        pushHealthCheck(result, 'SSH private key', 'error', `Private key not found: ${privateKeyPath || 'empty path'}`);
        finish(result);
        return;
      }

      try {
        config.privateKey = fs.readFileSync(privateKeyPath);
        const passphrase = valueOrEmpty(server.passphrase).trim();

        if (passphrase) {
          config.passphrase = passphrase;
        }

        pushHealthCheck(result, 'SSH private key', 'ready', 'Private key file found.');
      } catch (error) {
        pushHealthCheck(result, 'SSH private key', 'error', `Could not read private key: ${error.message}`);
        finish(result);
        return;
      }
    } else {
      const password = valueOrEmpty(server.password);

      if (!password) {
        pushHealthCheck(result, 'SSH password', 'error', 'Saved password is empty. Open terminal normally to enter password, or save a password for health checks.');
        finish(result);
        return;
      }

      config.password = password;
      config.tryKeyboard = true;
      pushHealthCheck(result, 'SSH password', 'ready', 'Saved password is available for this test.');
    }

    const hardTimeout = setTimeout(() => {
      pushHealthCheck(result, 'SSH connection', 'error', 'Health check timed out after 20 seconds.');
      finish(result);
    }, 20000);

    conn.on('ready', () => {
      pushHealthCheck(result, 'SSH connection', 'ready', `Connected to ${username}@${host}:${port}.`);

      conn.exec(buildRemoteHealthCommand(server.workingDirectory), (error, stream) => {
        if (error) {
          clearTimeout(hardTimeout);
          pushHealthCheck(result, 'Project detection', 'warning', `Connected, but could not run checks: ${error.message}`);
          finish(result);
          return;
        }

        stream.on('data', (data) => {
          output += data.toString('utf8');

          if (output.length > 20000) {
            output = output.slice(-20000);
          }
        });

        stream.stderr.on('data', (data) => {
          output += data.toString('utf8');

          if (output.length > 20000) {
            output = output.slice(-20000);
          }
        });

        stream.on('close', () => {
          clearTimeout(hardTimeout);
          parseRemoteHealthOutput(output, server, result);
          finish(result);
        });
      });
    });

    conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, callback) => {
      callback(prompts.map(() => valueOrEmpty(server.password)));
    });

    conn.on('error', (error) => {
      clearTimeout(hardTimeout);
      const message = String(error.message || error);

      if (/passphrase|encrypted private key|cannot parse private/i.test(message)) {
        pushHealthCheck(result, 'SSH private key', 'error', 'Private key may need a saved passphrase for this health check.');
      }

      pushHealthCheck(result, 'SSH connection', 'error', message);
      finish(result);
    });

    try {
      conn.connect(config);
    } catch (error) {
      clearTimeout(hardTimeout);
      pushHealthCheck(result, 'SSH connection', 'error', error.message);
      finish(result);
    }
  });
}

async function testConnectionHealth(serverId) {
  const settings = readSettings();
  const server = (settings.servers || []).find((item) => item.id === serverId);

  if (!server) {
    return {
      ok: false,
      error: 'Connection not found.'
    };
  }

  const effectiveLocalServer = server.type === 'local'
    ? resolveTerminalProfileForServer(settings, server).server
    : server;
  const result = server.type === 'remote'
    ? await testRemoteConnectionHealth(withStoredSecrets(server))
    : detectLocalProject(effectiveLocalServer);

  addAuditLog({
    action: 'connection_health_checked',
    message: `Checked ${server.type === 'remote' ? 'SSH' : 'local'} connection health: ${server.name}`
  });

  return {
    ok: true,
    result
  };
}


function getWindowFromEvent(event) {
  return BrowserWindow.fromWebContents(event.sender);
}


function getWorkspaceWindowState(win) {
  if (!win || win.isDestroyed()) {
    return null;
  }

  const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();

  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.max(420, Math.round(bounds.width)),
    height: Math.max(360, Math.round(bounds.height)),
    isMaximized: win.isMaximized()
  };
}

function applyWorkspaceWindowState(win, value = {}) {
  if (!win || win.isDestroyed()) {
    return { ok: false, error: 'Window not found.' };
  }

  const current = win.getNormalBounds();
  const requested = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const numberOrFallback = (input, fallback) => {
    const numeric = Number(input);
    return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
  };
  const provisional = {
    x: numberOrFallback(requested.x, current.x),
    y: numberOrFallback(requested.y, current.y),
    width: Math.max(420, numberOrFallback(requested.width, current.width)),
    height: Math.max(360, numberOrFallback(requested.height, current.height))
  };

  const display = screen.getDisplayMatching(provisional);
  const workArea = display?.workArea || screen.getPrimaryDisplay().workArea;
  const width = Math.min(Math.max(420, provisional.width), Math.max(420, workArea.width));
  const height = Math.min(Math.max(360, provisional.height), Math.max(360, workArea.height));
  const minX = workArea.x;
  const maxX = workArea.x + Math.max(0, workArea.width - width);
  const minY = workArea.y;
  const maxY = workArea.y + Math.max(0, workArea.height - height);
  const bounds = {
    x: Math.min(maxX, Math.max(minX, provisional.x)),
    y: Math.min(maxY, Math.max(minY, provisional.y)),
    width,
    height
  };

  if (win.isMaximized()) {
    win.unmaximize();
  }

  win.setBounds(bounds, false);

  if (requested.isMaximized === true) {
    win.maximize();
  }

  return {
    ok: true,
    state: getWorkspaceWindowState(win)
  };
}

function runSettingsAutoBackup(reason, options = {}) {
  try {
    return createSettingsAutoBackup(reason, options);
  } catch (_) {
    return {
      ok: false,
      skipped: true,
      reason: 'auto-backup-failed'
    };
  }
}

app.whenReady().then(() => {
  runSettingsAutoBackup('startup');
  createWindow();
  setupAutoUpdater();

  setTimeout(() => {
    checkForUpdates({ manual: false }).catch(() => {});
  }, UPDATE_STARTUP_DELAY_MS);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  runSettingsAutoBackup('shutdown', { force: true });
  terminalManager.closeAll();
});

app.on('window-all-closed', () => {
  runSettingsAutoBackup('window-closed', { force: true });
  terminalManager.closeAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:getInfo', async () => {
  const isElevated = await isWindowsProcessElevated();

  return {
    name: 'Advance Terminal',
    version: app.getVersion(),
    displayVersion: `Advance Terminal V${String(app.getVersion())}`,
    developer: 'Artlie Digital',
    website: 'www.artliedigital.com',
    userDataPath: app.getPath('userData'),
    settingsFilePath: getSettingsFilePath(),
    secretStorage: getSecretStorageStatus(),
    platform: process.platform,
    isElevated,
    canElevate: process.platform === 'win32'
  };
});

ipcMain.handle('app:restartElevated', async () => {
  return restartAsAdministrator();
});


ipcMain.handle('terminalProfiles:detectShells', async () => {
  return {
    ok: true,
    shells: await detectTerminalProfileShells()
  };
});

ipcMain.handle('dialog:selectTerminalExecutable', async (event) => {
  const win = getWindowFromEvent(event);
  const result = await dialog.showOpenDialog(win || undefined, {
    title: 'Select terminal executable',
    properties: ['openFile'],
    filters: process.platform === 'win32'
      ? [{ name: 'Executables', extensions: ['exe', 'cmd', 'bat', 'com'] }, { name: 'All Files', extensions: ['*'] }]
      : [{ name: 'All Files', extensions: ['*'] }]
  });

  if (result.canceled || !result.filePaths?.length) {
    return '';
  }

  return result.filePaths[0];
});

ipcMain.handle('dialog:selectTerminalFolder', async (event) => {
  const win = getWindowFromEvent(event);
  const result = await dialog.showOpenDialog(win || undefined, {
    title: 'Select terminal start folder',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || !result.filePaths?.length) {
    return '';
  }

  return result.filePaths[0];
});


ipcMain.handle('app:getRuntimeStats', async () => {
  return getRuntimeStats();
});

ipcMain.handle('updates:getStatus', async () => {
  return updateStatus;
});

ipcMain.handle('updates:check', async (event, payload = {}) => {
  return checkForUpdates({ manual: payload?.manual !== false });
});

ipcMain.handle('updates:install', async () => {
  return installDownloadedUpdate();
});

ipcMain.handle('window:getWorkspaceState', async (event) => {
  const win = getWindowFromEvent(event);

  if (!win) {
    return { ok: false, error: 'Window not found.' };
  }

  return {
    ok: true,
    state: getWorkspaceWindowState(win)
  };
});

ipcMain.handle('window:applyWorkspaceState', async (event, payload) => {
  const win = getWindowFromEvent(event);
  return applyWorkspaceWindowState(win, payload || {});
});


ipcMain.handle('window:action', async (event, action) => {
  const win = getWindowFromEvent(event);

  if (!win) {
    return { ok: false, error: 'Window not found.' };
  }

  if (action === 'minimize') {
    win.minimize();
    return { ok: true };
  }

  if (action === 'maximize') {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return { ok: true };
  }

  if (action === 'close') {
    win.close();
    return { ok: true };
  }

  return { ok: false, error: 'Unknown window action.' };
});


function sanitizeSettingsForExport(settings) {
  const source = settings && typeof settings === 'object'
    ? settings
    : readSettings();

  const safeSettings = JSON.parse(JSON.stringify(source));

  delete safeSettings.reportUsage;
  delete safeSettings.reportHistory;

  if (Array.isArray(safeSettings.terminalProfiles)) {
    safeSettings.terminalProfiles = safeSettings.terminalProfiles.map((profile) => {
      const safeProfile = { ...profile };
      const environment = safeProfile.environment && typeof safeProfile.environment === 'object'
        ? { ...safeProfile.environment }
        : {};

      Object.keys(environment).forEach((key) => {
        if (/(password|passwd|token|secret|api[_-]?key|private[_-]?key|credential|auth)/i.test(key)) {
          environment[key] = '';
        }
      });

      safeProfile.environment = environment;
      return safeProfile;
    });
  }

  if (Array.isArray(safeSettings.servers)) {
    safeSettings.servers = safeSettings.servers.map((server) => {
      const safeServer = { ...server };

      if (Object.prototype.hasOwnProperty.call(safeServer, 'password')) {
        safeServer.password = '';
      }

      if (Object.prototype.hasOwnProperty.call(safeServer, 'passphrase')) {
        safeServer.passphrase = '';
      }

      safeServer.savePassword = false;
      safeServer.savePassphrase = false;

      return safeServer;
    });
  }

  return {
    exportedAt: new Date().toISOString(),
    appName: 'Advance Terminal',
    appVersion: app.getVersion(),
    exportType: 'safe-settings-backup',
    note: 'This backup excludes saved passwords, saved key passphrases, and SSH private key contents.',
    settings: safeSettings
  };
}

function buildSettingsExportFileName() {
  const stamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);

  return `advance-terminal-settings-backup-${stamp}.json`;
}

function unwrapSettingsImportPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  if (payload.settings && typeof payload.settings === 'object') {
    return payload.settings;
  }

  return payload;
}

function cleanImportedServer(server) {
  const source = server && typeof server === 'object' ? server : {};
  const safeServer = { ...source };

  safeServer.password = '';
  safeServer.passphrase = '';
  safeServer.savePassword = false;
  safeServer.savePassphrase = false;

  return safeServer;
}

function sanitizeSettingsForImport(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const safeSettings = {};

  if (Array.isArray(source.servers)) {
    safeSettings.servers = source.servers.map(cleanImportedServer);
  }

  if (Array.isArray(source.commands)) {
    safeSettings.commands = source.commands;
  }

  if (Array.isArray(source.terminalActions)) {
    safeSettings.terminalActions = source.terminalActions;
  }

  if (Array.isArray(source.terminalProfiles)) {
    safeSettings.terminalProfiles = source.terminalProfiles;
  }

  if (source.defaultTerminalProfileId) {
    safeSettings.defaultTerminalProfileId = String(source.defaultTerminalProfileId);
  }

  if (Array.isArray(source.workspaces)) {
    safeSettings.workspaces = source.workspaces;
  }

  if (Object.prototype.hasOwnProperty.call(source, 'startupWorkspaceId')) {
    safeSettings.startupWorkspaceId = String(source.startupWorkspaceId || '');
  }

  if (source.ui && typeof source.ui === 'object') {
    safeSettings.ui = source.ui;
  }

  if (source.selectedServerId) {
    safeSettings.selectedServerId = String(source.selectedServerId);
  }

  return safeSettings;
}

function buildSettingsImportPreview(payload, sanitizedSettings, filePath) {
  const servers = Array.isArray(sanitizedSettings.servers) ? sanitizedSettings.servers : [];
  const commands = Array.isArray(sanitizedSettings.commands) ? sanitizedSettings.commands : [];
  const terminalActions = Array.isArray(sanitizedSettings.terminalActions) ? sanitizedSettings.terminalActions : [];
  const terminalProfiles = Array.isArray(sanitizedSettings.terminalProfiles) ? sanitizedSettings.terminalProfiles : [];
  const workspaces = Array.isArray(sanitizedSettings.workspaces) ? sanitizedSettings.workspaces : [];
  const sshConnections = servers.filter((server) => server && server.type === 'remote').length;
  const localConnections = servers.filter((server) => server && server.type !== 'remote').length;
  const ui = sanitizedSettings.ui && typeof sanitizedSettings.ui === 'object' ? sanitizedSettings.ui : {};

  return {
    filePath,
    appVersion: String(payload?.appVersion || 'Unknown'),
    exportedAt: String(payload?.exportedAt || 'Unknown'),
    exportType: String(payload?.exportType || 'settings-json'),
    connections: servers.length,
    sshConnections,
    localConnections,
    commands: commands.length,
    terminalActions: terminalActions.length,
    terminalProfiles: terminalProfiles.length,
    workspaces: workspaces.length,
    hasAppearance: Boolean(ui.theme),
    hasNotification: Boolean(ui.notificationPosition),
    warnings: [
      'Saved passwords and SSH key passphrases will not be imported.',
      'SSH private key file contents are never imported.',
      'Daily report usage history, report history, and audit logs will not be imported.'
    ]
  };
}

function mergeImportedSettings(currentSettings, importedSettings) {
  const merged = {
    ...currentSettings,
    ...importedSettings,
    auditLog: Array.isArray(currentSettings.auditLog) ? currentSettings.auditLog : [],
    reportUsage: currentSettings.reportUsage,
    reportHistory: currentSettings.reportHistory
  };

  if (!Array.isArray(importedSettings.servers)) {
    delete merged.servers;
  }

  if (!Array.isArray(importedSettings.commands)) {
    delete merged.commands;
  }

  if (!Array.isArray(importedSettings.terminalActions)) {
    delete merged.terminalActions;
  }

  if (!importedSettings.ui || typeof importedSettings.ui !== 'object') {
    delete merged.ui;
  }

  return merged;
}



function getSettingsRepairTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('') + '-' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function getSettingsRepairDirectory() {
  return path.dirname(getSettingsFilePath());
}

function isSettingsRepairFileName(fileName) {
  return /^settings\.json\.(?:broken-\d+|backup(?:-[A-Za-z0-9_-]+)*|repair-backup-\d{8}-\d{6}|restore-backup-\d{8}-\d{6})$/.test(String(fileName || ''));
}

function getSettingsRestoreSourceLabel(fileName) {
  const name = String(fileName || '');

  if (/^settings\.json\.backup-auto-/.test(name)) {
    return 'Auto backup';
  }

  if (/^settings\.json\.repair-backup-/.test(name)) {
    return 'Before repair backup';
  }

  if (/^settings\.json\.restore-backup-/.test(name)) {
    return 'Before restore backup';
  }

  if (/^settings\.json\.broken-/.test(name)) {
    return 'Valid recovered backup';
  }

  return 'Manual backup';
}

function isUsableRepairServer(server) {
  if (!server || typeof server !== 'object') {
    return false;
  }

  const type = server.type === 'remote' ? 'remote' : 'local';

  if (type === 'remote') {
    return Boolean(String(server.host || '').trim() && String(server.username || '').trim());
  }

  return Boolean(String(server.name || server.description || server.shell || server.id || '').trim());
}

function getSettingsRepairFiles() {
  const directory = getSettingsRepairDirectory();

  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory)
    .filter(isSettingsRepairFileName)
    .map((fileName) => path.join(directory, fileName));
}

function resolveSettingsRestoreFile(fileName) {
  const safeFileName = path.basename(String(fileName || ''));

  if (!safeFileName || safeFileName !== String(fileName || '') || !isSettingsRepairFileName(safeFileName)) {
    return null;
  }

  const directory = getSettingsRepairDirectory();
  const resolvedPath = path.resolve(directory, safeFileName);
  const resolvedDirectory = path.resolve(directory);

  if (!resolvedPath.startsWith(`${resolvedDirectory}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

function scrubInlineRepairSecrets(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const safeSettings = {};

  if (Array.isArray(source.servers)) {
    safeSettings.servers = source.servers
      .filter(isUsableRepairServer)
      .map((server) => {
        const safeServer = {
          ...(server && typeof server === 'object' ? server : {})
        };

        safeServer.password = '';
        safeServer.passphrase = '';
        safeServer.savePassword = Boolean(safeServer.savePassword);
        safeServer.savePassphrase = Boolean(safeServer.savePassphrase);

        return safeServer;
      });
  }

  if (Array.isArray(source.commands)) {
    safeSettings.commands = source.commands;
  }

  if (Array.isArray(source.terminalActions)) {
    safeSettings.terminalActions = source.terminalActions;
  }

  if (Array.isArray(source.terminalProfiles)) {
    safeSettings.terminalProfiles = source.terminalProfiles;
  }

  if (source.defaultTerminalProfileId) {
    safeSettings.defaultTerminalProfileId = String(source.defaultTerminalProfileId);
  }

  if (Array.isArray(source.workspaces)) {
    safeSettings.workspaces = source.workspaces;
  }

  if (Object.prototype.hasOwnProperty.call(source, 'startupWorkspaceId')) {
    safeSettings.startupWorkspaceId = String(source.startupWorkspaceId || '');
  }

  if (source.ui && typeof source.ui === 'object') {
    safeSettings.ui = source.ui;
  }

  if (source.reportOptions && typeof source.reportOptions === 'object') {
    safeSettings.reportOptions = source.reportOptions;
  }

  if (source.selectedServerId) {
    safeSettings.selectedServerId = String(source.selectedServerId);
  }

  return safeSettings;
}

function summarizeSettingsRepairCandidate(filePath) {
  const stats = fs.statSync(filePath);

  if (!stats.isFile() || stats.size <= 0 || stats.size > 10 * 1024 * 1024) {
    return null;
  }

  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const source = unwrapSettingsImportPayload(payload);

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }

  const safeSettings = scrubInlineRepairSecrets(source);
  const servers = Array.isArray(safeSettings.servers) ? safeSettings.servers : [];

  if (!servers.length) {
    return null;
  }

  const remoteConnections = servers.filter((server) => server && server.type === 'remote').length;
  const localConnections = servers.filter((server) => server && server.type !== 'remote').length;
  const serverNames = servers
    .slice(0, 10)
    .map((server) => String(server?.name || server?.host || 'Connection'))
    .filter(Boolean);

  const commands = Array.isArray(safeSettings.commands) ? safeSettings.commands : [];
  const terminalActions = Array.isArray(safeSettings.terminalActions) ? safeSettings.terminalActions : [];
  const fileName = path.basename(filePath);

  return {
    filePath,
    fileName,
    sourceLabel: getSettingsRestoreSourceLabel(fileName),
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    serverCount: servers.length,
    remoteConnections,
    localConnections,
    commandCount: commands.length,
    terminalActionCount: terminalActions.length,
    serverNames,
    settings: safeSettings
  };
}

function getPublicSettingsRepairCandidate(candidate) {
  if (!candidate) {
    return null;
  }

  return {
    fileName: candidate.fileName,
    filePath: candidate.filePath,
    sourceLabel: candidate.sourceLabel,
    size: candidate.size,
    modifiedAt: candidate.modifiedAt,
    serverCount: candidate.serverCount,
    remoteConnections: candidate.remoteConnections,
    localConnections: candidate.localConnections,
    commandCount: candidate.commandCount,
    terminalActionCount: candidate.terminalActionCount,
    serverNames: candidate.serverNames
  };
}

function scanSettingsRestorePoints() {
  const scannedFiles = getSettingsRepairFiles();
  const candidates = [];
  const invalidFiles = [];

  scannedFiles.forEach((filePath) => {
    try {
      const candidate = summarizeSettingsRepairCandidate(filePath);

      if (candidate) {
        candidates.push(candidate);
      } else {
        invalidFiles.push(path.basename(filePath));
      }
    } catch (_) {
      invalidFiles.push(path.basename(filePath));
    }
  });

  return {
    scannedCount: scannedFiles.length,
    invalidCount: invalidFiles.length,
    invalidFiles,
    candidates
  };
}

function findSettingsRepairCandidates() {
  return scanSettingsRestorePoints().candidates.sort((left, right) => (
    right.serverCount - left.serverCount
    || new Date(right.modifiedAt).getTime() - new Date(left.modifiedAt).getTime()
    || right.size - left.size
  ));
}

function getCurrentSettingsSummary() {
  const currentSettings = readSettings();
  const currentServers = Array.isArray(currentSettings.servers) ? currentSettings.servers : [];

  return {
    filePath: getSettingsFilePath(),
    serverCount: currentServers.length,
    serverNames: currentServers
      .slice(0, 10)
      .map((server) => String(server?.name || server?.host || 'Connection'))
      .filter(Boolean)
  };
}

function getSettingsRestorePoints() {
  const scan = scanSettingsRestorePoints();
  const restorePoints = scan.candidates
    .sort((left, right) => (
      new Date(right.modifiedAt).getTime() - new Date(left.modifiedAt).getTime()
      || right.serverCount - left.serverCount
      || right.size - left.size
    ))
    .map(getPublicSettingsRepairCandidate);

  return {
    ok: true,
    current: getCurrentSettingsSummary(),
    restorePoints,
    scannedCount: scan.scannedCount,
    invalidCount: scan.invalidCount
  };
}

function getSettingsRepairPreview() {
  const current = getCurrentSettingsSummary();
  const candidates = findSettingsRepairCandidates();
  const best = candidates[0] || null;

  if (!best) {
    pendingSettingsRepair = null;
    return {
      ok: false,
      noRepairFound: true,
      error: 'No valid unbroken local settings backup was found.',
      current,
      candidates: []
    };
  }

  if (best.serverCount <= current.serverCount) {
    pendingSettingsRepair = null;
    return {
      ok: false,
      noRepairNeeded: true,
      error: `No better repair backup was found. Current settings already have ${current.serverCount} connection(s).`,
      current,
      candidate: getPublicSettingsRepairCandidate(best),
      candidates: candidates.map(getPublicSettingsRepairCandidate)
    };
  }

  pendingSettingsRepair = best;

  return {
    ok: true,
    current,
    candidate: getPublicSettingsRepairCandidate(best),
    candidates: candidates.map(getPublicSettingsRepairCandidate)
  };
}

function applySettingsRepair() {
  if (!pendingSettingsRepair || !pendingSettingsRepair.settings) {
    return {
      ok: false,
      error: 'No settings repair is waiting for confirmation.'
    };
  }

  const repair = pendingSettingsRepair;
  pendingSettingsRepair = null;

  const settingsPath = getSettingsFilePath();
  const backupPath = `${settingsPath}.repair-backup-${getSettingsRepairTimestamp()}`;

  try {
    if (fs.existsSync(settingsPath)) {
      fs.copyFileSync(settingsPath, backupPath);
    }

    const currentSettings = readSettings();
    const repairedSettings = mergeImportedSettings(currentSettings, repair.settings);

    saveSettings(repairedSettings);

    addAuditLog({
      action: 'settings_repaired',
      message: `Repaired settings from ${repair.fileName}; previous settings backed up to ${backupPath}`
    });

    return {
      ok: true,
      backupPath,
      sourcePath: repair.filePath,
      sourceFileName: repair.fileName,
      restoredServerCount: repair.serverCount,
      settings: readSettings()
    };
  } catch (error) {
    return {
      ok: false,
      error: `Could not repair settings: ${error.message}`
    };
  }
}

function applySettingsRestorePoint(payload = {}) {
  const fileName = String(payload?.fileName || '').trim();
  const filePath = resolveSettingsRestoreFile(fileName);

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      ok: false,
      error: 'Restore point was not found or is not allowed.'
    };
  }

  const settingsPath = getSettingsFilePath();
  const backupPath = `${settingsPath}.restore-backup-${getSettingsRepairTimestamp()}`;

  try {
    const candidate = summarizeSettingsRepairCandidate(filePath);

    if (!candidate || !candidate.settings || !Array.isArray(candidate.settings.servers) || !candidate.settings.servers.length) {
      return {
        ok: false,
        error: 'Restore point is not a valid unbroken settings backup.'
      };
    }

    if (fs.existsSync(settingsPath)) {
      fs.copyFileSync(settingsPath, backupPath);
    }

    const currentSettings = readSettings();
    const restoredSettings = mergeImportedSettings(currentSettings, candidate.settings);

    saveSettings(restoredSettings);

    addAuditLog({
      action: 'settings_restored',
      message: `Restored settings from ${candidate.fileName}; previous settings backed up to ${backupPath}`
    });

    return {
      ok: true,
      backupPath,
      sourcePath: candidate.filePath,
      sourceFileName: candidate.fileName,
      restoredServerCount: candidate.serverCount,
      settings: readSettings()
    };
  } catch (error) {
    return {
      ok: false,
      error: `Could not restore settings: ${error.message}`
    };
  }
}


const AI_REPORT_MAX_CONTEXT_CHARS = 42000;
const AI_REPORT_MAX_DIFF_CHARS = 18000;
const AI_REPORT_MAX_RECENT_COMMANDS = 80;

function normalizeAiModel(value) {
  return String(value || 'gpt-5.5')
    .trim()
    .replace(/\s+/g, '')
    .slice(0, 80) || 'gpt-5.5';
}

function getAiSettings() {
  const settings = readSettings();
  const ai = settings.ai && typeof settings.ai === 'object' ? settings.ai : {};

  return {
    enabled: ai.enabled === true,
    provider: 'openai',
    model: normalizeAiModel(ai.model),
    includeGitDiff: ai.includeGitDiff === true,
    includeRecentCommands: ai.includeRecentCommands !== false
  };
}

function getAiStatus() {
  return {
    ok: true,
    ...getAiSettings(),
    hasApiKey: hasAppSecret('openaiApiKey'),
    secretStorage: getSecretStorageStatus()
  };
}

function clipText(value, maxLength) {
  const text = String(value || '');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n… clipped to keep the AI report request small`;
}

function redactAiReportSecrets(value) {
  return String(value || '')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, 'sk-***redacted***')
    .replace(/(api[_-]?key|token|secret|password|passphrase)\s*[:=]\s*['"]?[^'"\s]+/gi, '$1=***redacted***')
    .replace(/(Authorization:\s*Bearer\s+)[A-Za-z0-9._-]+/gi, '$1***redacted***')
    .replace(/(DB_PASSWORD\s*=\s*)[^\r\n]+/gi, '$1***redacted***')
    .replace(/(MAIL_PASSWORD\s*=\s*)[^\r\n]+/gi, '$1***redacted***')
    .replace(/(AWS_SECRET_ACCESS_KEY\s*=\s*)[^\r\n]+/gi, '$1***redacted***');
}

function safeStatSummary(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return {
      ok: true,
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString()
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

function getExistingDirectory(candidate) {
  const value = String(candidate || '').trim();

  if (!value) {
    return '';
  }

  try {
    const resolved = path.resolve(value);
    const stat = fs.statSync(resolved);

    if (stat.isDirectory()) {
      return resolved;
    }

    if (stat.isFile()) {
      return path.dirname(resolved);
    }
  } catch (_) {
    return '';
  }

  return '';
}

function directoryHasProjectMarker(directory) {
  const markers = ['artisan', 'composer.json', 'package.json', '.git'];

  return markers.some((markerName) => {
    try {
      return fs.existsSync(path.join(directory, markerName));
    } catch (_) {
      return false;
    }
  });
}

function findNearestProjectRoot(startDirectory) {
  let current = getExistingDirectory(startDirectory);

  if (!current) {
    return '';
  }

  for (let i = 0; i < 10; i += 1) {
    if (directoryHasProjectMarker(current)) {
      return current;
    }

    const parent = path.dirname(current);

    if (!parent || parent === current) {
      break;
    }

    current = parent;
  }

  return getExistingDirectory(startDirectory);
}

function readJsonFileSafe(filePath, maxChars = 18000) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stat = fs.statSync(filePath);

    if (!stat.isFile() || stat.size <= 0 || stat.size > 1024 * 1024) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8').slice(0, maxChars));
  } catch (_) {
    return null;
  }
}

function detectProjectType(projectRoot) {
  const result = {
    type: 'Unknown',
    framework: '',
    packageName: '',
    hasGit: fs.existsSync(path.join(projectRoot, '.git')),
    markers: []
  };

  if (fs.existsSync(path.join(projectRoot, 'artisan'))) {
    result.type = 'Laravel/PHP';
    result.framework = 'Laravel';
    result.markers.push('artisan');
  }

  const composer = readJsonFileSafe(path.join(projectRoot, 'composer.json'));
  if (composer) {
    result.markers.push('composer.json');
    result.packageName = result.packageName || String(composer.name || '');
    const requires = {
      ...(composer.require || {}),
      ...(composer['require-dev'] || {})
    };

    if (requires['laravel/framework']) {
      result.type = 'Laravel/PHP';
      result.framework = `Laravel framework ${requires['laravel/framework']}`;
    }
  }

  const pkg = readJsonFileSafe(path.join(projectRoot, 'package.json'));
  if (pkg) {
    result.markers.push('package.json');
    result.packageName = result.packageName || String(pkg.name || '');
  }

  if (result.hasGit) {
    result.markers.push('.git');
  }

  return result;
}

function shouldSkipProjectEntry(entryName) {
  return new Set([
    '.git',
    'node_modules',
    'vendor',
    'storage',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.cache'
  ]).has(String(entryName || ''));
}

function collectProjectTree(projectRoot) {
  const files = [];
  const recent = [];
  const maxFiles = 450;
  const roots = [
    'app',
    'bootstrap',
    'config',
    'database',
    'public',
    'resources',
    'routes',
    'src',
    'scripts',
    'tests'
  ];

  ['artisan', 'composer.json', 'composer.lock', 'package.json', 'vite.config.js', 'webpack.mix.js', 'tailwind.config.js'].forEach((name) => {
    const fullPath = path.join(projectRoot, name);
    const stat = safeStatSummary(fullPath);

    if (stat.ok && stat.isFile) {
      files.push(name);
      recent.push({ path: name, modifiedAt: stat.modifiedAt, size: stat.size });
    }
  });

  function walk(directory, relative, depth) {
    if (files.length >= maxFiles || depth > 5) {
      return;
    }

    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (_) {
      return;
    }

    entries
      .filter((entry) => !shouldSkipProjectEntry(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((entry) => {
        if (files.length >= maxFiles) {
          return;
        }

        const rel = relative ? path.join(relative, entry.name) : entry.name;
        const full = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          walk(full, rel, depth + 1);
          return;
        }

        if (!entry.isFile()) {
          return;
        }

        if (!/\.(php|blade\.php|js|jsx|ts|tsx|vue|css|scss|json|md|yml|yaml|env\.example)$/i.test(entry.name)) {
          return;
        }

        const stat = safeStatSummary(full);
        files.push(rel);

        if (stat.ok) {
          recent.push({ path: rel, modifiedAt: stat.modifiedAt, size: stat.size });
        }
      });
  }

  roots.forEach((rootName) => {
    const full = path.join(projectRoot, rootName);
    const stat = safeStatSummary(full);

    if (stat.ok && stat.isDirectory) {
      walk(full, rootName, 0);
    }
  });

  recent.sort((left, right) => new Date(right.modifiedAt).getTime() - new Date(left.modifiedAt).getTime());

  return {
    files: files.slice(0, maxFiles),
    recentFiles: recent.slice(0, 80)
  };
}

async function runProjectCommand(command, args, cwd, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      windowsHide: true,
      timeout: options.timeout || 7000,
      maxBuffer: options.maxBuffer || 1024 * 1024
    });

    return {
      ok: true,
      text: redactAiReportSecrets(`${stdout || ''}${stderr ? `\n${stderr}` : ''}`.trim())
    };
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr ? `\n${error.stderr}` : ''}`.trim();

    return {
      ok: false,
      error: error.message,
      text: redactAiReportSecrets(output)
    };
  }
}

async function collectGitSnapshot(projectRoot, includeDiff) {
  if (!fs.existsSync(path.join(projectRoot, '.git'))) {
    return {
      available: false,
      note: 'No .git folder detected.'
    };
  }

  const [branch, status, diffStat, changedNames] = await Promise.all([
    runProjectCommand('git', ['branch', '--show-current'], projectRoot, { timeout: 4000 }),
    runProjectCommand('git', ['status', '--short'], projectRoot),
    runProjectCommand('git', ['diff', '--stat'], projectRoot),
    runProjectCommand('git', ['diff', '--name-status'], projectRoot)
  ]);

  let diff = {
    ok: false,
    text: ''
  };

  if (includeDiff) {
    diff = await runProjectCommand('git', ['diff', '--', ':!vendor', ':!node_modules', ':!storage'], projectRoot, {
      timeout: 9000,
      maxBuffer: 2 * 1024 * 1024
    });
    diff.text = clipText(diff.text, AI_REPORT_MAX_DIFF_CHARS);
  }

  return {
    available: true,
    branch: branch.ok ? branch.text : '',
    status: status.text || '',
    diffStat: diffStat.text || '',
    changedNames: changedNames.text || '',
    diffIncluded: includeDiff === true,
    diff: diff.text || ''
  };
}

function normalizeRecentCommands(commands) {
  return (Array.isArray(commands) ? commands : [])
    .map((item) => {
      if (typeof item === 'string') {
        return {
          time: '',
          source: 'terminal',
          command: redactAiReportSecrets(item)
        };
      }

      return {
        time: String(item?.time || ''),
        source: String(item?.source || 'terminal').slice(0, 40),
        command: redactAiReportSecrets(String(item?.command || '')).slice(0, 1000)
      };
    })
    .filter((item) => item.command.trim())
    .slice(-AI_REPORT_MAX_RECENT_COMMANDS);
}

async function buildAiProjectContext(payload = {}, aiSettings = getAiSettings()) {
  const workingDirectory = String(payload?.workingDirectory || payload?.currentLocation || '').trim();
  const terminalName = String(payload?.terminalName || 'Active Terminal').slice(0, 120);
  const localStartDirectory = getExistingDirectory(workingDirectory);
  const projectRoot = localStartDirectory ? findNearestProjectRoot(localStartDirectory) : '';
  const baseReport = clipText(redactAiReportSecrets(payload?.baseReport || ''), 12000);
  const recentCommands = aiSettings.includeRecentCommands
    ? normalizeRecentCommands(payload?.recentCommands)
    : [];
  const context = {
    generatedAt: new Date().toISOString(),
    terminalName,
    activeLocation: workingDirectory,
    localProjectReadable: Boolean(projectRoot),
    projectRoot: projectRoot || '',
    project: null,
    tree: null,
    git: null,
    baseActivityReport: baseReport,
    recentCommands
  };

  if (!projectRoot) {
    context.project = {
      type: 'Unavailable',
      note: 'The active location is not readable from this Windows app. This is normal for SSH paths; the AI report can only use terminal activity provided by the renderer.'
    };

    return context;
  }

  context.project = detectProjectType(projectRoot);
  context.tree = collectProjectTree(projectRoot);
  context.git = await collectGitSnapshot(projectRoot, aiSettings.includeGitDiff);

  return context;
}

function buildAiReportPrompt(context) {
  return [
    'You are the AI report writer inside Advance Terminal.',
    'Use only the provided evidence. Do not invent file changes, UI fixes, or functions.',
    'If evidence is weak, say what is uncertain.',
    'Write a concise developer report in Markdown.',
    'Goal: explain what the user appears to be working on, such as fixing a button, menu, Blade view, controller, function, route, CSS, JavaScript, or settings behavior.',
    'Never include secrets, tokens, passwords, private keys, or raw API keys.',
    '',
    'Required sections:',
    '# AI Project Work Report',
    '## What you appear to be working on',
    '## UI / feature area',
    '## Files or modules touched',
    '## Changes detected',
    '## Possible next checks',
    '## Evidence and confidence',
    '',
    'Use short bullets. Mention exact files only if they appear in the provided status/tree/diff/commands.'
  ].join('\n');
}

function extractOpenAiText(responseBody) {
  if (!responseBody || typeof responseBody !== 'object') {
    return '';
  }

  if (typeof responseBody.output_text === 'string' && responseBody.output_text.trim()) {
    return responseBody.output_text.trim();
  }

  const parts = [];

  (responseBody.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (typeof content.text === 'string') {
        parts.push(content.text);
      }

      if (typeof content.output_text === 'string') {
        parts.push(content.output_text);
      }
    });
  });

  return parts.join('\n').trim();
}

async function callOpenAiForProjectReport(context, aiSettings) {
  const apiKey = getAppSecret('openaiApiKey');

  if (!apiKey) {
    throw new Error('OpenAI API key is missing. Add it in Settings → AI.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: normalizeAiModel(aiSettings.model),
        input: `${buildAiReportPrompt(context)}\n\nProject evidence JSON:\n${clipText(JSON.stringify(context, null, 2), AI_REPORT_MAX_CONTEXT_CHARS)}`,
        max_output_tokens: 1800
      })
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const errorMessage = data?.error?.message || text || `OpenAI request failed with HTTP ${response.status}.`;
      throw new Error(errorMessage);
    }

    const output = extractOpenAiText(data);

    if (!output) {
      throw new Error('OpenAI returned an empty report.');
    }

    return output;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateAiProjectReport(payload = {}) {
  const aiSettings = getAiSettings();

  if (!aiSettings.enabled) {
    return {
      ok: false,
      error: 'AI reports are disabled. Enable them in Settings → AI.'
    };
  }

  if (!hasAppSecret('openaiApiKey')) {
    return {
      ok: false,
      error: 'OpenAI API key is missing. Add it in Settings → AI.'
    };
  }

  const context = await buildAiProjectContext(payload, aiSettings);
  const text = await callOpenAiForProjectReport(context, aiSettings);

  addAuditLog({
    action: 'ai_report_generated',
    message: `Generated OpenAI project report for ${context.projectRoot || context.activeLocation || context.terminalName}.`
  });

  return {
    ok: true,
    text,
    model: aiSettings.model,
    generatedAt: new Date().toISOString(),
    projectRoot: context.projectRoot,
    localProjectReadable: context.localProjectReadable,
    gitAvailable: Boolean(context.git?.available),
    diffIncluded: Boolean(context.git?.diffIncluded)
  };
}






ipcMain.handle('settings:read', async () => {
  return readSettings();
});

ipcMain.handle('settings:save', async (event, settings) => {
  saveSettings(settings);
  addAuditLog({
    action: 'settings_saved',
    message: 'Settings saved from Settings screen.'
  });
  return readSettings();
});

ipcMain.handle('usage:save', async (event, reportUsage) => {
  const settings = readSettings();
  settings.reportUsage = reportUsage && typeof reportUsage === 'object' ? reportUsage : settings.reportUsage;
  saveSettings(settings);
  return readSettings().reportUsage;
});


ipcMain.handle('ai:getStatus', async () => getAiStatus());

ipcMain.handle('ai:saveApiKey', async (event, payload = {}) => {
  const apiKey = String(payload?.apiKey || '').trim();

  if (!apiKey) {
    return {
      ok: false,
      error: 'API key is empty.'
    };
  }

  if (apiKey.length < 20) {
    return {
      ok: false,
      error: 'API key looks too short.'
    };
  }

  const result = saveAppSecret('openaiApiKey', apiKey);

  if (!result.ok) {
    return result;
  }

  addAuditLog({
    action: 'openai_api_key_saved',
    message: 'OpenAI API key was saved to secure local storage.'
  });

  return getAiStatus();
});

ipcMain.handle('ai:clearApiKey', async () => {
  deleteAppSecret('openaiApiKey');

  addAuditLog({
    action: 'openai_api_key_cleared',
    message: 'OpenAI API key was removed from secure local storage.'
  });

  return getAiStatus();
});

ipcMain.handle('report:generateAiProject', async (event, payload = {}) => {
  try {
    return await generateAiProjectReport(payload);
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
});

ipcMain.handle('settings:export', async (event, settings) => {
  const win = getWindowFromEvent(event);
  const desktopPath = app.getPath('desktop');
  const defaultPath = path.join(desktopPath, buildSettingsExportFileName());

  const result = await dialog.showSaveDialog(win, {
    title: 'Export Advance Terminal Settings',
    defaultPath,
    filters: [
      { name: 'Advance Terminal Settings Backup', extensions: ['json'] },
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  try {
    const exportData = sanitizeSettingsForExport(settings);
    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf8');

    addAuditLog({
      action: 'settings_exported',
      message: `Exported settings backup to ${result.filePath}`
    });

    return {
      ok: true,
      filePath: result.filePath
    };
  } catch (error) {
    return {
      ok: false,
      error: `Could not export settings: ${error.message}`
    };
  }
});



ipcMain.handle('settings:importPreview', async (event) => {
  const win = getWindowFromEvent(event);

  const result = await dialog.showOpenDialog(win, {
    title: 'Import Advance Terminal Settings',
    properties: ['openFile'],
    filters: [
      { name: 'Advance Terminal Settings Backup', extensions: ['json'] },
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    pendingSettingsImport = null;
    return { ok: false, canceled: true };
  }

  const filePath = result.filePaths[0];

  try {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const importedSettings = sanitizeSettingsForImport(unwrapSettingsImportPayload(payload));

    if (!importedSettings.servers && !importedSettings.commands && !importedSettings.terminalActions && !importedSettings.terminalProfiles && !importedSettings.workspaces && !importedSettings.ui) {
      pendingSettingsImport = null;
      return {
        ok: false,
        error: 'The selected JSON file does not look like an Advance Terminal settings backup.'
      };
    }

    const preview = buildSettingsImportPreview(payload, importedSettings, filePath);
    pendingSettingsImport = {
      filePath,
      settings: importedSettings,
      preview
    };

    return {
      ok: true,
      preview
    };
  } catch (error) {
    pendingSettingsImport = null;
    return {
      ok: false,
      error: `Could not read settings backup: ${error.message}`
    };
  }
});

ipcMain.handle('settings:importApply', async () => {
  if (!pendingSettingsImport || !pendingSettingsImport.settings) {
    return {
      ok: false,
      error: 'No settings import is waiting for confirmation.'
    };
  }

  try {
    const currentSettings = readSettings();
    const mergedSettings = mergeImportedSettings(currentSettings, pendingSettingsImport.settings);
    saveSettings(mergedSettings);

    addAuditLog({
      action: 'settings_imported',
      message: `Imported settings backup from ${pendingSettingsImport.filePath}`
    });

    pendingSettingsImport = null;

    return {
      ok: true,
      settings: readSettings()
    };
  } catch (error) {
    return {
      ok: false,
      error: `Could not import settings: ${error.message}`
    };
  }
});

ipcMain.handle('settings:importCancel', async () => {
  pendingSettingsImport = null;
  return { ok: true };
});

ipcMain.handle('settings:repairPreview', async () => {
  return getSettingsRepairPreview();
});

ipcMain.handle('settings:repairApply', async () => {
  return applySettingsRepair();
});

ipcMain.handle('settings:restorePoints', async () => {
  return getSettingsRestorePoints();
});

ipcMain.handle('settings:restoreApply', async (event, payload) => {
  return applySettingsRestorePoint(payload || {});
});


ipcMain.handle('dialog:selectPrivateKey', async (event) => {
  const win = getWindowFromEvent(event);
  const homePath = app.getPath('home');
  const sshPath = getUserSshPath();
  const defaultPath = fs.existsSync(sshPath) ? sshPath : homePath;

  const result = await dialog.showOpenDialog(win, {
    title: 'Select SSH Private Key',
    defaultPath,
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'OpenSSH Private Keys', extensions: ['pem', 'key', 'ppk'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('key:generate', async (event, payload) => {
  const result = await generateSshKey(payload || {});

  addAuditLog({
    action: 'ssh_key_generated',
    message: `Generated SSH key ${result.privateKeyPath}`
  });

  return result;
});

ipcMain.handle('key:list', async () => {
  return {
    ok: true,
    keys: listAvailableSshKeys(),
    locations: getSshKeyLocations()
  };
});

ipcMain.handle('key:readPublicKey', async (event, privateKeyPath) => {
  return getPublicKeyForPrivateKey(privateKeyPath);
});

ipcMain.handle('key:openFolder', async (event, payload) => {
  return openSshKeyLocation(payload || {});
});

ipcMain.handle('key:archive', async (event, privateKeyPath) => {
  try {
    const result = archiveSshKeyPair(privateKeyPath);

    if (result.ok) {
      addAuditLog({
        action: 'ssh_key_archived',
        message: `Archived SSH key ${result.keyName} to ${result.archiveFolder}`
      });
    }

    return result;
  } catch (error) {
    return {
      ok: false,
      error: `Could not archive SSH key: ${error.message}`
    };
  }
});

ipcMain.handle('key:archiveAll', async () => {
  const keys = listAvailableSshKeys();

  if (!keys.length) {
    return {
      ok: true,
      archivedCount: 0,
      failures: [],
      results: []
    };
  }

  const results = [];
  const failures = [];

  keys.forEach((key) => {
    try {
      const result = archiveSshKeyPair(key.privateKeyPath);

      if (result.ok) {
        results.push(result);
      } else {
        failures.push({
          keyName: key.name,
          privateKeyPath: key.privateKeyPath,
          error: result.error || 'Unknown archive error.'
        });
      }
    } catch (error) {
      failures.push({
        keyName: key.name,
        privateKeyPath: key.privateKeyPath,
        error: error.message
      });
    }
  });

  if (results.length) {
    addAuditLog({
      action: 'ssh_keys_archived',
      message: `Archived ${results.length} SSH key${results.length === 1 ? '' : 's'} for a fresh start.`
    });
  }

  return {
    ok: true,
    archivedCount: results.length,
    failures,
    results
  };
});


ipcMain.handle('connection:testHealth', async (event, payload) => {
  const serverId = String(payload?.serverId || '').trim();
  const connectingSession = terminalManager.getConnectingSessionInfo();

  if (connectingSession) {
    return {
      ok: false,
      code: 'CONNECTION_BUSY',
      activeTerminalId: connectingSession.terminalId,
      error: `Connection in progress: ${connectingSession.serverName} is still connecting. Wait for it to finish before testing another connection.`
    };
  }

  if (connectionHealthCheckInFlight) {
    return {
      ok: false,
      code: 'CONNECTION_CHECK_BUSY',
      error: `Connection check already running for ${connectionHealthCheckInFlight.serverName}.`
    };
  }

  const settings = readSettings();
  const server = (settings.servers || []).find((item) => item.id === serverId);
  connectionHealthCheckInFlight = {
    serverId,
    serverName: server?.name || 'another connection'
  };

  try {
    return await testConnectionHealth(serverId);
  } catch (error) {
    return {
      ok: false,
      error: `Connection health check failed: ${error.message}`
    };
  } finally {
    connectionHealthCheckInFlight = null;
  }
});

ipcMain.handle('terminal:create', async (event, payload) => {
  const settings = readSettings();
  const requestedProfileId = String(payload?.profileId || '').trim();
  const requestedWorkingDirectory = String(payload?.workingDirectory || '').trim().slice(0, 4096);
  let server = settings.servers.find((item) => item.id === payload.serverId) || null;

  if (server?.type === 'local' && requestedWorkingDirectory) {
    server = {
      ...server,
      workingDirectory: requestedWorkingDirectory
    };
  }

  if (!server && requestedProfileId) {
    const profile = (settings.terminalProfiles || []).find((item) => item.id === requestedProfileId);

    if (profile) {
      server = {
        id: `terminal-profile:${profile.id}`,
        type: 'local',
        name: profile.name || 'Terminal Profile',
        description: 'Terminal Profile',
        group: 'Profiles',
        profileId: profile.id,
        shell: profile.executable || '',
        workingDirectory: String(payload?.workingDirectory || '').trim()
      };
    }
  }

  if (!server) {
    return { ok: false, error: requestedProfileId ? 'Terminal profile not found.' : 'Server not found.' };
  }

  const resolved = server.type === 'local'
    ? resolveTerminalProfileForServer(settings, server, requestedProfileId)
    : { server, profile: null };
  server = resolved.server;

  const terminalId = payload.terminalId;
  const connectingSession = terminalManager.getConnectingSessionInfo(terminalId);

  if (connectingSession) {
    return {
      ok: false,
      code: 'CONNECTION_BUSY',
      activeTerminalId: connectingSession.terminalId,
      error: `Another server connection is still in progress: ${connectingSession.serverName}. Wait for it to finish before opening ${server.name}.`
    };
  }

  if (connectionHealthCheckInFlight) {
    return {
      ok: false,
      code: 'CONNECTION_CHECK_BUSY',
      error: `A connection health check is still running for ${connectionHealthCheckInFlight.serverName}. Wait for it to finish before connecting.`
    };
  }

  const sender = event.sender;
  const secrets = getStoredSecretsForServer(server, payload.secrets || {});

  try {
    await terminalManager.create({
      terminalId,
      server,
      secrets,
      sender,
      defaultCols: payload.cols || 100,
      defaultRows: payload.rows || 32
    });
  } catch (error) {
    return {
      ok: false,
      code: error.code || 'TERMINAL_CREATE_FAILED',
      activeTerminalId: error.activeTerminalId || null,
      error: error.message || 'Terminal session could not be started.'
    };
  }

  addAuditLog({
    action: 'terminal_opened',
    message: `Opened ${server.type === 'remote' ? 'SSH' : 'local'} terminal: ${server.name}`
  });

  return { ok: true, terminalId };
});

ipcMain.handle('terminal:write', async (event, payload) => {
  terminalManager.write(payload.terminalId, payload.data);
  return { ok: true };
});

ipcMain.handle('terminal:resize', async (event, payload) => {
  terminalManager.resize(payload.terminalId, payload.cols, payload.rows);
  return { ok: true };
});

ipcMain.handle('terminal:close', async (event, payload) => {
  terminalManager.close(payload.terminalId);
  return { ok: true };
});
