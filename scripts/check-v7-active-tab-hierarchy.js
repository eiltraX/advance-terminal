'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../src/renderer/v7-minimal-shell.css'), 'utf8');
function body(selector) {
  const start = css.indexOf(selector + ' {');
  assert(start >= 0, `Missing selector ${selector}`);
  const open = css.indexOf('{', start);
  const end = css.indexOf('}', open);
  assert(end >= 0, `Unterminated rule ${selector}`);
  return css.slice(open + 1, end);
}
assert.match(body('.v7-session-row'), /border:\s*1px solid transparent/);
assert.match(body('.v7-session-row.active'), /background:\s*#444d5a/);
assert.match(body('.v7-session-row.active'), /box-shadow:\s*none/);
assert(!css.includes('.v7-session-row.active::before'), 'Active-left rail must not be rendered');
assert.match(body('.v7-session-row.has-custom-color'), /var\(--v7-session-color-idle\)/);
assert.match(body('.v7-session-row.has-custom-color:not(.active):is(:hover, :focus-within)'), /var\(--v7-session-color-hover\)/);
assert.match(body('.v7-session-row.has-custom-color.active'), /var\(--v7-session-color-active\)/);
assert.match(body('.v7-session-row.active .v7-session-name strong'), /color:\s*#fff/);
assert.match(body('.v7-session-row:not(.active) .v7-session-name strong'), /color:\s*#d9dee6/);
assert.match(body('.v7-session-row .v7-session-pin'), /opacity:\s*\.58/);
assert.match(body('.v7-session-actions, .v7-session-close'), /top:\s*-4px/);
console.log('PASS: borderless strong active fill, muted idle tab, no selection rail, unchanged pin and hover controls');
