'use strict';
// Isolated per-session behavior tests. No real shell, network, settings, or secrets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/renderer/v7-minimal-shell.css'), 'utf8');
const from = js.indexOf('const TERMINAL_PROCESS_COMPLETION_QUIET_MS =');
const end = js.indexOf('\nfunction guardTerminalAction(', from);
assert(from > 0 && end > from, 'Activity detector source is present');
assert(!js.slice(from,end).includes('60 * 60 * 1000'), 'Never clear running status after one hour');
const scheduled = new Map();
const canceled = new Set();
let id = 0;
const classes = () => {
  const set = new Set();
  return { contains: (s) => set.has(s), toggle: (s, value) => value ? set.add(s) : set.delete(s) };
};
function makeRow(id) {
  const attr = {};
  const subtitle = { textContent: '' };
  return {
    dataset: { terminalId: id }, classList: classes(), attrs: attr,
    setAttribute(name, value) { attr[name] = value; },
    querySelector(query) { return query === '.v7-session-name small' ? subtitle : null; },
    subtitle
  };
}
const activeRow = makeRow('active');
const backgroundRow = makeRow('background');
const rows = {children: [activeRow, backgroundRow]};
const sessions = new Map();
const active = {terminalId:'active', server:{type:'local',name:'PowerShell'}, status:'connected', closed:false, processBusy:false};
const background = {terminalId:'background', server:{type:'remote',name:'Remote SSH'}, status:'connected', closed:false, processBusy:false};
sessions.set('active', active); sessions.set('background', background);
const state = { terminals: sessions, activeTerminalId:'active', activeView:'terminal', terminalActionInFlightSessionIds:new Set(), connectionAttemptInFlight:false, connectionHealthCheckInFlight:null };
const tab = (id) => ({dataset:{terminalId:id}, classList:classes(), setAttribute(){}, querySelector(){return null;}});
const tabs = { children:[tab('active'), tab('background')] };
const context = {
  state, Date, window: { advanceTerminal: { notifyTerminalActivityComplete: () => {} } },
  setTimeout(fn, duration) { assert.equal(duration,900); const key=++id;scheduled.set(key,fn); return key; },
  clearTimeout(key) { if (key != null) {scheduled.delete(key);canceled.add(key);} },
  $: (q) => q==='#v7-session-list'?rows:q==='#terminal-tabs'?tabs:null,
  $$: () => [],
  getV7SessionStatus: (s)=>s.processBusy?'Running command':s.server.type==='local'?'Local terminal':'SSH session',
  getTerminalTabTitle: (s)=>s.server.name,
  syncV7CommandComposer:()=>{},
  stripTerminalControlText: (text)=>String(text).replace(/\x1b\[[0-9;?]*[a-zA-Z]/g,''),
};
vm.createContext(context);
vm.runInContext(js.slice(from,end),context,{filename:'activity.js'});
function fireTimers() { const timers=[...scheduled.entries()];scheduled.clear();timers.forEach(([,fn])=>fn()); }
assert.equal(context.isTerminalTabWorking(background), false);
context.setTerminalProcessBusy(background,true,'Reading a remote file');
assert.equal(background.processBusy,true);
assert.equal(backgroundRow.classList.contains('is-working'),true,'Background SSH spinner must animate');
assert.equal(activeRow.classList.contains('is-working'),false,'Other tab stays idle');
assert.equal(scheduled.size,0,'A silent long-running command must never expire by age');
context.maybeReleaseTerminalProcessBusy(background,'working...\n');
assert.equal(background.processBusy,true);
assert.equal(scheduled.size,1,'Ordinary output starts a candidate check but must not declare completion');
fireTimers();
assert.equal(background.processBusy,true,'Quiet non-prompt output is still running');
context.maybeReleaseTerminalProcessBusy(background,'[user@server public_html]$');
assert.equal(background.processBusy,true,'Prompt-like output must not immediately clear activity');
assert.equal(scheduled.size,1);
const staleCallback=[...scheduled.values()][0];
context.maybeReleaseTerminalProcessBusy(background,'\r\nReading another block\r\n');
assert.equal(scheduled.size,1,'Further output replaces the previous timer with a fresh candidate');
staleCallback();
assert.equal(background.processBusy,true,'Stale callback cannot complete a streaming job');
context.maybeReleaseTerminalProcessBusy(background,'[user@server public_html]$ ');
assert.equal(background.processBusy,true);
fireTimers();
assert.equal(background.processBusy,false,'Settled SSH prompt completes command');
assert.equal(backgroundRow.classList.contains('is-working'),false,'Background spinner stops after completion');
context.setTerminalProcessBusy(active,true,'Long local build');
context.maybeReleaseTerminalProcessBusy(active,'PS E:\\Projects\\Advance');
assert.equal(scheduled.size,1,'Partial local prompt schedules a check but does not finish');
context.maybeReleaseTerminalProcessBusy(active,' Terminal> ');
assert.equal(active.processBusy,true,'Split local prompt still waits for quiet window');
fireTimers();
assert.equal(active.processBusy,false);
context.setTerminalProcessBusy(active,true,'Second build');
context.maybeReleaseTerminalProcessBusy(active,'PS E:\\Projects\\Advance Terminal> ');
const oldRun=[...scheduled.values()][0];
context.setTerminalProcessBusy(active,true,'Third build');
oldRun();
assert.equal(active.processBusy,true,'Earlier command timer cannot clear a newer command');
context.maybeReleaseTerminalProcessBusy(active,'\x1b]133;D;0\x07');
assert.equal(active.processBusy,false,'Explicit completed shell-integration marker stops immediately');
context.setTerminalProcessBusy(active,true,'OSC split');
context.maybeReleaseTerminalProcessBusy(active,'\x1b]633;D;0');
assert.equal(active.processBusy,true);
context.maybeReleaseTerminalProcessBusy(active,'\x1b\\');
assert.equal(active.processBusy,false,'Split OSC marker recognized');
context.setTerminalProcessBusy(active,true,'Exit');
active.closed=true;
context.setTerminalProcessBusy(active,false);
assert.equal(activeRow.classList.contains('is-working'),false,'Closed sessions are idle');
for (const marker of [
  '.v7-session-row.active .v7-session-dot { color: #55aaff; }',
  '.v7-session-row.is-working .v7-session-dot svg { visibility: hidden; }',
  '.v7-session-row.is-working .v7-session-dot::after',
  '.v7-session-row.is-working .v7-session-indicator { display: none; }',
  'prefers-reduced-motion: reduce'
]) assert(css.includes(marker),`Missing visual state: ${marker}`);
assert(!/\.v7-session-row\s+\.v7-session-dot\s*\{[^}]*color:\s*#55aaff/.test(css),'Inactive tabs must remain gray');
console.log('PASS: Active-blue/inactive-gray icon states, per-session loading, SSH/local output, silent jobs, prompt settling, OSC completion, cancellation, and no expiry');
