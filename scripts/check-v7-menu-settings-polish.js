"use strict";
// Run: node scripts/check-v7-menu-settings-polish.js --before | --after
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const input = fs.readFileSync(path.join(root,'src/renderer/index.html'),'utf8');
const originalCss = fs.readFileSync(path.join(root,'src/renderer/v7-minimal-shell.css'),'utf8');
const renderer = fs.readFileSync(path.join(root,'src/renderer/renderer.js'),'utf8');
const mode = process.argv[2] || '--after';
const originalSha = '92f164822f581e09e7dbebff0fe96ed720436cd2bd41fa763a5591c427f89bc6';
const expectedSha = '8ba53a9b491422585c382c215da115c1a80fb35ed1bcf8afc02fbb03a55f023c';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha = hash(input);
const expectedCss = '2aca0758d0763370dc351f607e606cbe1b07de9122890a5ecbf1e56d36b16971';
const expectedRenderer = 'e6e2e1be4968d8fa29b239cb525e89b0ffc6162e971da2490b15eb78e55b9f59';
if (mode === '--before') {
  assert.equal(hash(originalCss), expectedCss, 'STOP: Minimal shell CSS differs from the verified reference.');
  assert.equal(hash(renderer), expectedRenderer, 'STOP: renderer.js differs from the verified reference.');
  assert.equal(sha, originalSha, 'STOP: Installed index.html differs from the verified reference; do not overwrite.');
  console.log('PASS: V7 menu/settings preflight — index.html matches the reference.');
  process.exit(0);
}
assert.equal(mode,'--after','Supported modes: --before / --after');
assert.equal(sha,expectedSha,'STOP: index.html differs from the tested patched file');
assert.equal(hash(originalCss), expectedCss, 'STOP: Minimal shell CSS changed; inspect before accepting this visual test.');
assert.equal(hash(renderer), expectedRenderer, 'STOP: renderer.js changed; inspect before accepting this visual test.');
const css=fs.readFileSync(path.join(root,'src/renderer/v7-menu-settings-polish.css'),'utf8');
for (const marker of ['.v7-shell-menu .dynamic-toolbar-actions', '.v7-shell-menu .tool-button > span:not(.tool-icon)', '#settings-view .settings-layout', '#settings-view .settings-nav', '#settings-view .report-option-row', '@media (max-width: 760px)']) {
  assert(css.includes(marker), 'Missing targeted menu or Settings style: ' + marker);
}
for (const marker of ['id="v7-shell-menu"','id="terminal-toolbar-actions"','id="settings-tab-terminal-actions"','id="safe-paste-multiline-toggle"','id="terminal-action-save"','id="settings-restore-main"']) {
  assert(input.includes(marker), 'Missing protected control: '+ marker);
}
assert(input.includes('id="v7-command-composer"') && input.includes('id="terminal-toolbar-actions"'), 'Composer must retain configurable terminal action buttons');
console.log('PASS: V7 compact menu, terminal composer actions and modern Settings styles installed; original handlers preserved.');
