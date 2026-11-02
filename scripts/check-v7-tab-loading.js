'use strict';
// Scoped regression checks. No settings, terminals, network, or profile changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/renderer/styles.css'), 'utf8');
const from = source.indexOf('const TERMINAL_PROCESS_COMPLETION_QUIET_MS =');
const to = source.indexOf('\nfunction setTerminalHeaderTitle(', from);
assert.ok(from > 0 && to > from, 'Terminal-state logic is present');
const stateSource = source.slice(from, to);
const classes = () => {
  const values = new Set();
  return { values, toggle(name, yes) { if (yes) values.add(name); else values.delete(name); }, contains(name) { return values.has(name); } };
};
function button(action) {
  return { disabled: false, dataset: { terminalAction: action, defaultTitle: action }, classList: classes(), title: action, setAttribute(k, v) { this[k] = v; } };
}
function tab(id) {
  const indicator = { setAttribute(k, v) { this[k] = v; } };
  return { dataset: { terminalId: id }, classList: classes(), title: '', setAttribute(k, v) { this[k] = v; }, querySelector(q) { return q === '.terminal-tab-work-indicator' ? indicator : null; } };
}
const tabs = { children: [tab('one'), tab('two')] };
const toolbar = ['paste', 'copyAll', 'copySelection', 'clear', 'ctrlC', 'closeSession', 'sendText'].map(button);
const sessions = new Map();
const first = { terminalId: 'one', server: { type: 'local', name: 'PowerShell' }, status: 'connected', closed: false };
const second = { terminalId: 'two', server: { type: 'local', name: 'CMD' }, status: 'connected', closed: false };
sessions.set(first.terminalId, first);
sessions.set(second.terminalId, second);
const state = { terminals: sessions, activeTerminalId: 'one', terminalActionInFlightSessionIds: new Set(), connectionAttemptInFlight: false, connectionHealthCheckInFlight: null };
const notices = [];
let forcedFocus = 0;
const timers = new Map();
let nextTimerId = 1;
function flushTimers() {
  for (const [id, fn] of Array.from(timers.entries())) { timers.delete(id); fn(); }
}
const ctxt = {
  state,
  window: { advanceTerminal: { notifyTerminalActivityComplete: () => {} } },
  $: selector => selector === '#terminal-tabs' ? tabs : null,
  $$: selector => selector === '.terminal-action-button' ? toolbar : [],
  getTerminalTabTitle: s => s.server.name,
  syncV7CommandComposer: () => {},
  showToast: message => notices.push(message),
  focusTerminal: () => { forcedFocus += 1; },
  activateTerminalAndFocus: () => { forcedFocus += 1; },
  clearTimeout: (id) => { timers.delete(id); },
  setTimeout: (fn) => { const id = nextTimerId++; timers.set(id, fn); return id; },
  stripTerminalControlText: text => String(text).replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, ''),
  Date,
  Set,
  Array,
  String,
  Boolean,
};
vm.createContext(ctxt);
vm.runInContext(stateSource, ctxt, { filename: 'terminal-state.js' });
const check = action => toolbar.find(b => b.dataset.terminalAction === action);
ctxt.setTerminalProcessBusy(first, true, 'Running');
assert.ok(tabs.children[0].classList.contains('is-working'), 'Active command shows spinner');
assert.ok(!tabs.children[1].classList.contains('is-working'), 'Other tab remains idle');
assert.equal(check('paste').disabled, false, 'Paste remains available when shell runs');
assert.equal(check('copyAll').disabled, false, 'Copy remains available when shell runs');
assert.equal(check('clear').disabled, false, 'Clear remains available when shell runs');
ctxt.maybeReleaseTerminalProcessBusy(first, 'PS E:\\Projects\\Advanced');
assert.equal(first.processBusy, true, 'Incomplete prompt does not end progress');
ctxt.maybeReleaseTerminalProcessBusy(first, ' Terminal> ');
assert.equal(first.processBusy, true, 'Prompt requires a stable quiet window before declaring completion');
assert.equal(timers.size, 1, 'A single completion-check timer is scheduled');
flushTimers();
assert.equal(first.processBusy, false, 'A stable split prompt clears activity after the quiet window');
assert.equal(tabs.children[0].classList.contains('is-working'), false, 'Spinner stops on ready');
first.status = 'connecting';
ctxt.updateTerminalTabWorkingIndicator(first);
ctxt.updateTerminalInteractionState();
assert.equal(check('paste').disabled, true, 'No input sent while connecting');
assert.equal(check('copyAll').disabled, false, 'Copy remains available while connecting');
assert.ok(tabs.children[0].classList.contains('is-working'), 'Connection displays activity');
state.activeTerminalId = 'two';
ctxt.updateTerminalInteractionState();
assert.equal(check('paste').disabled, false, 'Switching tabs frees actions immediately');
ctxt.showConnectionAttemptBusyNotification(first, second.server);
assert.equal(forcedFocus, 0, 'Background connection never steals tab focus');
state.terminalActionInFlightSessionIds.add('one');
ctxt.updateTerminalInteractionState();
assert.equal(check('paste').disabled, false, 'Pending action in other tab cannot lock active tab');
state.activeTerminalId = 'one';
ctxt.updateTerminalInteractionState();
assert.equal(check('paste').disabled, true, 'Pending same-tab action protected');
first.status = 'connected';
ctxt.updateTerminalTabWorkingIndicator(first);
state.terminalActionInFlightSessionIds.clear();
ctxt.updateTerminalInteractionState();
assert.equal(check('paste').disabled, false, 'Connected idle session unlocks');
assert.ok(/\.terminal-tab\.is-working\s+\.terminal-tab-work-indicator/.test(css), 'CSS animates only working tab');
assert.ok(css.includes('prefers-reduced-motion'), 'Reduced motion respected');
assert.ok(source.includes("inner.appendChild(workingIndicator);"), 'Spinner node added to every tab');
assert.ok(source.includes("state.activeTerminalId !== session.terminalId || state.activeView !== 'terminal'"), 'Background connection cannot steal view');
assert.ok(source.includes('state.activeTerminalId === terminalId && state.activeView === \'terminal\''), 'Active pane focus skips expensive reactivation');
assert.ok(!source.includes('const activeProcessing = isTerminalSessionProcessing(activeSession) || state.terminalActionInFlight;'), 'Global action lock removed');
// Integration-level behavior for an async toolbar action on two different tabs.
// A still-pending paste/command in tab one must never disable tab two.
ctxt.normalizeTerminalToolbarAction = action => action;
ctxt.setActiveView = () => {};
ctxt.clearActiveTerminal = () => true;
ctxt.copyAllActiveTerminal = async () => true;
ctxt.copySelectedTerminalText = async () => true;
ctxt.pasteClipboardToTerminal = async () => true;
ctxt.sendControlToActiveTerminal = () => true;
ctxt.closeTerminalSession = () => true;
const pending = new Map();
ctxt.sendCommandToActiveTerminal = () => new Promise(resolve => pending.set(state.activeTerminalId, resolve));
const a = source.indexOf('async function executeTerminalToolbarAction(');
const b = source.indexOf('\nfunction renderTerminalActionIconPicker(', a);
assert.ok(a >= 0 && b > a, 'Toolbar action function located');
vm.runInContext(source.slice(a, b), ctxt);
// Connection completion should not switch the foreground tab or screen.
ctxt.closeAddConnectionModal = () => {};
let tabActivations = 0;
ctxt.activateTerminal = () => { tabActivations += 1; };
ctxt.requestAnimationFrame = () => {};
ctxt.fitActiveTerminal = () => {};
const showStart = source.indexOf('function showTerminalSession(');
const showEnd = source.indexOf('\nfunction setupConnectionSubtitleMarquee(', showStart);
assert.ok(showStart > 0 && showEnd > showStart);
vm.runInContext(source.slice(showStart, showEnd), ctxt);
state.activeTerminalId = 'two';
state.activeView = 'terminal';
ctxt.showTerminalSession(first);
assert.equal(tabActivations, 0, 'Background session cannot activate tab');
state.activeView = 'settings';
ctxt.showTerminalSession(second);
assert.equal(tabActivations, 0, 'Background connection cannot navigate away from Settings');
state.activeView = 'terminal';
ctxt.showTerminalSession(second);
assert.equal(tabActivations, 1, 'Foreground session can refresh its tab');
(async () => {
  first.status = 'connected';
  state.activeTerminalId = 'one';
  const promiseOne = ctxt.executeTerminalToolbarAction({action: 'sendText', text: 'test', name: 'Test'});
  assert.ok(state.terminalActionInFlightSessionIds.has('one'));
  state.activeTerminalId = 'two';
  ctxt.updateTerminalInteractionState();
  assert.equal(check('paste').disabled, false, 'Another tab stays available while first action pending');
  const promiseTwo = ctxt.executeTerminalToolbarAction({action: 'sendText', text: 'test2', name: 'Test2'});
  assert.ok(state.terminalActionInFlightSessionIds.has('two'));
  pending.get('one')(true);
  assert.equal(await promiseOne, true);
  assert.equal(state.terminalActionInFlightSessionIds.has('two'), true, 'First action ending does not clear second action');
  pending.get('two')(true);
  assert.equal(await promiseTwo, true);
  assert.equal(state.terminalActionInFlightSessionIds.size, 0);
  console.log('PASS: Per-tab spinner, split prompts, safe action permissions, asynchronous tab isolation, focus preservation, reduced-motion CSS.');
})().catch(error => { console.error(error); process.exitCode = 1; });
