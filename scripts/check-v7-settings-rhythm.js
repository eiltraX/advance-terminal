/* UI04: scoped golden-ratio rhythm; only Settings presentation changed. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root,'src/renderer/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root,'src/renderer/v7-settings-rhythm.css'), 'utf8');
assert.match(html,/v7-settings-expand\.css/);
assert.match(html,/v7-settings-rhythm\.css/);
assert.ok(html.indexOf('v7-settings-expand.css') < html.indexOf('v7-settings-rhythm.css'));
assert.equal((html.match(/v7-settings-rhythm\.css/g)||[]).length,1);
for(const x of ['--at-gap-1: 4px','--at-gap-2: 6px','--at-gap-3: 10px','--at-gap-4: 16px','--at-gap-5: 26px','--at-gap-6: 42px','--at-control-height: 38px']) assert.ok(css.includes(x),x);
assert.ok(css.includes('.workspace.v7-settings-dragging'));
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
assert.ok(!css.includes('transition: width') && !css.includes('transition: grid-template-columns'));
assert.ok(css.includes('.v7-flyout-content #settings-view .ssh-key-help-grid'));
assert.ok(!css.includes('#terminal-host') && !css.includes('#v7-workspace-flyout {'));
console.log('PASS: UI04 settings-only spacing rhythm, motion preferences, drag safety and stylesheet order.');
