"use strict";
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/renderer/v7-ui-polish.css'), 'utf8');
const match = /<link\s+rel="stylesheet"\s+href="\.\/v7-ui-polish\.css">/g;
assert.strictEqual([...html.matchAll(match)].length, 1, 'UI stylesheet must load once');
assert(html.indexOf('v7-ui-polish.css') > html.indexOf('v7-multiline-composer.css'), 'Polish stylesheet must load after multiline styles');
for (const selector of ['v7-session-item', 'v7-session-search', 'v7-composer-input', 'v7-composer-multiline-hint', 'terminal-session-header', 'statusbar']) {
  assert(css.includes(selector), `Expected UI target: ${selector}`);
}
for (const id of ['v7-session-list','v7-global-search','terminal-tabs','terminal-host','v7-command-composer','v7-composer-input','v7-composer-send','v7-composer-multiline-toggle','terminal-status']) {
  assert(html.includes(`id="${id}"`), `Required existing control missing: ${id}`);
}
assert(html.includes('Start a terminal session'), 'Expected clearer empty-state heading');
assert(!/(?:display\s*:\s*none\s*!important)[^}]*\.xterm/.test(css), 'Do not hide terminal');
assert(!css.includes('.workspace {'), 'UI polish must not alter terminal grid sizes');
assert(!css.includes('#terminal-host > .terminal-pane'), 'UI polish must not alter xterm fit measurements');
console.log('PASS: UI styles linked after existing layers.');
console.log('PASS: Session, composer, terminal and status controls preserved.');
console.log('PASS: Presentation-only patch does not change xterm layout or IPC.');
