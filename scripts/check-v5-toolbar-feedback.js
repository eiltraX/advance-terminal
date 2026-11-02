const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/renderer/styles.css'), 'utf8');

function between(start, end) {
  const first = renderer.indexOf(start);
  const last = renderer.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Expected v5 renderer section: ${start}`);
  return renderer.slice(first, last);
}

assert(css.includes('.dynamic-terminal-action.is-action-confirmed .tool-icon::after'));
assert(css.includes('terminal-action-confirm-pop'));
assert(css.includes('prefers-reduced-motion: reduce'));
assert(!between('// Transient visual feedback only.', 'function renderTerminalToolbarActions()').includes('saveSettings('), 'Feedback must never persist to settings');

class Classes {
  constructor() { this.items = new Set(); }
  add(name) { this.items.add(name); }
  remove(name) { this.items.delete(name); }
  toggle(name, on) { on ? this.add(name) : this.remove(name); }
  contains(name) { return this.items.has(name); }
}

const toolbar = { innerHTML: '', children: [], appendChild(button) { this.children.push(button); } };
const fakeTimers = [];
const blockedCalls = [];
let actionResult = true;
const ctx = {
  Map, String, Array, Boolean,
  state: { settings: { terminalActions: [{ id: 'copy-1', name: 'Copy', action: 'copyAll', icon: 'copy', enabled: true }] }, activeTerminalId: 't1', terminals: new Map([['t1', {}]]), terminalActionInFlight: false },
  $: () => toolbar,
  $$: () => toolbar.children,
  document: {
    createElement: () => ({
      className: '', classList: new Classes(), dataset: {},
      innerHTML: '',
      querySelector: () => ({ textContent: '' }),
      addEventListener(event, handler) { this.handlers = this.handlers || {}; this.handlers[event] = handler; }
    })
  },
  getTerminalToolbarActions: () => ctx.state.settings.terminalActions,
  normalizeTerminalToolbarAction: (a) => a,
  terminalActionIconSvg: () => '<svg></svg>',
  terminalActionAllowedWhileProcessing: () => false,
  guardTerminalAction: () => !blockedCalls.length,
  clearActiveTerminal: () => actionResult,
  copyAllActiveTerminal: async () => actionResult,
  copySelectedTerminalText: async () => actionResult,
  pasteClipboardToTerminal: async () => actionResult,
  sendControlToActiveTerminal: () => actionResult,
  closeTerminalSession: () => actionResult,
  sendCommandToActiveTerminal: async () => actionResult,
  showToast: () => {},
  updateTerminalInteractionState: () => {},
  setTimeout(handler, milliseconds) { const handle = { handler, milliseconds, cleared: false }; fakeTimers.push(handle); return handle; },
  clearTimeout(handle) { handle.cleared = true; }
};

vm.createContext(ctx);
vm.runInContext([
  between('const terminalActionFeedback = new Map();', 'function renderTerminalToolbarActions()'),
  between('function renderTerminalToolbarActions() {', 'function renderTerminalActionIconPicker(')
].join('\n'), ctx);

const waitMicrotasks = () => new Promise((resolve) => setImmediate(resolve));
const render = () => { toolbar.children = []; vm.runInContext('renderTerminalToolbarActions()', ctx); return toolbar.children[0]; };

(async () => {
  let button = render();
  assert.equal(button.dataset.terminalActionId, 'copy-1');
  button.handlers.click();
  await waitMicrotasks();
  assert(button.classList.contains('is-action-confirmed'), 'Success should show checkmark');
  assert.equal(ctx.state.terminalActionInFlight, false, 'Do not leave toolbar action locked');
  assert.equal(fakeTimers.at(-1).milliseconds, 1700);

  const firstTimer = fakeTimers.at(-1);
  button = render();
  assert(button.classList.contains('is-action-confirmed'), 'Feedback must survive a toolbar re-render');
  button.handlers.click();
  await waitMicrotasks();
  assert(firstTimer.cleared, 'A repeated click should restart the acknowledgement timer');
  firstTimer.handler();
  assert(button.classList.contains('is-action-confirmed'), 'An expired older timer must not clear newer feedback');
  fakeTimers.at(-1).handler();
  assert(!button.classList.contains('is-action-confirmed'), 'Feedback should disappear after timeout');

  actionResult = false;
  button.handlers.click();
  await waitMicrotasks();
  assert(!button.classList.contains('is-action-confirmed'), 'A cancelled/failed action must not show success');

  actionResult = true;
  blockedCalls.push(true);
  button.handlers.click();
  await waitMicrotasks();
  assert(!button.classList.contains('is-action-confirmed'), 'Blocked action must not show success');
  blockedCalls.pop();

  // Test all supported actions return status without changing how they are dispatched.
  for (const action of ['clear', 'copyAll', 'copySelection', 'paste', 'ctrlC', 'ctrlL', 'ctrlD', 'closeSession', 'sendText']) {
    ctx.state.settings.terminalActions[0].action = action;
    const next = render();
    next.handlers.click();
    await waitMicrotasks();
    assert(next.classList.contains('is-action-confirmed'), `${action} should show success on true result`);
    fakeTimers.at(-1).handler();
  }

  console.log('PASS: v5 toolbar checkmark, expiry, redraw, blocked/cancelled handling, and all 9 action types.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
