/**
 * Advance Terminal v5 Warp-inspired skin integration check.
 * Safe and read-only: it only checks local source files, no Electron instance or settings access.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
const originalCssPath = path.join(root, 'src/renderer/styles.css');
const skinPath = path.join(root, 'src/renderer/warp-theme.css');
assert(fs.existsSync(originalCssPath), 'Original v5 stylesheet must remain available.');
assert(fs.existsSync(skinPath), 'Optional Warp skin file missing.');
const stylesheetLinks = [...html.matchAll(/<link\s+[^>]*rel="stylesheet"[^>]*>/g)].map((m) => m[0]);
const originals = stylesheetLinks.filter((s) => s.includes('href="./styles.css"'));
const skins = stylesheetLinks.filter((s) => s.includes('href="./warp-theme.css"'));
assert.equal(originals.length, 1, 'Expected exactly one original stylesheet link.');
assert.equal(skins.length, 1, 'Expected exactly one Warp stylesheet link.');
assert(html.indexOf('href="./styles.css"') < html.indexOf('href="./warp-theme.css"'), 'Skin must load after original styles.');
const css = fs.readFileSync(skinPath, 'utf8');
for (const marker of [
  ':root[data-theme="dark"]',
  '.menu-row', '.toolbar', '.servers-panel', '.terminal-tabs',
  '.terminal-tab-context-menu', '.statusbar', '@media (prefers-reduced-motion: reduce)'
]) assert(css.includes(marker), `Warp CSS missing expected selector: ${marker}`);
for (const forbidden of ['@import ', '@font-face', 'backdrop-filter', 'animation: infinite', 'url(http']) {
  assert(!css.includes(forbidden), `Heavy or external visual behavior detected: ${forbidden}`);
}
for (const marker of ['id="terminal-host"', 'id="terminal-tabs"', 'id="terminal-toolbar-actions"', 'id="server-list"']) {
  assert(html.includes(marker), `Existing terminal interaction anchor missing: ${marker}`);
}
assert(fs.existsSync(path.join(root, 'src/renderer/renderer.js')), 'Existing renderer must remain untouched.');
console.log('PASS: Warp v5 skin loads after base CSS and preserves required v5 UI anchors.');
