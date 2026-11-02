'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'renderer.js'), 'utf8');

function extract(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `Cannot locate ${start}`);
  return source.slice(a, b);
}

const reconnectSource = extract('async function openFreshTerminalTab(', 'async function duplicateTerminalTab(');
const createSource = extract('function createTerminalPane(', 'function getTerminalSize(');
const connectionSource = extract('async function connectSelectedServer(', 'function scheduleAutoReconnect(');
const tabsSource = extract('function renderTerminalTabs(', '// Lightweight browser-like tab history.');
const sessionListSource = extract('function renderV7MinimalSessionList(', 'function setV7MenuOpen(');

assert(createSource.includes('activate = true'), 'Passive pane option must default to normal activation');
assert(createSource.includes("pane.className = activate ? 'terminal-pane active' : 'terminal-pane'"), 'Background reconnect pane must not become active');
assert(createSource.includes('if (activate) activateTerminal(terminalId);'), 'Background reconnect must not steal tab selection');
assert(connectionSource.includes('options?.serverOverride || getSelectedServer()'), 'Reconnect must not overwrite saved server selection');
assert(connectionSource.includes('createTerminalPane(terminalId, server, { activate: !background })'), 'Reconnect must create an inactive session');
assert(connectionSource.includes('if (!background) setTerminalStatus(\'connecting\')'), 'Background reconnect cannot change active tab status');
assert(connectionSource.includes('if (!background) setActiveView(previousView'), 'Cancelled background reconnect cannot change current view');
assert(tabsSource.includes('.filter((session) => session.pendingReconnectReplacement !== true)'), 'In-progress replacement should not create a duplicate header tab');
assert(sessionListSource.includes('.filter((session) => session.pendingReconnectReplacement !== true)'), 'In-progress replacement should not create a duplicate sidebar row');
assert(reconnectSource.includes('fresh.v7GroupId = replacing.v7GroupId'), 'Reconnect must preserve group id');
assert(reconnectSource.includes('fresh.v7GroupName = replacing.v7GroupName'), 'Reconnect must preserve group name');
assert(reconnectSource.includes('v7ComposerDrafts.set(fresh.terminalId'), 'Reconnect must preserve unsent command drafts');
assert(reconnectSource.includes('originalOrder'), 'Reconnect must preserve original tab ordering');
assert(reconnectSource.includes('state.activeTerminalId === replacing.terminalId'), 'Reconnect must preserve the current selected tab');

function makeHarness({ selected = 'C', fail = false, cancelled = false, removedOriginal = false, inFlight = false } = {}) {
  const sessions = [
    ['A', {terminalId:'A', server:{id:'a'}, closed:false, tabPinned:true, tabColor:'#a0d96e'}],
    ['B', {terminalId:'B', server:{id:'b'}, closed:true, tabPinned:true, tabColor:'#d76559', tabCustomTitle:'My SSH', v7GroupId:'g1', v7GroupName:'Production'}],
    ['C', {terminalId:'C', server:{id:'c'}, closed:false, tabPinned:false, tabColor:'#77bff2'}],
  ];
  const state = {
    settings: {servers:[{id:'a'},{id:'b'},{id:'c'}]},
    terminals: new Map(sessions),
    activeTerminalId:selected,
    connectionAttemptInFlight:inFlight
  };
  const calls=[];
  const v7ComposerDrafts = new Map([['B','unsent command']]);
  const mocks={
    v7ComposerDrafts,
    state,
    showToast(...args){calls.push(['toast',...args]);},
    getConnectingTerminalSession(){return null;},
    selectServer(id){calls.push(['selectServer',id]);},
    normalizeTerminalTabTitle: v => v || '',
    normalizeTerminalTabColor: v => v || '',
    async connectSelectedServer(options) {
      calls.push(['connect', options]);
      if (cancelled) return;
      state.terminals.set('NEW', {terminalId:'NEW', server:{id:'b'}, closed:fail, hasConnected:!fail, pendingReconnectReplacement:true, tabColor:'', tabPinned:false});
      if (removedOriginal) state.terminals.delete('B');
    },
    closeTerminalSession(id, opts) {
      calls.push(['close',id,opts]);
      state.terminals.delete(id);
      if (state.activeTerminalId === id) state.activeTerminalId = state.terminals.keys().next().value;
    },
    movePinnedTerminalTabsFirst(){calls.push(['movePinnedFirst']);},
    persistPinnedTerminalTabs(){calls.push(['persist']);},
    renderTerminalTabs(){calls.push(['render']);},
    updateCurrentTabFooter(){calls.push(['footer']);},
  };
  vm.createContext(mocks);
  vm.runInContext(reconnectSource, mocks);
  return {state,calls,v7ComposerDrafts,open:mocks.openFreshTerminalTab};
}

async function run() {
  {
    const h=makeHarness();
    assert.equal(await h.open({serverId:'b',title:'My SSH',color:'#d76559'}, {replaceSession:h.state.terminals.get('B')}), true);
    assert.deepEqual([...h.state.terminals.keys()], ['A','NEW','C']);
    assert.equal(h.state.activeTerminalId,'C','Reconnect background must not steal selection');
    assert.equal(h.state.terminals.get('NEW').v7GroupId,'g1');
    assert.equal(h.state.terminals.get('NEW').v7GroupName,'Production');
    assert.equal(h.state.terminals.get('NEW').tabPinned,true);
    assert.equal(h.state.terminals.get('NEW').tabColor,'#d76559');
    assert.equal(h.state.terminals.get('NEW').tabCustomTitle,'My SSH');
    assert.equal(h.v7ComposerDrafts.get('NEW'),'unsent command');
    assert.equal(h.state.terminals.get('A').tabColor,'#a0d96e');
    assert.equal(h.state.terminals.get('C').tabColor,'#77bff2');
    assert.equal(h.calls.some(c=>c[0]==='selectServer'),false,'Reconnect must not change selected server');
    assert.equal(h.calls.some(c=>c[0]==='movePinnedFirst'),false,'Reconnect must not reorder pinned tabs');
    assert.equal(h.calls.find(c=>c[0]==='connect')[1].background,true);
    assert.equal(h.calls.find(c=>c[0]==='close' && c[1]==='B')[2].remember,false);
  }
  {
    const h=makeHarness({selected:'B'});
    assert.equal(await h.open({serverId:'b', title:'My SSH', color:'#d76559'}, {replaceSession:h.state.terminals.get('B')}),true);
    assert.equal(h.state.activeTerminalId,'NEW','Original active slot becomes newly connected tab');
    assert.deepEqual([...h.state.terminals.keys()],['A','NEW','C']);
  }
  for (const opts of [{fail:true}, {cancelled:true}, {removedOriginal:true}]) {
    const h=makeHarness(opts);
    assert.equal(await h.open({serverId:'b',title:'My SSH', color:'#d76559'}, {replaceSession:h.state.terminals.get('B')}),false);
    assert.equal(h.state.terminals.has('NEW'),false,'Failed/stale reconnect must close provisional tab');
    assert.equal(h.state.activeTerminalId,'C','Failed attempt must preserve selected tab');
    if (!opts.removedOriginal) assert.deepEqual([...h.state.terminals.keys()],['A','B','C'],'Failed attempt must preserve original order');
  }
  {
    const h=makeHarness({inFlight:true});
    assert.equal(await h.open({serverId:'b',title:'My SSH'}, {replaceSession:h.state.terminals.get('B')}),false);
    assert.deepEqual([...h.state.terminals.keys()],['A','B','C']);
    assert.equal(h.calls.some(c=>c[0]==='connect'),false,'Second connect must be rejected');
  }
  {
    const h=makeHarness();
    assert.equal(await h.open({serverId:'b',title:'My SSH'}, {replaceSession:{terminalId:'B',closed:true}}),false);
    assert.equal(h.calls.some(c=>c[0]==='connect'),false,'Stale tab object must not be reconnected');
  }
  console.log('PASS: V7 Stage 5 manual reconnect preserves tab slot/group/color/pin/selection; cancellation, failed auth, stale requests and concurrent connects guarded');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
