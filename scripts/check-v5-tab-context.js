'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const renderer = fs.readFileSync(path.resolve(__dirname, '../src/renderer/renderer.js'), 'utf8');
const css = fs.readFileSync(path.resolve(__dirname, '../src/renderer/styles.css'), 'utf8');
function between(start, end) {
  const a = renderer.indexOf(start);
  const b = renderer.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `Missing renderer boundaries: ${start}`);
  return renderer.slice(a, b);
}
const logic = between('// v5 tab metadata:', 'function renderTerminalTabs()');
assert(!/saveSettings\s*\(|setInterval\s*\(/.test(logic), 'Menu must not mutate settings or add polling timers');
assert(logic.includes('PINNED_TERMINAL_TABS_STORAGE_KEY'), 'Pin persistence storage key must exist');
assert(!/password\s*[:=]|privateKey\s*[:=]|passphrase\s*[:=]/.test(logic), 'No authentication data in tab snapshots');
assert(renderer.includes("tab.addEventListener('contextmenu'"), 'Right click handler installed on tabs');
assert(renderer.includes("if (session.tabPinned && !force)"), 'Close guard blocks pinned tabs');
assert(renderer.includes("case 'closeSession':\n        return closeTerminalSession(null, { force: true });"), 'Explicit terminal action must close pinned tab');
assert(renderer.includes("$('#tool-close-terminal')?.addEventListener('click', () => closeTerminalSession(null, { force: true }));"), 'Toolbar close must close pinned tab');
assert(renderer.includes("terminalTabMenuButton('Close Tab', () => closeTerminalSession(terminalId, { force: true }), false, true)"), 'Legacy context Close must work while pinned');
assert(renderer.includes('if (remember) rememberClosedTerminalTab(session)'), 'Close history is populated');
assert(renderer.includes('session.tabPinned ? \' is-pinned\''), 'Render pinned state');
assert(css.includes('.terminal-tab-context-menu'), 'Menu CSS available');
assert(css.includes('.terminal-tab-rename-overlay'), 'Rename modal CSS available');
assert(css.includes('.terminal-tab.has-custom-color'), 'Custom color CSS available');

function element(tag = 'div') {
  return {
    tag, className: '', children: [], events: {}, dataset: {}, disabled: false, style: {},
    textContent: '', value: '', isConnected: true,
    setAttribute(k, v) { this[k] = v; },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    addEventListener(kind, fn) { this.events[kind] = fn; },
    remove() { this.removed = true; },
    contains(target) { return this === target || this.children.some(child => child.contains?.(target)); },
    getBoundingClientRect() { return { width: 250, height: 300 }; },
    querySelector(selector) { return this.children.find(child => child.tag === 'button' && !child.disabled) || null; },
    focus() { this.focused = true; }, select() { this.selected = true; }
  };
}
const mockLocalStorage = new Map();
const localStorage = {getItem(key) {return mockLocalStorage.get(key) ?? null;}, setItem(key,val) {mockLocalStorage.set(key, val);}};
const toastMessages = [];
const closures = [];
const state = {
  terminals: new Map(), closedTerminalTabs: [], settings: { servers: [{ id: 'saved-1', type: 'local', name: 'PowerShell' }] },
  activeTerminalId: 't1', connectionAttemptInFlight: false
};
const ctx = {
  state, Map, Array, String, Promise, Boolean, localStorage,
  document: { createElement: element, body: element('body') },
  window: { innerWidth: 800, innerHeight: 600 },
  requestAnimationFrame: (fn) => fn(),
  renderTerminalTabs: () => { ctx.renders++; },
  updateCurrentTabFooter: () => {},
  showToast: (message) => toastMessages.push(message),
  closeTerminalTabPicker: () => {}, hideSidebarContextMenu: () => {},
  getConnectingTerminalSession: () => null,
  selectServer: () => {},
  connectSelectedServer: async () => {
    const id = `fresh-${++ctx.nextId}`;
    const session = { terminalId: id, server: state.settings.servers[0], hasConnected: true, closed: false };
    state.terminals.set(id, session); state.activeTerminalId = id;
  },
  closeTerminalSession: (id) => { closures.push(id); state.terminals.delete(id); return true; },
  renders: 0, nextId: 0
};
vm.createContext(ctx);
vm.runInContext(logic, ctx);
const run = expr => vm.runInContext(expr, ctx);
const newSession = (id, properties = {}) => ({ terminalId: id, server: state.settings.servers[0], hasConnected: true, closed: false, ...properties });

(async () => {
  assert.equal(run("normalizeTerminalTabColor('#A1B2C3')"), '#a1b2c3');
  assert.equal(run("normalizeTerminalTabColor('url(javascript:...)')"), '');
  assert.equal(run("normalizeTerminalTabTitle(' test\\u0000 A ' )"), 'test  A');
  const first = newSession('t1');
  const second = newSession('t2');
  const third = newSession('t3');
  state.terminals = new Map([['t1', first], ['t2', second], ['t3', third]]);
  assert.equal(run("setTerminalTabPinned('t2',true)"), true);
  assert.equal(JSON.parse(mockLocalStorage.get('advanceTerminal.v5.pinnedTerminalTabs')).length, 1, 'Pin persisted immediately');
  assert.deepEqual([...state.terminals.keys()], ['t2', 't1', 't3'], 'Pinned tab goes first');
  assert.equal(run("setTerminalTabColor('t2','#AABBCC')"), true);
  assert.equal(second.tabColor, '#aabbcc');
  assert.equal(run("closeOtherTerminalTabs('t1')"), 1, 'Pinned tab must remain');
  assert.deepEqual(closures, ['t3']);
  closures.length = 0;
  state.terminals.set('t3', third);
  assert.equal(run("closeTerminalTabsToRight('t2')"), 2, 'Closes only unpinned tabs to the right');
  assert.deepEqual(closures, ['t1', 't3']);
  closures.length = 0;
  state.terminals = new Map([['t2', second]]);
  run('rememberClosedTerminalTab(state.terminals.get("t2"))');
  assert.equal(state.closedTerminalTabs.length, 1);
  assert.deepEqual(Object.keys(state.closedTerminalTabs[0]).sort(), ['color', 'serverId', 'title']);
  second.tabCustomTitle = 'Edited Tab';
  const cloned = await run('duplicateTerminalTab("t2")');
  assert.equal(cloned, true);
  const fresh = [...state.terminals.values()].find(s => s.terminalId !== 't2');
  assert.equal(fresh.tabCustomTitle, 'Edited Tab');
  assert.equal(fresh.tabPinned, undefined, 'Duplicate must not clone pin ownership');
  assert.equal(state.closedTerminalTabs.length, 1, 'Duplicating does not consume closed-tab history');
  assert.equal(await run('reopenLastClosedTerminalTab()'), true);
  assert.equal(state.closedTerminalTabs.length, 0);
  // Reconnect must replace, not clone, and must not automatically bypass normal connection flow.
  second.closed = true;
  second.tabPinned = true;
  assert.equal(await run('reconnectTerminalTab("t2")'), true);
  assert.equal(closures.at(-1), 't2');
  assert.equal([...state.terminals.values()].filter(s => s.tabPinned).length, 1);
  const pinned = [...state.terminals.values()].find(s => s.tabPinned);
  // Context menu button availability and position.
  run(`showTerminalTabContextMenu('${pinned.terminalId}',795,595)`);
  const menu = ctx.document.body.children.at(-1);
  assert.equal(menu.className, 'terminal-tab-context-menu');
  assert.equal(menu.style.left, '542px');
  assert.equal(menu.style.top, '292px');
  assert(menu.children.some(c => c.textContent === 'Close Tab' && !c.disabled), 'Pinned close must be enabled in legacy context menu');
  assert(menu.children.some(c => c.textContent === 'Reconnect' && c.disabled));
  const rename = menu.children.find(c => c.textContent === 'Rename Tab');
  rename.events.click();
  await Promise.resolve();
  const overlay = ctx.document.body.children.at(-1);
  assert.equal(overlay.className, 'terminal-tab-rename-overlay');
  const dialog = overlay.children[0];
  const label = dialog.children[0];
  const input = label.children[0];
  input.value = 'Safe title';
  input.events.keydown({ key: 'Enter', preventDefault(){}, stopPropagation(){} });
  assert.equal(pinned.tabCustomTitle, 'Safe title');
  assert.equal(overlay.removed, true);
  // Exercise the real v5 close function to catch tab-focus and pinned-session regressions.
  const pinnedClose = { ...newSession('pin'), tabPinned: true, term: { dispose() {} }, pane: { remove() {} } };
  const activeClose = { ...newSession('active'), term: { dispose() {} }, pane: { remove() {} } };
  const secondaryClose = { ...newSession('secondary'), term: { dispose() {} }, pane: { remove() {} } };
  const closedIds = [];
  const storedPinnedSnapshots = [];
  const closeCtx = {
    state: { terminals: new Map([['pin', pinnedClose], ['active', activeClose], ['secondary', secondaryClose]]), activeTerminalId: 'active' },
    window: { advanceTerminal: { closeTerminal({ terminalId }) { closedIds.push(terminalId); } } },
    showToast: msg => toastMessages.push(msg),
    rememberClosedTerminalTab: () => {}, closeTerminalTabContextMenu: () => {},
    persistPinnedTerminalTabs: () => { storedPinnedSnapshots.push([...closeCtx.state.terminals.values()].filter(s => s.tabPinned).map(s => s.terminalId)); return true; },
    v7ComposerDrafts: new Map(), updateTerminalTabNavigationButtons: () => {}, syncV7CommandComposer: () => {},
    cleanupTerminalSessionResources: () => {}, moveActiveSessionToHistory: () => {},
    recordSessionEvent: () => {}, setTerminalStatus: () => {},
    activateTerminal: id => { closeCtx.activated.push(id); },
    renderTerminalTabs: () => {}, updateCurrentTabFooter: () => {},
    updateTerminalLocationHeader: () => {}, closeTerminalSearch: () => {},
    setTerminalHeaderTitle: () => {},
    $: () => ({ classList: { remove: () => {} } }),
    activated: [], Array
  };
  vm.createContext(closeCtx);
  vm.runInContext(between('function closeTerminalSession(', 'function getActiveTerminalSession('), closeCtx);
  assert.equal(vm.runInContext("closeTerminalSession('pin')", closeCtx), false, 'Pinned tab must reject close');
  assert.equal(closedIds.length, 0, 'Pinned tab must not close PTY');
  assert.equal(vm.runInContext("closeTerminalSession('secondary')", closeCtx), true);
  assert.equal(closeCtx.state.activeTerminalId, 'active', 'Closing background tab must not switch focus');
  assert.deepEqual(closedIds, ['secondary']);
  assert.equal(vm.runInContext("closeTerminalSession('active')", closeCtx), true);
  assert.equal(closeCtx.state.activeTerminalId, 'pin', 'Choose remaining tab when active tab closes');
  assert.equal(vm.runInContext("closeTerminalSession('pin',{force:true, remember:false})", closeCtx), true, 'Explicit internal force for reconnect');
  assert.deepEqual(closedIds, ['secondary', 'active', 'pin']);
  assert.deepEqual(storedPinnedSnapshots.at(-1), [], 'Closed pinned tab must be removed from next-startup restore metadata');
  console.log('PASS: v5 context actions, explicit pinned close, persisted restore cleanup, safe reopened/duplicated tabs, color/name and rename.');
})().catch(e => { console.error(e); process.exitCode=1; });
