'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('src/renderer/index.html');
const renderer = read('src/renderer/renderer.js');
const css = read('src/renderer/v7-settings-redesign.css');
const nav = read('src/renderer/v7-settings-redesign.js');
const ids = ['at-settings-search', 'at-settings-search-results', 'at-settings-picker',
  'settings-save-main', 'settings-import-main', 'settings-repair-main',
  'safe-paste-multiline-toggle', 'right-click-auto-enter-toggle', 'ssh-lock-start-folder-toggle',
  'terminal-action-list', 'ai-save-settings', 'ssh-key-list', 'check-updates-button'];
for (const id of ids) {
  assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `Missing/duplicate control ${id}`);
}
for (const key of ['appearance','safety','terminal-actions','keys','ai','recovery','updates']) {
  assert(html.includes(`data-settings-tab="${key}"`), `Missing category ${key}`);
  assert(html.includes(`<option value="${key}">`), `Missing dropdown category ${key}`);
}
for (const key of ['appearance','safety','terminal-actions','keys','ai','recovery','updates']) {
  assert(html.includes(`id="settings-tab-${key}"`), `Missing settings section ${key}`);
}
assert(!html.includes('id="view-tab-appearance"'), 'Legacy Appearance page still owns the controls');
assert(renderer.includes("'appearance', 'safety', 'terminal-actions'"), 'Appearance not included in Settings router');
assert(renderer.includes("button.addEventListener('click', () => setSettingsTab(button.dataset.settingsTab))"), 'Original settings event delegation changed');
assert(html.includes('href="./v7-settings-redesign.css"'), 'UI stylesheet not loaded');
assert(html.includes('src="./v7-settings-redesign.js"'), 'UI script not loaded');
assert(/\.v7-flyout-content #settings-view \.settings-section\.active \{ display: block !important; \}/.test(css), 'Flyout active section not visible');
assert(/\.v7-flyout-content #settings-view \.settings-section:not\(\.active\) \{ display: none !important;/.test(css), 'Flyout hidden sections still visible');
assert(nav.includes('button.click()'), 'Search/selector must use established Settings router');
assert(nav.includes('MutationObserver(sync)'), 'External settings navigation not synchronized');
assert(!/settings:restorePoints|restoreSettingsPoint|settings-tab-restore/.test(html+renderer+nav), 'Restore Points logic reintroduced');
console.log('PASS: Categories, search, and compact picker present; settings controls retain unique IDs.');
console.log('PASS: Appearance now uses Settings category; recovery actions and control handlers retained.');
console.log('PASS: Single active flyout section, external navigation synchronization and regression boundaries.');
