'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createProcessCompletionNotifier } = require('../src/main/process-notifications');

const appRoot = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(appRoot, 'src/main/main.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(appRoot, 'src/main/preload.js'), 'utf8');
const rendererSource = fs.readFileSync(path.join(appRoot, 'src/renderer/renderer.js'), 'utf8');

for (const str of [
  "app.setAppUserModelId('com.artliedigital.advanceterminal')",
  "ipcMain.on('terminal:activity-complete'",
  'createProcessCompletionNotifier({',
]) assert(mainSource.includes(str), `Missing main process hook: ${str}`);
for (const str of [
  "ipcRenderer.send('terminal:activity-complete', payload)",
  "ipcRenderer.on('terminal:notification-open', listener)",
]) assert(preloadSource.includes(str), `Missing preload hook: ${str}`);
for (const str of [
  "notifyTerminalProcessCompleted(session, 'shell-marker')",
  "notifyTerminalProcessCompleted(session, 'prompt-quiet')",
  'activateTerminalAndFocus(terminalId);',
  "window.advanceTerminal.onTerminalNotificationOpen?.((payload) => {",
]) assert(rendererSource.includes(str), `Missing renderer hook: ${str}`);

function makeHarness() {
  const notices = [];
  class MockNotification {
    constructor(options) {
      this.options = options;
      this.handlers = {};
      notices.push(this);
    }
    static isSupported() { return true; }
    on(name, callback) { this.handlers[name] = callback; return this; }
    show() { this.shown = true; }
  }
  const messages = [];
  const calls = [];
  const webContents = { send: (...args) => messages.push(args), isDestroyed: () => false };
  const win = {
    webContents,
    minimized: false,
    focused: false,
    visible: true,
    isDestroyed: () => false,
    isMinimized() { return this.minimized; },
    isFocused() { return this.focused; },
    isVisible() { return this.visible; },
    restore() { calls.push('restore'); this.minimized = false; },
    show() { calls.push('show'); this.visible = true; },
    focus() { calls.push('focus'); this.focused = true; }
  };
  const event = { sender: webContents };
  const sessions = new Map([
    ['session1', { type: 'remote', serverName: 'Production SSH', sender: webContents, status: 'connected' }],
    ['local1', { type: 'local', serverName: 'PowerShell', sender: webContents, status: 'connected' }],
  ]);
  const build = (platform = 'win32', overrides = {}) => createProcessCompletionNotifier({
    Notification: MockNotification,
    getWindowFromEvent: () => win,
    getMainWindow: () => win,
    terminalManager: { sessions },
    platform,
    ...overrides,
  });
  return { notices, messages, calls, win, event, sessions, build };
}

{
  const h = makeHarness();
  const handle = h.build();
  h.win.focused = true;
  assert.equal(handle(h.event, {terminalId:'session1',runId:1,source:'shell-marker'}), false, 'Foreground notification blocked');
  assert.equal(h.notices.length, 0);
  h.win.focused = false;
  assert.equal(handle(h.event, {terminalId:'session1',runId:1,source:'shell-marker'}), true);
  assert.equal(h.notices.length, 1);
  assert.equal(h.notices[0].options.title, 'Command finished');
  assert.equal(h.notices[0].options.body, 'SSH session: Production SSH');
  assert.equal(h.notices[0].options.silent, true);
  assert.equal(h.notices[0].shown, true);
  assert.equal(handle(h.event, {terminalId:'session1',runId:1,source:'shell-marker'}), false, 'Duplicate must be ignored');
  assert.equal(handle(h.event, {terminalId:'session1',runId:0,source:'shell-marker'}), false);
  assert.equal(handle(h.event, {terminalId:'session1',runId:2,source:'unverified'}), false);
  assert.equal(handle({sender:{}}, {terminalId:'session1',runId:2,source:'shell-marker'}), false, 'Foreign event sender must be ignored');
  assert.equal(handle(h.event, {terminalId:'removed',runId:2,source:'shell-marker'}), false, 'Unknown session must be ignored');
  h.win.minimized = true;
  h.win.visible = false;
  h.notices[0].handlers.click();
  assert.deepEqual(h.calls, ['restore','show','focus']);
  assert.deepEqual(h.messages, [['terminal:notification-open', {terminalId:'session1'}]]);
  assert.equal(handle(h.event, {terminalId:'local1',runId:1,source:'prompt-quiet'}), false, 'Focused app should suppress notification');
  h.win.focused = false;
  assert.equal(handle(h.event, {terminalId:'local1',runId:1,source:'prompt-quiet'}), true);
  assert.equal(h.notices[1].options.title, 'Command appears finished');
  assert.equal(h.notices[1].options.body, 'Local terminal: PowerShell');
  h.sessions.delete('session1');
  assert.equal(handle(h.event, {terminalId:'session1',runId:2,source:'shell-marker'}), false, 'Closed session ignored');
}
{
  const h = makeHarness();
  const handle = h.build('linux');
  assert.equal(handle(h.event, {terminalId:'session1',runId:1,source:'shell-marker'}), false);
  assert.equal(h.notices.length, 0);
}
{
  const h = makeHarness();
  const bad = h.build('win32', {Notification: {isSupported: () => false}});
  assert.equal(bad(h.event, {terminalId:'session1',runId:1,source:'shell-marker'}), false);
  h.win.minimized = true;
  h.win.focused = true;
  const handle = h.build();
  assert.equal(handle(h.event, {terminalId:'session1',runId:1,source:'shell-marker'}), true, 'Minimized always counts as background');
}

// Exercise the actual renderer state machine in isolation: prompt debounce,
// subsequent output invalidation, shell marker, and no notification on exits.
{
  const start = rendererSource.indexOf('function notifyTerminalProcessCompleted(');
  const end = rendererSource.indexOf('function guardTerminalAction(', start);
  assert(start > 0 && end > start);
  const submitted = [];
  const timers = [];
  const session = {terminalId:'session1', closed:false, processBusy:false, processActivityGeneration:0};
  const context = {
    state: {terminals: new Map([['session1',session]])},
    window: {advanceTerminal: {notifyTerminalActivityComplete: (data) => submitted.push(data)}},
    updateTerminalTabWorkingIndicator: () => {},
    updateTerminalInteractionState: () => {},
    stripTerminalControlText: (s) => String(s).replace(/\x1b\[[0-9;]*m/g, ''),
    setTimeout(fn, _ms) {const record={fn, active:true}; timers.push(record); return record;},
    clearTimeout(record) {if (record) record.active = false;},
    Date,
    TERMINAL_PROCESS_COMPLETION_QUIET_MS: 900
  };
  vm.runInNewContext(`${rendererSource.slice(start,end)}\nthis.busy = setTerminalProcessBusy;this.output = maybeReleaseTerminalProcessBusy;`,context);
  context.busy(session,true);
  assert.equal(session.processCompletionSequence,1);
  context.output(session,'PS C:\\Work> ');
  assert.equal(timers.length,1);
  assert.equal(submitted.length,0);
  context.output(session,'still running\r\n');
  assert.equal(timers[0].active,false,'New output invalidates previous prompt candidate');
  timers[0].fn();
  assert.equal(session.processBusy,true,'Later output must invalidate the old prompt candidate');
  context.output(session,'PS C:\\Work> ');
  assert.equal(timers[2].active,true,'Latest output creates the candidate to verify');
  timers[2].fn();
  assert.equal(session.processBusy,false);
  assert.equal(submitted.length,1);
  assert.equal(submitted[0].source,'prompt-quiet');
  assert.equal(submitted[0].runId,1);
  context.busy(session,true);
  assert.equal(session.processCompletionSequence,2);
  context.output(session,'\x1b]133;D\x07');
  assert.equal(session.processBusy,false);
  assert.equal(submitted.length,2);
  assert.equal(submitted[1].source,'shell-marker');
  context.busy(session,true);
  context.busy(session,false); // terminal exit/cancellation is not completion
  assert.equal(submitted.length,2);
}

console.log('PASS: V7 native background notifications, focus guards, one-per-command, tab-click routing and renderer completion detection');
