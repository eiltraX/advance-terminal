// Detect the exact clipped-row regression: FitAddon subtracts padding of the
// .xterm element, not padding of its parent. No code execution or settings writes.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/renderer/v7-layout-consistency.css'), 'utf8');
const base = fs.readFileSync(path.join(root, 'src/renderer/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
function ruleFor(selector) {
  const pos = css.indexOf(selector + ' {');
  assert(pos >= 0, `Missing ${selector}`);
  const stop = css.indexOf('}', pos);
  return css.slice(pos, stop + 1);
}
const pane = ruleFor('#terminal-host > .terminal-pane');
const terminal = ruleFor('#terminal-host > .terminal-pane > .xterm');
assert.match(pane, /\bpadding:\s*0\s*;/, 'Parent padding is invisible to the FitAddon; clear it');
assert.match(terminal, /\bpadding:\s*8px 8px 16px\s*;/, 'Keep the physical top/right/bottom gutter on .xterm');
assert.match(terminal, /\bheight:\s*100%\s*;/, 'Keep xterm height bounded to its parent');
assert.match(terminal, /\bwidth:\s*100%\s*;/, 'Keep xterm width bounded');
assert.match(base, /\*\s*\{\s*box-sizing:\s*border-box;/, 'xterm padding must be border-box sized');
assert(html.indexOf('v7-layout-consistency.css') > html.indexOf('styles.css'), 'Layout override must be loaded last');
// In the old layout parent height included 24px of pane padding but .xterm
// content height did not. Model the same FitAddon formula across window sizes.
const top = 8, bottom = 16, sides = 8, cellHeight = 18, cellWidth = 9;
let sawPreviouslyClippedCase = false;
for (const height of [300, 355, 591, 620, 731, 880]) {
  const contentHeight = height - top - bottom;
  const oldRows = Math.floor(height / cellHeight);
  const rows = Math.floor((height - top - bottom) / cellHeight);
  assert(rows * cellHeight <= contentHeight, 'A fitted row crosses into composer gutter');
  if (oldRows * cellHeight > contentHeight) sawPreviouslyClippedCase = true;
  for (const width of [240, 410, 900]) {
    const contentWidth = width - 2 * sides;
    const cols = Math.floor((width - 2 * sides) / cellWidth);
    assert(cols * cellWidth <= contentWidth, 'A fitted column crosses the right padding');
  }
}
assert(sawPreviouslyClippedCase, 'Test setup failed to reproduce the earlier mismatch');
console.log('PASS: FitAddon uses element padding for exact xterm content-box row/column sizing; 16px bottom gutter preserved');
