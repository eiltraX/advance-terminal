"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(base, p), 'utf8');
const html = read('src/renderer/index.html');
const renderer = read('src/renderer/renderer.js');
const nav = read('src/renderer/v7-settings-redesign.js');
const controls = ['appearance-theme-select', 'notification-position-select',
  'in-app-toast-mode-select', 'notification-preview-button'];
for (const id of controls) {
  assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `Missing/duplicate: ${id}`);
  const insideAppearance = html.slice(html.indexOf('id="settings-tab-appearance"'), html.indexOf('id="settings-tab-safety"'));
  assert(insideAppearance.includes(`id="${id}"`), `${id} remains outside Settings`);
}
assert(html.includes('id="settings-tab-appearance" class="settings-section"'));
assert(!html.includes('id="view-tab-appearance"'));
assert(!html.includes('at-settings-open-elsewhere'));
assert(renderer.includes("if (view === 'view') {\n    setActiveView('settings', 'settings');\n    setSettingsTab('appearance');"));
assert(renderer.includes("'appearance', 'safety', 'terminal-actions'"));
assert(renderer.includes("if (normalizedTab === 'appearance') {"));
assert(renderer.includes('updateInAppToastModeControl();'));
assert(!nav.includes("if (key === 'appearance') return"));
assert(html.includes('data-help-nav="settings" data-settings-tab="appearance"'));
assert(html.includes('data-settings-tab="appearance"'));
assert(/\$\('#appearance-theme-select'\)\?\.addEventListener\('change'/.test(renderer));
assert(/\$\('#notification-position-select'\)\?\.addEventListener\('change'/.test(renderer));
assert(/\$\('#in-app-toast-mode-select'\)\?\.addEventListener\('change'/.test(renderer));
assert(/\$\('#notification-preview-button'\)\?\.addEventListener\('click'/.test(renderer));
console.log('PASS: Appearance integrated into Settings with one copy of each live control.');
console.log('PASS: Toolbar/View/Help compatibility and existing preference handlers retained.');
