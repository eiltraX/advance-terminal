'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const renderer = fs.readFileSync(path.resolve(__dirname, '../src/renderer/renderer.js'), 'utf8');
const begin = renderer.indexOf('// v5 tab metadata:');
const end = renderer.indexOf('function renderTerminalTabs()', begin);
assert(begin >= 0 && end > begin, 'Tab-persistence code exists');
const logic = renderer.slice(begin, end);
assert(renderer.includes('  restorePinnedTerminalTabs();\n  state.activityFeedReady = true;'), 'Startup restores pinned tabs');
assert(renderer.includes('if (session.tabPinned) persistPinnedTerminalTabs();'), 'Pinned metadata modifications are saved');
assert(!/setInterval\s*\(/.test(logic), 'No new polling introduced');
assert(!/saveSettings\s*\(/.test(logic), 'No writes to settings.json introduced');
assert(renderer.includes('session.restoredPinnedPlaceholder = true'), 'Restored sessions are marked as placeholders');
assert(renderer.includes('if (!session.restoredPinnedPlaceholder) {\n    moveActiveSessionToHistory'), 'Closing placeholder does not corrupt Work Reports');
assert(renderer.includes('if (!restoredPinned) {\n    recordSessionEvent'), 'Restoring placeholder does not create a report entry');

const key = 'advanceTerminal.v5.pinnedTerminalTabs';
const backing = new Map();
const localStorage = {
  getItem(k) { return backing.get(k) ?? null; },
  setItem(k, v) { backing.set(k, String(v)); }
};
const servers = [
  { id: 'local-1', name: 'My PowerShell', type: 'local', password: 'must-not-store' },
  { id: 'ssh-1', name: 'Remote server', type: 'remote', privateKeyPath: 'must-not-store-key' }
];
let n = 0;
const toasts = [];
const created = [];
const ctx = {
  Map, Array, String, Boolean, Promise, localStorage,
  state: { terminals: new Map(), settings: { servers }, closedTerminalTabs: [], activeTerminalId: null },
  randomId: () => `test-${++n}`,
  createTerminalPane(id, server, options) {
    assert.equal(options.restoredPinned, true, 'Restoration uses non-running placeholders');
    created.push(id);
    const session = {
      terminalId: id, server, status: 'disconnected', closed: true, hasConnected: false, restoredPinnedPlaceholder: true,
      term: { writes: [], writeln(text) { this.writes.push(text); } }
    };
    ctx.state.terminals.set(id, session);
    return session;
  },
  cleanupTerminalSessionResources(session) { session.cleaned = true; },
  activateTerminal(id) { ctx.state.activeTerminalId = id; },
  renderTerminalTabs() { ctx.renderCount++; },
  updateCurrentTabFooter() {},
  showToast(message) { toasts.push(message); },
  closeTerminalTabPicker() {},
  hideSidebarContextMenu() {},
  getConnectingTerminalSession() { return null; },
  selectServer() {},
  connectSelectedServer() { throw new Error('No connection should be attempted at startup'); },
  document: { createElement: () => ({ }), body: {} },
  renderCount: 0
};
vm.createContext(ctx);
vm.runInContext(logic, ctx);
const run = (expr) => vm.runInContext(expr, ctx);

const local = { terminalId: 'live-local', server: servers[0], closed: false, hasConnected: true };
const ssh = { terminalId: 'live-ssh', server: servers[1], closed: false, hasConnected: true };
ctx.state.terminals.set(local.terminalId, local);
ctx.state.terminals.set(ssh.terminalId, ssh);
assert.equal(run("setTerminalTabPinned('live-local', true)"), true);
assert.equal(run("setTerminalTabPinned('live-ssh', true)"), true);
assert.equal(JSON.parse(backing.get(key)).length, 2, 'Two pinned tabs saved');
const contents = backing.get(key);
assert(!contents.includes('must-not-store'), 'No secret-bearing fields persisted');
assert.deepEqual(Object.keys(JSON.parse(contents)[0]).sort(), ['color', 'serverId', 'title']);
run("setTerminalTabColor('live-local', '#ABCDEF')");
local.tabCustomTitle = 'Local test title';
assert.equal(run('persistPinnedTerminalTabs()'), true);
assert.equal(JSON.parse(backing.get(key))[0].color, '#abcdef');

// Simulate Electron renderer restart while preserving the isolated profile localStorage.
ctx.state.terminals = new Map();
ctx.state.activeTerminalId = null;
assert.equal(run('restorePinnedTerminalTabs()'), true);
assert.equal(ctx.state.terminals.size, 2, 'Both tabs are visible after restart');
for (const restored of ctx.state.terminals.values()) {
  assert.equal(restored.tabPinned, true);
  assert.equal(restored.closed, true, 'Restored tabs remain disconnected until user action');
  assert.equal(restored.hasConnected, false);
  assert.equal(restored.cleaned, true, 'Inactive PTY input listeners cleaned');
  assert(restored.term.writes[0].includes('Reconnect'), 'Restore message tells user how to reconnect');
}
assert.equal(ctx.state.activeTerminalId, created[0]);
assert.equal([...ctx.state.terminals.values()][0].tabCustomTitle, 'Local test title');
assert.equal([...ctx.state.terminals.values()][0].tabColor, '#abcdef');

const first = [...ctx.state.terminals.values()][0];
assert.equal(run(`setTerminalTabPinned('${first.terminalId}', false)`), true);
assert.equal(JSON.parse(backing.get(key)).length, 1, 'Unpin removes persisted entry');

// A broken or malicious local preference must not crash application startup.
backing.set(key, '{ invalid');
assert.equal(run('readPinnedTerminalTabs().length'), 0);
backing.set(key, JSON.stringify([{ serverId: 'deleted-server', title: 'orphan' }]));
ctx.state.terminals = new Map();
assert.equal(run('restorePinnedTerminalTabs()'), false, 'Removed connection is never re-created');

// Storage failures must not incorrectly claim successful persistence.
ctx.state.terminals.set('active', { terminalId: 'active', server: servers[0] });
localStorage.setItem = () => { throw new Error('storage blocked'); };
assert.equal(run("setTerminalTabPinned('active', true)"), true);
assert(toasts.at(-1).includes('could not be saved'), 'Persistence failures are surfaced');
console.log('PASS: pinned tabs persist, restore safely without auto-connecting, save title/color, unpin cleanly, omit secrets, and survive invalid storage.');
