'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/renderer/v7-minimal-shell.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');

function style(selector) {
  const needle = `${selector} {`;
  const index = css.indexOf(needle);
  assert(index >= 0, `Missing selector: ${selector}`);
  const match = css.slice(index + needle.length).match(/^([^}]+)}/);
  assert(match, `Unclosed rule: ${selector}`);
  return match[1];
}

const pin = style('.v7-session-row .v7-session-pin');
assert.match(pin, /position:\s*absolute/, 'Pin must be anchored to the card, not the flex content');
assert.match(pin, /top:\s*7px/, 'Pin should sit near the top of the card');
assert.match(pin, /right:\s*10px/, 'Pin should sit at the top right');
assert.match(pin, /color:\s*#aeb3bd/, 'Pin should be muted gray');
assert.match(pin, /opacity:\s*\.58/, 'Pin should be subtle when idle');
assert.match(pin, /pointer-events:\s*none/, 'Pin must never obstruct session switching');
assert.match(style('.v7-session-row:focus-within .v7-session-pin'), /opacity:\s*0/, 'Pin must hide when using hover controls or keyboard focus');
assert(css.includes('.v7-session-row:hover .v7-session-pin,'), 'Pin must hide on hover');
assert(!css.includes('.v7-session-row.is-pinned .v7-session-close'), 'Pinned tabs should not hide Close');
assert(!css.includes('.v7-session-row.is-pinned .v7-session-actions'), 'More button should not shift for pinned tabs');
assert.match(style('.v7-session-actions, .v7-session-close'), /top:\s*-4px/, 'Hover buttons must overlap the top card edge');
assert(css.includes('.v7-session-row:hover .v7-session-actions'), 'Three-dot control must appear on hover');
assert(css.includes('.v7-session-row:hover .v7-session-close'), 'Close must appear on hover even if pinned');
assert(js.includes("row.classList.toggle('is-pinned', session.tabPinned === true)"), 'Pinned state must control appearance');
assert(js.includes('closeButton.disabled = false'), 'Pinned tab X must remain usable');
assert(js.includes("row.querySelector('.v7-session-pin').hidden = session.tabPinned !== true"), 'Pin must be shown only for pinned cards');
console.log('PASS: subtle top-right pin, hover/focus actions, explicit pinned-close allowed, overlap positioning');
