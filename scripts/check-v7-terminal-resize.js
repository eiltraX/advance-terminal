/* eslint-disable no-console */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const start = source.indexOf('function getTerminalSize(session) {');
const end = source.indexOf('function fitTerminalSessionNow(session, options = {}) {', start);
assert.ok(start >= 0 && end > start, 'Terminal resize implementation missing');
const resize = source.slice(start, end);
assert.match(source, /clearReconnectTimer\(session\.terminalId\);\s*cancelTerminalBackendResize\(session\);/);
assert.match(source, /if \(!v7TerminalHostResizeObserver\) \{\s*const session = state\.terminals\.get\(state\.activeTerminalId\);/);
assert.doesNotMatch(source, /closeTerminalTabContextMenu\(\);\s*fitActiveTerminal\(\);\s*\}\);\s*window\.advanceTerminal\.onTerminalData/);
assert.doesNotMatch(resize, /writeTerminal\(/, 'Resizing must not inject input to PowerShell or SSH');

let nextTimerId = 1;
const pendingTimers = new Map();
const timer = (fn, ms) => { const id=nextTimerId++; pendingTimers.set(id,{fn,ms}); return id; };
const clear = id => pendingTimers.delete(id);
function fireTimers() {
  const scheduled = [...pendingTimers.values()];
  pendingTimers.clear();
  for (const x of scheduled) x.fn();
}
const resizeCalls = [];
let unresolved = null;
let holdNext = false;
const session = {
  terminalId:'local-1', closed:false,
  pane: { classList:{contains: key => key === 'active'} },
  term: {cols:100,rows:24}
};
const state = { terminals:new Map([[session.terminalId,session]]),activeTerminalId:session.terminalId };
const ctx = {
  state, Map, console,
  setTimeout: timer, clearTimeout: clear,
  window: {advanceTerminal:{
    resizeTerminal(payload) {
      resizeCalls.push({...payload});
      if (!holdNext) return Promise.resolve({ok:true});
      holdNext = false;
      return new Promise(resolve => { unresolved = resolve; });
    },
    writeTerminal(){throw new Error('Resize must never write terminal input');}
  }}
};
vm.createContext(ctx);
vm.runInContext(resize,ctx,{timeout:1000});
const tick = () => new Promise(resolve => setImmediate(resolve));

(async()=>{
  // A slow/fast mouse drag causes many calls to syncTerminalBackendSize;
  // only the final dimensions should reach the backend when the drag settles.
  for(let n=0;n<80;n++) {
    session.term.cols=90+n;
    ctx.syncTerminalBackendSize(session);
  }
  assert.equal(pendingTimers.size,1,'drag must create one settling timer');
  assert.equal(resizeCalls.length,0,'no backend resize while dragging');
  assert.equal([...pendingTimers.values()][0].ms,280,'PTy settling window');
  fireTimers(); await tick();
  assert.equal(resizeCalls.length,1);
  assert.equal(resizeCalls[0].cols,169);
  assert.equal(resizeCalls[0].rows,24);

  // Repeated visual fitting with identical dimensions sends no more IPC.
  for(let n=0;n<20;n++) ctx.syncTerminalBackendSize(session);
  assert.equal(pendingTimers.size,0,'identical fitted sizes must be suppressed');
  assert.equal(resizeCalls.length,1);

  // If changes arrive while IPC is pending, do not send overlapping resizes;
  // deliver the newest dimensions after the old call completes.
  session.term.cols=175; holdNext=true;
  ctx.syncTerminalBackendSize(session);
  fireTimers();
  assert.equal(resizeCalls.length,2);
  assert.ok(unresolved,'simulated in-flight IPC request');
  session.term.cols=210;
  ctx.syncTerminalBackendSize(session);
  session.term.cols=220;
  ctx.syncTerminalBackendSize(session);
  fireTimers();
  assert.equal(resizeCalls.length,2,'must not send concurrent PTY resizes');
  unresolved({ok:true}); await tick();
  assert.equal(pendingTimers.size,1,'must reschedule latest dimensions after in-flight request');
  fireTimers(); await tick();
  assert.equal(resizeCalls.length,3);
  assert.equal(resizeCalls[2].cols,220);

  // A tab closing before the debounce must cancel its pending resize.
  session.term.cols=300;
  ctx.syncTerminalBackendSize(session);
  assert.equal(pendingTimers.size,1);
  ctx.cancelTerminalBackendResize(session);
  assert.equal(pendingTimers.size,0);
  fireTimers(); await tick();
  assert.equal(resizeCalls.length,3);

  // A second session with the same id cannot inherit the old closed PTY state.
  const replacement={...session, closed:false, term:{cols:55,rows:12}};
  state.terminals.set('local-1',replacement);
  ctx.syncTerminalBackendSize(replacement);
  fireTimers(); await tick();
  assert.equal(resizeCalls[3].cols,55);
  assert.equal(resizeCalls[3].rows,12);
  assert.equal(resizeCalls.length,4);
  assert.equal(pendingTimers.size,0);

  // An inactive session cannot notify the backend even if one timer remains.
  replacement.term.cols=75;
  ctx.syncTerminalBackendSize(replacement);
  state.activeTerminalId='different-tab';
  fireTimers(); await tick();
  assert.equal(resizeCalls.length,4,'inactive tabs cannot send stale resizes');

  console.log('PASS: Rapid window drags coalesce into one settled backend resize.');
  console.log('PASS: Unchanged dimensions and overlapping IPC calls are suppressed.');
  console.log('PASS: Closed/replaced/inactive tabs do not send stale resizes.');
  console.log('PASS: Resize pipeline does not inject input into PowerShell or SSH.');
})().catch(e=>{console.error(e);process.exitCode=1;});
