'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root,'src/renderer/index.html'),'utf8');
const css = fs.readFileSync(path.join(root,'src/renderer/styles.css'),'utf8');
const renderer = fs.readFileSync(path.join(root,'src/renderer/renderer.js'),'utf8');

for (const id of ['terminal-nav-back','terminal-nav-forward','terminal-nav-reload','terminal-location']) {
  assert.equal((html.match(new RegExp(`id="${id}"`, 'g'))||[]).length, 1, `Expected unique ${id}`);
}
assert(!html.includes('>TERMINAL SESSION<'), 'Old terminal header label must be removed');
assert(html.includes('class="terminal-location-prefix">Location:</span>'));
assert(html.indexOf('id="terminal-tabs"') < html.indexOf('id="terminal-nav-back"'), 'Tabs precede navigation/location bar');
assert(/\.servers-panel \.left-tab\.active\s*\{[^}]*background:\s*var\(--sidebar-main-tab-active\)/s.test(css), 'Styled active sidebar tab required');
assert(/\.servers-panel \.left-tab\s*\{[^}]*border-radius:\s*13px/s.test(css), 'Smooth rounded tab expected');
assert(html.includes('class="terminal-location-pill"'), 'Location pill wrapper required');
assert(/\.terminal-location::before \{[^}]*content: none;/s.test(css), 'No duplicated Location labels');
assert(/\.servers-panel \.left-tabbar \{[^}]*border: 0;/s.test(css), 'Sidebar separator removed');
assert(renderer.includes("$('#terminal-nav-back')?.addEventListener('click'"), 'Back listener');
assert(renderer.includes("$('#terminal-nav-forward')?.addEventListener('click'"), 'Forward listener');
assert(renderer.includes("$('#terminal-nav-reload')?.addEventListener('click'"), 'Reload listener');
assert(renderer.includes('rememberTerminalTabNavigation(previousTerminalId, terminalId);'), 'Activation hook');
assert(renderer.includes('updateTerminalTabNavigationButtons();\n  if (session.tabPinned) persistPinnedTerminalTabs();'), 'Close cleanup');

const start = renderer.indexOf('const terminalTabNavigation =');
const end = renderer.indexOf('function activateTerminal(terminalId)', start);
assert(start > 0 && end > start, 'Expected self-contained navigation module');
const code = renderer.slice(start,end);
const controls = Object.fromEntries(['back','forward','reload'].map((id) => [id, { disabled:false, title:'', setAttribute(key,value){this[key]=value;} }]));
const state = { terminals:new Map(), activeTerminalId:null };
let fits=0, refreshes=0, reconnects=0, headerUpdates=0;
const context = {
  state,
  $: (selector) => controls[selector.replace('#terminal-nav-','')] || null,
  updateTerminalLocationHeader: () => {headerUpdates++;},
  fitActiveTerminal: () => {fits++;},
  reconnectTerminalTab: async () => {reconnects++;return true;},
  activateTerminalAndFocus(id) {
    const prev=state.activeTerminalId;
    state.activeTerminalId=id;
    vm.runInContext(`rememberTerminalTabNavigation(${JSON.stringify(prev)}, ${JSON.stringify(id)})`,sandbox);
  }
};
const sandbox = vm.createContext(context);
vm.runInContext(code,sandbox);
const call = (expression) => vm.runInContext(expression,sandbox);
const session = (id) => ({ terminalId:id, closed:false,term:{rows:24,refresh() {refreshes++;}} });
state.terminals.set('A',session('A'));
state.terminals.set('B',session('B'));
state.terminals.set('C',session('C'));
context.activateTerminalAndFocus('A');
assert.equal(controls.back.disabled,true, 'No initial Back');
assert.equal(controls.reload.disabled,false, 'Reload enabled when tab exists');
context.activateTerminalAndFocus('B');
context.activateTerminalAndFocus('C');
assert.equal(controls.back.disabled,false);
assert.equal(call("navigateTerminalTab('back')"),true);
assert.equal(state.activeTerminalId,'B');
assert.equal(controls.forward.disabled,false);
assert.equal(call("navigateTerminalTab('forward')"),true);
assert.equal(state.activeTerminalId,'C');
assert.equal(call("navigateTerminalTab('back')"),true);
assert.equal(state.activeTerminalId,'B');
context.activateTerminalAndFocus('A');
assert.equal(controls.forward.disabled,true,'New navigation clears forward history');
context.activateTerminalAndFocus('C');
state.terminals.delete('A');
call('updateTerminalTabNavigationButtons()');
assert.equal(call("navigateTerminalTab('back')"),true);
assert.equal(state.activeTerminalId,'B','Closed tabs skipped');
state.terminals.delete('C');
call('updateTerminalTabNavigationButtons()');
assert.equal(controls.back.disabled,true,'Closed histories are pruned');
assert.equal(controls.forward.disabled,true,'Closed forward histories are pruned');
(async ()=>{
  assert.equal(await call('reloadActiveTerminalDisplay()'),true);
  assert.equal(refreshes,1);
  assert.equal(fits,1);
  assert.equal(headerUpdates,1);
  assert.equal(reconnects,0,'Connected terminals never reconnect on refresh');
  state.terminals.get('B').closed=true;
  assert.equal(await call('reloadActiveTerminalDisplay()'),true);
  assert.equal(reconnects,1,'Disconnected terminals use deliberate existing reconnect');
  assert.equal(refreshes,1,'Closed terminals are not blindly refreshed');
  state.terminals.clear();
  call('updateTerminalTabNavigationButtons()');
  assert.equal(controls.reload.disabled,true,'No terminal -> reload disabled');
  console.log('PASS: V7 sidebar design, browser controls, navigation history, stale tab cleanup, safe reload, disconnected reconnect and markup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
