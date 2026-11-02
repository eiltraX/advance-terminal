// Stage 3 source/regression contract; run from project root: node scripts/check-v7-design-menus-flyouts.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname, '..', 'src', 'renderer');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'v7-design-menus-flyouts.css'), 'utf8');
const forms = html.indexOf('v7-design-forms-dialogs.css');
const menu = html.indexOf('v7-design-menus-flyouts.css');
assert(forms >= 0 && menu > forms, 'Stage 3 must load after Stage 2');
assert.equal(html.split('v7-design-menus-flyouts.css').length - 1, 1, 'Stylesheet registered once');
for (const selector of ['.v7-shell-menu', '.v7-header-popup', '.v7-flyout-action', '.sidebar-context-menu']) {
  assert(css.includes(selector), 'Missing menu/flyout scope: ' + selector);
}
for (const token of ['--v7ds-radius-control', '--v7ds-radius-popup', '--v7ds-focus-ring', 'prefers-reduced-motion']) {
  assert(css.includes(token), 'Missing standard: ' + token);
}
for (const prohibited of ['.xterm', '.terminal-viewport', '.v7-session-card', '.v7-composer-input', 'scrollbar-width']) {
  assert(!css.includes(prohibited), 'Stage 3 must not override: ' + prohibited);
}
console.log('PASS: V7 Design System Stage 3 menu/flyout contract');
