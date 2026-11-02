'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.resolve(__dirname, '../src/renderer/index.html'), 'utf8');
const js = fs.readFileSync(path.resolve(__dirname, '../src/renderer/renderer.js'), 'utf8');
for (const selector of ['id="live-console"', 'id="live-console-tab"', 'id="live-process-box"',
 'id="view-open-activity-feed"', 'id="tool-view-live-console"',
 'data-help-tab="live-console"', 'id="activity-feed-terminal-output-select"']) {
 assert(!html.includes(selector), `Removed obsolete Activity Feed UI: ${selector}`);
}
assert(html.includes('id="runtime-uptime"'), 'Uptime status retained');
assert(html.includes('id="runtime-memory"'), 'Memory status retained');
assert(html.includes('id="runtime-current-tab"'), 'Current tab status retained');
assert(html.includes('id="report-history-modal"'), 'Work Report history retained');
assert(html.includes('id="toast"'), 'Toast feedback retained');
assert(js.includes('restorePinnedTerminalTabs();'), 'Pinned tabs remain supported');
assert(js.includes('function markUsageDirty('), 'Work Report tracking intact');
function extractFunction(name) {
 const begin = js.indexOf(`function ${name}(`);
 assert(begin >= 0, `Existing helper retained: ${name}`);
 const brace = js.indexOf(') {', begin) + 2;
 let depth = 0;
 for (let i = brace; i < js.length; i++) {
  if (js[i] === '{') depth++;
  else if (js[i] === '}' && --depth === 0) return js.slice(begin, i + 1);
 }
 throw Error(`Could not extract ${name}`);
}
let events = [];
const ctx = vm.createContext({
  state: { activityFeedReady: true, liveConsoleLogs: [], liveProcessLogs: [] },
  appendLiveConsole: (...args) => events.push(args),
  queueLiveConsoleTerminalOutput: (...args) => events.push(args)
});
for (const name of ['appendActivityFeedEvent', 'getActivityFeedTerminalOutputMode',
 'maybeQueueLiveConsoleTerminalOutput']) vm.runInContext(extractFunction(name), ctx);
assert.equal(vm.runInContext('getActivityFeedTerminalOutputMode()',ctx),'off', 'Removed feed cannot buffer output');
vm.runInContext('appendActivityFeedEvent("Secret"); maybeQueueLiveConsoleTerminalOutput({terminalId:"x",data:"sensitive"});', ctx);
assert.equal(events.length, 0, 'Removed feed generates no events and queues no output');
vm.runInContext(extractFunction('appendLiveConsole'), ctx);
vm.runInContext('appendLiveConsole("Sample event")', ctx);
assert.deepEqual(ctx.state.liveConsoleLogs, [], 'Removed feed retains no entries');
assert.deepEqual(ctx.state.liveProcessLogs, [], 'Removed ticker retains no entries');
assert(html.includes('id="terminal-toolbar-actions"'), 'Fast v5 terminal toolbar retained');
console.log('PASS: v5 Activity Feed/ticker removed, feed processing disabled, reports and pinned tabs retained.');
