'use strict';
// Regression for dark-mode palette: only cards' background changes, not text opacity.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.resolve(__dirname, '..', 'src/renderer/v7-minimal-shell.css'), 'utf8');
const js = fs.readFileSync(path.resolve(__dirname, '..', 'src/renderer/renderer.js'), 'utf8');
function rule(selector) {
  const start = css.indexOf(selector + ' {');
  assert(start >= 0, `Missing rule ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  assert(close > open);
  return css.slice(open + 1, close);
}
const idle = rule('.v7-session-row.has-custom-color');
const hover = rule('.v7-session-row.has-custom-color:not(.active):is(:hover, :focus-within)');
const active = rule('.v7-session-row.has-custom-color.active');
assert.match(idle, /background:\s*var\(--v7-session-color-idle\)/);
assert.match(hover, /background:\s*var\(--v7-session-color-hover\)/);
assert.match(active, /background:\s*var\(--v7-session-color-active\)/);
assert.match(rule('.v7-session-row'), /border:\s*1px solid transparent/);
assert.match(rule('.v7-session-row.active'), /border-color:\s*transparent/);
for (const state of [idle, hover, active]) {
  assert.match(state, /border-color:\s*transparent|background:/);
  assert.doesNotMatch(state, /(?:^|;)\s*opacity\s*:/, 'Color treatment must not fade text or icons');
}
assert(!css.includes('.v7-session-row.active::before'), 'Selection rail must be removed');
assert.match(rule('.v7-session-row .v7-session-pin'), /opacity:\s*\.58/);
assert.match(rule('.v7-session-actions, .v7-session-close'), /top:\s*-4px/);
for (const label of ['Coral Red', 'Orange', 'Lime Green', 'Yellow', 'Sky Blue', 'Pink', 'Lavender']) {
  assert(js.includes(`name: '${label}'`), `Missing rich palette entry ${label}`);
}
assert(js.includes('paletteChoice?.active || color'), 'Active card must use the full palette-selected fill');
console.log('PASS: borderless muted/hover/active palette, no left rail, readable text, preserved hover controls');
