const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];

const REQUIRED_BUILD_ASSETS = [
  'build/icon.ico',
  'build/icon.png',
  'build/installer-dependency-checks.nsh'
];

const REQUIRED_SYNTAX_FILES = [
  'src/main/main.js',
  'src/main/preload.js',
  'src/main/store.js',
  'src/main/secret-store.js',
  'src/main/key-manager.js',
  'src/main/terminal-manager.js',
  'src/renderer/js/renderer-foundation.js',
  'src/renderer/js/renderer-terminal-helpers.js',
  'src/renderer/js/renderer-connection-helpers.js',
  'src/renderer/js/renderer-report-helpers.js',
  'src/renderer/renderer.js'
];

const REQUIRED_RENDERER_SCRIPT_ORDER = [
  '../../node_modules/xterm/lib/xterm.js',
  '../../node_modules/xterm-addon-fit/lib/xterm-addon-fit.js',
  './js/renderer-foundation.js',
  './js/renderer-terminal-helpers.js',
  './js/renderer-connection-helpers.js',
  './js/renderer-report-helpers.js',
  './renderer.js'
];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function filePath(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(filePath(relativePath));
}

function readText(relativePath) {
  if (!exists(relativePath)) {
    fail(`${relativePath} is missing.`);
    return '';
  }

  return fs.readFileSync(filePath(relativePath), 'utf8');
}

function readPackageJson() {
  const source = readText('package.json');

  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`package.json is invalid JSON: ${error.message}`);
    return {};
  }
}

function assertScriptIncludes(scriptValue, requiredText, message) {
  assert(String(scriptValue || '').includes(requiredText), message);
}

const packageJson = readPackageJson();
const scripts = packageJson.scripts || {};
const build = packageJson.build || {};
const extraResources = Array.isArray(build.extraResources) ? build.extraResources : [];
const hasBuildResources = extraResources.some((item) => item && item.from === 'build' && item.to === 'build');

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
assert(
  SEMVER_PATTERN.test(String(packageJson.version || '')),
  'package.json version must be a valid semantic version like 5.0.0.'
);
assert(Boolean(scripts.check), 'npm run check is missing.');
assertScriptIncludes(scripts.check, 'check:syntax', 'npm run check must run check:syntax.');
assertScriptIncludes(scripts.check, 'check:foundation', 'npm run check must run check:foundation.');
assert(Boolean(scripts['check:syntax']), 'check:syntax script is missing.');
assert(Boolean(scripts['check:foundation']), 'check:foundation script is missing.');

REQUIRED_SYNTAX_FILES.forEach((relativePath) => {
  assert(exists(relativePath), `${relativePath} is missing.`);
  assertScriptIncludes(
    scripts['check:syntax'],
    `node --check ${relativePath}`,
    `${relativePath} is missing from check:syntax.`
  );
});

assertScriptIncludes(
  scripts['check:foundation'],
  'node --check scripts/check-foundation.js',
  'check:foundation must syntax-check scripts/check-foundation.js.'
);
assertScriptIncludes(
  scripts['check:foundation'],
  'node scripts/check-foundation.js',
  'check:foundation must run scripts/check-foundation.js.'
);

assert(Boolean(build.win && build.win.icon), 'Windows build icon is not configured.');
assert(Boolean(build.nsis && build.nsis.installerIcon), 'NSIS installer icon is not configured.');
assert(Boolean(build.nsis && build.nsis.include), 'NSIS dependency include is not configured.');
assert(hasBuildResources, 'build assets are not included as extraResources.');

REQUIRED_BUILD_ASSETS.forEach((relativePath) => {
  assert(exists(relativePath), `${relativePath} is missing.`);
});

const indexHtml = readText('src/renderer/index.html');
let previousScriptIndex = -1;

REQUIRED_RENDERER_SCRIPT_ORDER.forEach((scriptPath) => {
  const marker = `src="${scriptPath}"`;
  const currentScriptIndex = indexHtml.indexOf(marker);

  assert(currentScriptIndex !== -1, `${scriptPath} is missing from src/renderer/index.html.`);
  assert(
    currentScriptIndex > previousScriptIndex,
    `${scriptPath} is loaded in the wrong order in src/renderer/index.html.`
  );

  previousScriptIndex = currentScriptIndex;
});

const storeSource = readText('src/main/store.js');
assert(storeSource.includes("safeServer.password = '';"), 'settings store must scrub saved passwords before writing settings.json.');
assert(storeSource.includes("safeServer.passphrase = '';"), 'settings store must scrub saved passphrases before writing settings.json.');
assert(storeSource.includes('saveServerSecret'), 'settings store does not persist secrets through the secret store.');
assert(storeSource.includes('pruneSecretsForServerIds'), 'settings store does not prune orphaned saved secrets.');

const secretStoreSource = readText('src/main/secret-store.js');
assert(secretStoreSource.includes('safeStorage.encryptString'), 'secret store must encrypt saved credentials with Electron safeStorage.');
assert(secretStoreSource.includes('safeStorage.decryptString'), 'secret store must decrypt saved credentials with Electron safeStorage.');
assert(!secretStoreSource.includes("encoding: 'plain'"), 'secret store must not use plaintext secret fallback storage.');

const mainSource = readText('src/main/main.js');
assert(mainSource.includes('getStoredSecretsForServer'), 'main process does not load stored secrets for terminal sessions.');
assert(mainSource.includes('getSecretStorageStatus'), 'app info does not expose secret storage status.');

const terminalManagerSource = readText('src/main/terminal-manager.js');
assert(terminalManagerSource.includes('npm.cmd'), 'Windows PowerShell npm compatibility shim is missing.');
assert(terminalManagerSource.includes('npx.cmd'), 'Windows PowerShell npx compatibility shim is missing.');
assert(terminalManagerSource.includes("'.CMD'"), 'Windows local terminal PATHEXT must include .CMD.');

const rendererSource = readText('src/renderer/renderer.js');
const terminalHelpersSource = readText('src/renderer/js/renderer-terminal-helpers.js');
const connectionHelpersSource = readText('src/renderer/js/renderer-connection-helpers.js');
const reportHelpersSource = readText('src/renderer/js/renderer-report-helpers.js');

assert(terminalHelpersSource.includes('window.AdvanceTerminalRendererTerminalHelpers'), 'terminal helpers are not exported to the renderer.');
assert(connectionHelpersSource.includes('window.AdvanceTerminalRendererConnectionHelpers'), 'connection helpers are not exported to the renderer.');
assert(reportHelpersSource.includes('window.AdvanceTerminalRendererReportHelpers'), 'report helpers are not exported to the renderer.');
assert(reportHelpersSource.includes('REPORT_HISTORY_MAX_ITEMS'), 'report history max item helper is missing.');
assert(rendererSource.includes('REPORT_HISTORY_MAX_ITEMS'), 'renderer.js does not import the report history max item helper.');

if (failures.length) {
  failures.forEach((message) => {
    console.error(`Foundation check failed: ${message}`);
  });
  process.exit(1);
}

console.log('Foundation check passed.');
