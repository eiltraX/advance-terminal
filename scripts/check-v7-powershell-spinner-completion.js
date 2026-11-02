'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
const start = src.indexOf('function terminalOutputLooksReady(data) {');
const end = src.indexOf('function guardTerminalAction(', start);
assert(start > 0 && end > start, 'completion handler functions not found');
let callback = null;
const notifications = [];
const timers = [];
const state = { terminals: new Map() };
const context = {
  state,
  TERMINAL_PROCESS_COMPLETION_QUIET_MS: 900,
  stripTerminalControlText: (v) => String(v || '').replace(/\r\n|\r/g, '\n').replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\x1b[@-_]/g, ''),
  clearTimeout(id) { if (id) id.cancelled = true; },
  setTimeout(fn, ms) { assert.equal(ms, 900); callback = { fn, cancelled: false }; timers.push(callback); return callback; },
  setTerminalProcessBusy(session, busy) { session.processBusy = busy; session.processOutputTail = ''; session.processActivityGeneration++; },
  notifyTerminalProcessCompleted(session, source) { notifications.push({ id: session.terminalId, source }); }
};
vm.createContext(context);
vm.runInContext(src.slice(start, end), context);
const call = (name, ...args) => vm.runInContext(name, context)(...args);
function session(type = 'local', shell = 'powershell.exe') {
  const s = { terminalId: `t${state.terminals.size}`, server: { type, shell }, processBusy: true, processCompletionSequence: 1, processActivityGeneration: 1, processOutputTail: '', closed: false };
  const buffer = { baseY: 0, cursorY: 0, cursorX: 29, getLine: () => ({ translateToString: () => 'PS E:\\Projects\\Advance Terminal> ' }) };
  buffer.cursorX = 'PS E:\\Projects\\Advance Terminal> '.length;
  s.term = { buffer: { active: buffer } };
  state.terminals.set(s.terminalId, s);
  return s;
}
function flush() { assert(callback && !callback.cancelled, 'a quiet check should be scheduled'); const t = callback; t.fn(); }
// Normal local prompt detection remains operational.
const normal = session();
call('maybeReleaseTerminalProcessBusy', normal, '\r\nPS E:\\Projects\\Advance Terminal> ');
flush();
assert.equal(normal.processBusy, false);
// Output with a split ANSI control sequence can be visibly complete in xterm
// while the raw IPC tail no longer matches the prompt parser.
const ansi = session();
call('maybeReleaseTerminalProcessBusy', ansi, '\r\nPS E:\\Projects\\Advance Terminal> \x1b]0;incomplete');
flush();
assert.equal(ansi.processBusy, false, 'visible local prompt should release busy');
// Quiet output without a prompt never marks completion.
const silent = session();
silent.term.buffer.active.getLine = () => ({ translateToString: () => 'still compiling...' });
call('maybeReleaseTerminalProcessBusy', silent, 'build started\n');
flush();
assert.equal(silent.processBusy, true);
// A rendered SSH prompt cannot trigger the PowerShell-only fallback.
const ssh = session('remote', '/bin/bash');
call('maybeReleaseTerminalProcessBusy', ssh, 'reading remote output\n');
flush();
assert.equal(ssh.processBusy, true);
// Further output invalidates the pending prompt candidate.
const streaming = session();
call('maybeReleaseTerminalProcessBusy', streaming, 'PS E:\\Projects\\Advance Terminal> ');
const older = callback;
call('maybeReleaseTerminalProcessBusy', streaming, 'still working\n');
assert.equal(older.cancelled, true);
older.fn();
assert.equal(streaming.processBusy, true);
streaming.term.buffer.active.getLine = () => ({ translateToString: () => 'still working' });
flush();
assert.equal(streaming.processBusy, true);
assert.equal(notifications.length, 2, 'only confirmed completion candidates may notify');
assert.deepEqual(notifications.map(n => n.source), ['prompt-quiet', 'prompt-quiet']);
console.log('PASS: PowerShell rendered-prompt fallback, normal prompt, active process, SSH guard, stale output cancellation, single notifications');
