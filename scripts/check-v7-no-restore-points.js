'use strict';
// Isolated regression check: never reads or writes the user's real Electron profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const main = read('src/main/main.js');
const preload = read('src/main/preload.js');
const storeSource = read('src/main/store.js');
const renderer = read('src/renderer/renderer.js');
const html = read('src/renderer/index.html');
const titlebar = read('src/renderer/v7-frameless-titlebar.js');
const css = read('src/renderer/styles.css');
const flyout = read('src/renderer/v7-push-flyout.css');
const layout = read('src/renderer/v7-layout-consistency.css');

for (const [name, contents] of Object.entries({main, preload, storeSource, renderer, html, titlebar, css, flyout, layout})) {
  for (const forbidden of [
    /createSettingsAutoBackup|runSettingsAutoBackup/,
    /settings:restorePoints|settings:restoreApply/,
    /listSettingsRestorePoints|restoreSettingsPoint|renderSettingsRestorePoints/,
    /settings-tab-restore|restore-points-list|restore-point-card/,
    /\bRestore Points\b/i
  ]) {
    assert(!forbidden.test(contents), `Restore Points code remains in ${name}: ${forbidden}`);
  }
}
assert(!/backup-auto-/.test(storeSource), 'Automatic settings backup files are still created in store.js');
assert(main.includes("registerTrustedIpcHandler('settings:repairPreview'"), 'Manual repair preview removed');
assert(main.includes("registerTrustedIpcHandler('settings:repairApply'"), 'Manual repair apply removed');
assert(renderer.includes('function repairSettingsFromLocalBackup()'), 'Manual repair UI removed');
assert(html.includes('id="tool-repair-settings"'), 'Repair Settings button removed');
assert(html.includes('id="settings-import-main"'), 'Manual import button removed');
assert(html.includes('id="settings-save-main"'), 'Manual export button removed');
assert(!/data-settings-tab="restore"/.test(html), 'Stale Settings navigation to Restore Points');
assert(html.includes('id="help-tab-recovery"'), 'Updated backup/repair guide missing');
assert(titlebar.includes("{label:'SSH Keys'"), 'SSH Keys menu entry removed');
assert(!titlebar.includes("settingsSection:'restore'"), 'Stale Restore Points menu entry');
assert(renderer.includes('function restoreSavedTerminalSessions()'), 'Existing saved sessions restoration removed');
assert(renderer.includes('function checkpointDailyUsage('), 'Existing usage reports removed');
assert(main.includes("registerTrustedIpcHandler('settings:export'"), 'Manual settings export removed');
assert(main.includes("registerTrustedIpcHandler('settings:importApply'"), 'Manual settings import removed');

// Exercise the actual store code with a disposable profile and secret-store stubs.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'advance-terminal-no-restore-'));
try {
  const fixtureElectron = {app: {getPath: (name) => {
    assert.equal(name, 'userData');
    return fixture;
  }}};
  const fakeSecretStore = {
    saveServerSecret: () => ({ok: true}),
    hasServerSecret: () => false,
    deleteServerSecret: () => {},
    pruneSecretsForServerIds: () => {}
  };
  const storeModule = {exports: {}};
  const sandboxRequire = (name) => {
    if (name === 'electron') return fixtureElectron;
    if (name === './secret-store') return fakeSecretStore;
    return require(name);
  };
  const wrapper = vm.runInNewContext(`(function (require, module, exports, process) {\n${storeSource}\n})`,
    {}, {filename: 'src/main/store.js'});
  wrapper(sandboxRequire, storeModule, storeModule.exports, process);
  const store = storeModule.exports;
  assert.equal(typeof store.createSettingsAutoBackup, 'undefined', 'Automatic backup method still exported');

  const settings = store.readSettings();
  assert(Array.isArray(settings.servers), 'Settings file did not load');
  const sampleId = 'regression-test-local';
  settings.servers.push({id: sampleId, type: 'local', name: 'Fixture PowerShell', shell: 'powershell.exe'});
  settings.servers.push({
    id: 'regression-test-ssh', type: 'remote', name: 'Fixture SSH',
    host: 'example.invalid', username: 'fixture', port: 22, authType: 'key',
    privateKeyPath: 'C:\\example\\fixture', savePassword: false, savePassphrase: false
  });
  settings.selectedServerId = sampleId;
  store.saveSettings(settings);
  store.saveSettings(store.readSettings());
  store.addAuditLog({action: 'fixture', message: 'Disposable test only'});
  const after = store.readSettings();
  assert(after.servers.some((server) => server.id === sampleId), 'Saved local profile did not persist');
  assert(after.servers.some((server) => server.id === 'regression-test-ssh' && server.host === 'example.invalid'),
    'Saved SSH profile did not persist');
  assert.equal(after.selectedServerId, sampleId, 'Selected terminal profile did not persist');
  const entries = fs.readdirSync(fixture);
  assert(entries.includes('settings.json'), 'settings.json missing after save');
  assert(!entries.some((name) => name.includes('backup-auto-')), 'Automatic settings backup unexpectedly created');
  assert.equal(entries.filter((name) => name.startsWith('settings.json')).length, 1,
    'Unexpected extra settings snapshots created');
} finally {
  fs.rmSync(fixture, {recursive: true, force: true});
}
console.log('PASS: Restore Points UI/API, automatic backup hooks and storage removed.');
console.log('PASS: Manual import/export/repair, saved session restoration and daily usage code preserved.');
console.log('PASS: Disposable profile saves settings and preserves a local terminal without automatic backup files.');
