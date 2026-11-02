'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/renderer/v7-minimal-shell.css'), 'utf8');
assert(css.includes('.v7-session-dot svg'), 'SVG icons need consistent sizing');
assert(css.includes('stroke: currentColor'), 'SVG icons should match monochrome UI');
assert(source.includes("sessionIcon.dataset.sessionType !== sessionType"), 'Session type icon should only be replaced on change');
assert(source.includes('m7 9 3 3-3 3'), 'Local session needs terminal-window glyph');
assert(source.includes('M6 6h.01M6 18h.01'), 'SSH session needs server glyph');

const begin = source.indexOf('function showSshPathLockBlocked(session, reason) {');
const end = source.indexOf('\nfunction applySshLockedLocationResult(', begin);
assert(begin !== -1 && end > begin, 'SSH lock warning handler not found');
const block = source.slice(begin, end);
assert(!block.includes('showToast('), 'SSH lock may not display a toast');

let now = 10_000;
const written = [], recorded = [], consoleLogs = [], focused = [], toasts = [];
const context = {
  Date: { now: () => now },
  appendLiveConsole: (...args) => consoleLogs.push(args),
  recordSessionEvent: (...args) => recorded.push(args),
  focusTerminal: (session) => focused.push(session),
  showToast: (...args) => toasts.push(args),
};
vm.createContext(context);
vm.runInContext(block, context);
const session = { term: { write: (data) => written.push(data) } };
const message = 'SSH folder lock blocked opening another remote shell from this session. Use the saved server list instead.';
context.showSshPathLockBlocked(session, message);
assert.equal(written.length, 1);
assert(written[0].includes('[Advance Terminal]'), 'Missing inline prefix');
assert(written[0].includes(message), 'Missing security reason');
assert(written[0].includes('\x1b[38;2;210;162;79m'), 'Missing amber inline color');
assert(written[0].includes('\x1b[0m'), 'ANSI style must reset after warning');
assert.equal(toasts.length, 0, 'Floating notification must remain disabled');
now += 1000;
context.showSshPathLockBlocked(session, message);
assert.equal(written.length, 1, 'Repeated same warning must not spam terminal');
assert.equal(recorded.length, 2, 'Every blocked attempt must be audited');
now += 500;
context.showSshPathLockBlocked(session, 'SSH folder lock blocked remote transfer.');
assert.equal(written.length, 2, 'Different warning must display immediately');
now += 3001;
context.showSshPathLockBlocked(session, message);
assert.equal(written.length, 3, 'Warning should display after the duplicate window');
assert.equal(recorded.length, 4);
assert.equal(focused.length, 4, 'Terminal focus behavior must be preserved');
assert.equal(toasts.length, 0);
context.showSshPathLockBlocked(session, 'Rejected\x1b[31m\r\nInjected');
assert(written.at(-1).includes('Rejected [31m  Injected'), 'Message control characters must be sanitized');
assert.equal(toasts.length, 0);

// Exercise the actual session icon updater, including a local-to-SSH change.
const updateStart = source.indexOf('function updateV7SessionRow(row, session) {');
const updateEnd = source.indexOf('\nfunction renderV7MinimalSessionList()', updateStart);
assert(updateStart > -1 && updateEnd > updateStart, 'Session row updater not found');
const iconElement = { dataset: {}, innerHTML: '' };
const noopElement = { setAttribute() {}, title: '', disabled: false, textContent: '', hidden: false };
const nodes = new Map([['.v7-session-dot', iconElement]]);
const row = {
  classList: { toggle() {} },
  setAttribute() {},
  style: { setProperty() {}, removeProperty() {} },
  querySelector: (selector) => nodes.get(selector) || noopElement,
};
const sidebar = {
  state: { activeTerminalId: 'local-1' },
  getTerminalTabTitle: (session) => session.server?.name || 'Terminal',
  getV7SessionStatus: () => 'Ready',
  isTerminalTabWorking: () => false,
  normalizeTerminalTabColor: () => '',
  getV7SessionPaletteChoice: () => null,
};
vm.createContext(sidebar);
vm.runInContext(source.slice(updateStart, updateEnd), sidebar);
const iconSession = { terminalId: 'local-1', server: { type: 'local', name: 'Local terminal' } };
sidebar.updateV7SessionRow(row, iconSession);
assert.equal(iconElement.dataset.sessionType, 'local');
assert.match(iconElement.innerHTML, /<rect x="3" y="3"/, 'Local icon must be terminal window');
const firstIconMarkup = iconElement.innerHTML;
sidebar.updateV7SessionRow(row, iconSession);
assert.equal(iconElement.innerHTML, firstIconMarkup, 'Re-render must preserve same icon markup');
iconSession.server.type = 'remote';
sidebar.updateV7SessionRow(row, iconSession);
assert.equal(iconElement.dataset.sessionType, 'ssh');
assert.match(iconElement.innerHTML, /<rect x="2" y="14"/, 'Remote icon must be server stack');

console.log('PASS: Local/SSH icons, inline amber SSH security notice, 3s duplicate suppression, audit preservation, no toast');
