'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
const helperStart = source.indexOf('// A sidebar click is an explicit user action:');
const helperEnd = source.indexOf('function createV7SessionRow(terminalId) {', helperStart);
const rowStart = source.indexOf('function createV7SessionRow(terminalId) {', helperEnd);
const clickStart = source.indexOf("  switchButton.addEventListener('click', () => {", rowStart);
const clickEnd = source.indexOf("  switchButton.addEventListener('keydown',", clickStart);
const restoreStart = source.indexOf('function restoreSavedTerminalSessions() {');
const restoreEnd = source.indexOf('function setTerminalTabPinned(', restoreStart);
assert(helperStart > 0 && helperEnd > helperStart && clickStart > rowStart && clickEnd > clickStart);
assert(restoreStart > 0 && restoreEnd > restoreStart);

const helper = source.slice(helperStart, helperEnd);
const click = source.slice(clickStart, clickEnd);
const restore = source.slice(restoreStart, restoreEnd);
assert.match(helper, /await reconnectTerminalTab\(terminalId\)/);
assert.match(helper, /v7SessionClickReconnectPending\.has\(terminalId\)/);
assert.match(click, /if \(session\.closed\) \{\s*void reconnectV7SessionOnClick\(terminalId\)/);
assert.match(click, /if \(!session \|\| v7DraggedSessionId\) return;/);
assert.match(restore, /Saved session restored\. Click its sidebar entry to reconnect\./);
assert.doesNotMatch(restore, /\b(?:reconnectTerminalTab|reconnectV7SessionOnClick|connectSelectedServer)\s*\(/,
  'Startup restoration must never start a connection');
// Existing reconnection path must preserve session identity and location in the tree.
assert.match(source, /async function reconnectTerminalTab\(terminalId\)[\s\S]*?replaceSession: session/);
assert.match(source, /fresh\.v7ParentId = replacing\.v7ParentId/);
assert.match(source, /fresh\.v7SidebarOrder = replacing\.v7SidebarOrder/);
assert.match(source, /v7ComposerDrafts\.set\(fresh\.terminalId, v7ComposerDrafts\.get\(replacing\.terminalId\)\)/);

function setup({closed = true, active = 'another', dragging = false, connectionOutcome} = {}) {
  let reconnects = 0;
  let activations = 0;
  let focuses = 0;
  let renders = 0;
  const notices = [];
  const saved = {terminalId: 'saved', closed, server: {name:'Test SSH', type:'remote'}, status: closed ? 'disconnected' : 'connected'};
  const state = {terminals: new Map([['saved',saved],['another',{terminalId:'another', closed:false}]]), activeTerminalId: active, activeView:'terminal'};
  const context = vm.createContext({
    state,
    renderV7MinimalSessionList: () => { renders++; },
    reconnectTerminalTab: () => { reconnects++; return connectionOutcome || Promise.resolve(true); },
    showToast: (...args) => { notices.push(args); },
    getTerminalTabTitle: (session) => session?.server?.name || 'Unknown',
    setActiveView: () => { state.activeView = 'terminal'; },
    activateTerminalAndFocus: (id) => { activations++; state.activeTerminalId = id; },
    focusTerminal: () => { focuses++; }
  });
  vm.runInContext(`${helper}\nvar terminalId = 'saved';\nvar v7DraggedSessionId = ${dragging ? "'saved'" : 'null'};\nvar v7TestClick = null;\nvar switchButton = {addEventListener(type, callback) { if (type === 'click') v7TestClick = callback; }};\n${click}`, context, {timeout:1500});
  const clickSession = () => vm.runInContext('v7TestClick()',context,{timeout:1500});
  const status = () => vm.runInContext('getV7SessionStatus(state.terminals.get("saved"))',context);
  const pending = () => vm.runInContext('v7SessionClickReconnectPending.has("saved")',context);
  return {state, clickSession, status, pending, notices, counts:()=>({reconnects,activations,focuses,renders})};
}
const nextMicrotasks = async () => { await Promise.resolve(); await new Promise(resolve => setImmediate(resolve)); };
(async () => {
  const connected = setup({closed:false});
  connected.clickSession();
  assert.equal(connected.counts().reconnects, 0);
  assert.equal(connected.counts().activations, 1);
  connected.clickSession();
  assert.equal(connected.counts().focuses, 1);
  assert.equal(connected.counts().reconnects, 0);

  let resolve;
  const deferred = new Promise(r => { resolve = r; });
  const disconnected = setup({connectionOutcome:deferred});
  disconnected.clickSession();
  assert.equal(disconnected.counts().reconnects, 1, 'One click should initiate one reconnect');
  assert.equal(disconnected.status(), 'Connecting', 'Pending reconnect must be visible');
  assert.equal(disconnected.pending(), true);
  assert.equal(disconnected.counts().activations,1, 'Session should be selected before reconnect');
  disconnected.clickSession();
  disconnected.clickSession();
  assert.equal(disconnected.counts().reconnects, 1, 'Repeated clicks must not duplicate a connection');
  resolve(true);
  await nextMicrotasks();
  assert.equal(disconnected.pending(), false, 'Pending state must clear after success');
  assert.equal(disconnected.status(), 'Disconnected', 'Status reflects the unchanged placeholder until replacement');
  assert.equal(disconnected.counts().renders,2, 'Only pending start/end render sidebar');

  const failed = setup({connectionOutcome:Promise.reject(new Error('Simulated network error'))});
  failed.clickSession();
  await nextMicrotasks();
  assert.equal(failed.pending(),false,'Failure must clear the guard');
  assert.equal(failed.notices.length,1);
  assert.match(failed.notices[0][0], /Simulated network error/);
  assert.equal(failed.status(),'Disconnected');

  const cancelled = setup({connectionOutcome:Promise.resolve(false)});
  cancelled.clickSession();
  await nextMicrotasks();
  assert.equal(cancelled.pending(),false,'Cancellation must clear the guard');
  assert.equal(cancelled.counts().reconnects,1);

  const dragging = setup({dragging:true});
  dragging.clickSession();
  assert.equal(dragging.counts().reconnects,0,'Dragging must not connect anything');
  assert.equal(dragging.counts().activations,0,'Dragging must not switch active tab');

  const missing = setup();
  missing.state.terminals.delete('saved');
  missing.clickSession();
  assert.equal(missing.counts().reconnects,0);

  assert.match(source, /switchButton\.setAttribute\('aria-label', `\$\{action\} \$\{title\}/);
  assert.match(source, /row\.setAttribute\('aria-busy', working \? 'true' : 'false'\)/);
  console.log('PASS: Clicking saved disconnected sessions reconnects once and shows a pending state.');
  console.log('PASS: Connected sessions only switch/focus; rapid clicks and drag do not reconnect.');
  console.log('PASS: Errors and cancellations clear pending state without automatic retries.');
  console.log('PASS: Startup remains offline; existing SSH authentication and tab/group preservation reused.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
