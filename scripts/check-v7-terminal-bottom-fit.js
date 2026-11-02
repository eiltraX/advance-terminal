// V7 terminal bottom-fit regression: verify renderer/backend dimensions match
// the actual xterm cells, including tiny views and disconnected pinned tabs.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'src/main/terminal-manager.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/renderer/v7-layout-consistency.css'), 'utf8');

const slice = (source, start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert(a !== -1 && b > a, `Missing source section: ${start}`);
  return source.slice(a, b);
};
const ctx = {
  console, Number, Math,
  window: { advanceTerminal: { resizeTerminal: (size) => calls.push(size) } }
};
const calls = [];
vm.createContext(ctx);
vm.runInContext(slice(renderer, 'function getTerminalSize(session)', '\nfunction fitTerminalSession(session,'), ctx);
vm.runInContext(slice(backend, 'function normalizeTerminalSize(cols, rows)', '\nfunction applyRemoteWindowSize('), ctx);

for (const [cols, rows] of [[48, 13], [80, 24], [160, 44], [2, 2], [800, 350]]) {
  const frontend = ctx.getTerminalSize({term: {cols, rows}});
  const remote = ctx.normalizeTerminalSize(frontend.cols, frontend.rows);
  assert.equal(frontend.cols, Math.max(2, Math.min(500, cols)), 'Renderer cols do not match visible xterm');
  assert.equal(frontend.rows, Math.max(2, Math.min(200, rows)), 'Renderer rows do not match visible xterm');
  assert.equal(remote.cols, frontend.cols, 'Backend columns do not match renderer');
  assert.equal(remote.rows, frontend.rows, 'Backend rows do not match renderer');
}
assert.equal(ctx.getTerminalSize({}).cols, 120);
assert.equal(ctx.getTerminalSize({}).rows, 32);
assert.equal(ctx.normalizeTerminalSize().cols, 120);
assert.equal(ctx.normalizeTerminalSize().rows, 32);
assert.match(css, /#terminal-host > \.terminal-pane\s*\{[^}]*padding:\s*0/s, 'Terminal pane must not hide height from FitAddon');
assert.match(css, /#terminal-host > \.terminal-pane > \.xterm\s*\{[^}]*padding:\s*8px 8px 16px/s, 'Move 16px gutter to xterm for accurate FitAddon measurement');

let fitCount = 0;
const activePane = {classList: {contains: value => value === 'active'}};
const fakeSession = (closed) => ({
  closed, terminalId: closed ? 'restored' : 'live', pane: activePane,
  term: {cols: 41, rows: 11},
  fitAddon: {fit() {fitCount += 1;}}
});
const live = fakeSession(false);
ctx.fitTerminalSessionNow(live);
assert.equal(fitCount, 1, 'Live session should fit');
assert.equal(calls.length, 1, 'Live session should synchronize backend once');
assert.equal(calls[0].cols, 41);
assert.equal(calls[0].rows, 11);

const restored = fakeSession(true);
ctx.fitTerminalSessionNow(restored);
assert.equal(fitCount, 2, 'Disconnected pinned tab still must resize its visible xterm');
assert.equal(calls.length, 1, 'Disconnected pinned tab must not notify/reopen PTY or SSH');

const hidden = fakeSession(false);
hidden.pane.classList.contains = () => false;
ctx.fitTerminalSessionNow(hidden);
assert.equal(fitCount, 2, 'Hidden tab must not be fitted');
assert.equal(calls.length, 1, 'Hidden tab must not send backend resize');
console.log('PASS: matching PTY/SSH xterm rows and columns, visible disconnected-tab refit, no hidden/backend side effects');
