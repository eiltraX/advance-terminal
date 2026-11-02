'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'renderer.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a !== -1 && b > a, `Cannot locate source section: ${start}`);
  return source.slice(a, b);
}
const defs = [
  section('const PINNED_TERMINAL_TABS_STORAGE_KEY', 'function normalizeTerminalTabTitle'),
  section('function persistPinnedTerminalTabs()', '// Restore visible pinned tabs'),
  section('function restorePinnedTerminalTabs()', 'function movePinnedTerminalTabsFirst'),
  section('const V7_SESSION_GROUPS_STORAGE_KEY', '// Each color is tuned'),
  section('function setV7SessionGroup(', 'function showV7SessionActionsMenu(')
].join('\n');

const saved = new Map();
const localStorage = {
  getItem(key) { return saved.has(key) ? saved.get(key) : null; },
  setItem(key, value) { saved.set(key, String(value)); }
};
function makeApp() {
  const sessions = new Map();
  let renderCount = 0;
  let reconnectCount = 0;
  const ctx = {
    Map, Set, JSON, String, Number, Math, Array, localStorage,
    state: { terminals: sessions, settings: { servers: [{ id: 'dev', name:'Dev', type:'remote' }] } },
    normalizeTerminalTabTitle: v => String(v || '').slice(0, 60),
    normalizeTerminalTabColor: v => String(v || ''),
    renderV7MinimalSessionList() {renderCount++;},
    showToast() {},
    randomId() {return `restored-${sessions.size+1}`;},
    createTerminalPane(id, server) {
      const session = { terminalId:id, server, tabPinned:false, tabColor:'', tabCustomTitle:'',
        term:{writeln(){}}, restoredPinnedPlaceholder:true, closed:true };
      sessions.set(id, session);
      return session;
    },
    cleanupTerminalSessionResources() {},
    movePinnedTerminalTabsFirst() {},
    activateTerminal(id) {ctx.state.activeTerminalId = id;},
    connectSelectedServer(){reconnectCount++;}
  };
  vm.createContext(ctx);
  vm.runInContext(defs, ctx);
  return { ctx, sessions, get renderCount(){return renderCount;}, get reconnectCount(){return reconnectCount;}, run: js => vm.runInContext(js,ctx) };
}
const app = makeApp();
app.sessions.set('tab-dev', { terminalId:'tab-dev', server:{ id:'dev' }, tabPinned:true,
  tabCustomTitle:'Dev SSH', tabColor:'#77bff2' });
assert.equal(app.run('createV7SessionGroup("tab-dev")'), true);
assert.equal(app.run('v7SessionGroups.size'), 1);
assert.equal(app.sessions.get('tab-dev').v7GroupId, 'v7-group-1');
assert.equal(JSON.parse(saved.get('advanceTerminal.v7.sessionGroups'))[0].name,'Group 1');
assert.equal(JSON.parse(saved.get('advanceTerminal.v5.pinnedTerminalTabs'))[0].groupId, 'v7-group-1');
const beforeOrder = Array.from(app.sessions.keys());
assert.equal(app.run('ungroupV7Session("tab-dev")'), true);
assert.equal(app.sessions.get('tab-dev').v7GroupId, null);
assert.equal(app.run('v7SessionGroups.size'), 1, 'Ungrouping must not delete group');
assert.equal(JSON.parse(saved.get('advanceTerminal.v5.pinnedTerminalTabs'))[0].groupId,'');
assert.equal(app.run('setV7SessionGroup("tab-dev", "v7-group-1")'), true);
assert.deepEqual(Array.from(app.sessions.keys()), beforeOrder, 'Grouping must not move tabs');

// Simulate an application restart with same localStorage, no automatic SSH connection.
const restarted = makeApp();
restarted.run('restoreV7SessionGroups()');
assert.equal(restarted.run('v7SessionGroups.size'), 1);
assert.equal(restarted.run('v7SessionGroupCounter'), 1);
assert.equal(restarted.run('restorePinnedTerminalTabs()'), true);
assert.equal(restarted.reconnectCount, 0, 'Restore must not connect SSH');
const pinned = Array.from(restarted.sessions.values())[0];
assert.equal(pinned.v7GroupId,'v7-group-1');
assert.equal(pinned.v7GroupName,'Group 1');
assert.equal(pinned.tabPinned,true);
assert.equal(pinned.tabColor,'#77bff2');
assert.equal(restarted.run('createV7SessionGroup("restored-1")'), true);
assert.equal(restarted.sessions.get('restored-1').v7GroupId, 'v7-group-2', 'New ID must not collide with restored group');
assert.equal(restarted.run('v7SessionGroups.size'), 2);

// All tabs can be removed; group definitions should still be saved and visible.
restarted.sessions.clear();
assert.equal(restarted.run('v7SessionGroups.size'), 2);
assert(source.includes("heading.textContent = `${group.name} · Empty`;"), 'Empty groups must remain visible');
assert(source.includes("  restorePinnedTerminalTabs();\n  renderV7MinimalSessionList();"), 'Startup must redraw empty groups, even with no pinned tabs');
assert(source.includes("...Array.from(v7SessionGroups.values())"), 'Menu must allow moving into saved group');
assert(source.indexOf('restoreV7SessionGroups();') < source.lastIndexOf('restorePinnedTerminalTabs();'), 'Group restoration must precede pinned tab restoration');
assert(source.includes('fresh.v7GroupId = replacing.v7GroupId;'), 'Stage 5 reconnect group preservation required');

// Invalid metadata may not load untrusted group IDs or arbitrary fields.
saved.set('advanceTerminal.v7.sessionGroups', JSON.stringify([
  {id:'__proto__',name:'bad'}, {id:'v7-group-3',name:'Three'}, {id:'v7-group-3',name:'Duplicate'}
]));
const safe = makeApp(); safe.run('restoreV7SessionGroups()');
assert.equal(safe.run('v7SessionGroups.size'), 1);
assert.equal(safe.run('v7SessionGroupCounter'), 3);
console.log('PASS: V7 saved groups, pinned group restoration, ungrouping, reuse, safe parsing, no automatic reconnect');
