/* eslint-disable no-console */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const start = source.indexOf('function updateTerminalTabActivation() {');
const end = source.indexOf('// Lightweight browser-like tab history.', start);
assert.ok(start >= 0 && end > start, 'Missing incremental activation function');
const activationSource = source.slice(start, end);
assert.match(source, /function activateTerminal\(terminalId\) \{[\s\S]*?updateTerminalTabActivation\(\);\s+updateCurrentTabFooter\(\);/);

function node(kind, terminalId, child) {
  const classes = new Set([kind]);
  const attrs = new Map();
  return {
    dataset: { terminalId },
    classList: {
      contains: (name) => classes.has(name),
      toggle: (name, active) => active ? classes.add(name) : classes.delete(name)
    },
    setAttribute(name, value) { attrs.set(name, value); },
    getAttribute(name) { return attrs.get(name); },
    querySelector(selector) { return selector === '.v7-session-item' ? child : null; },
    hasClass(name) { return classes.has(name); }
  };
}
function scenario({ visibleIds = ['local-a','ssh-b'],
                   tabIds = ['local-a','ssh-b'], activeId = 'ssh-b', sidebar = true } = {}) {
  const allSessions = visibleIds.map(terminalId => ({ terminalId }));
  // A reconnecting replacement should not create a phantom visible tab.
  allSessions.push({ terminalId: 'hidden-reconnect', pendingReconnectReplacement: true });
  const tabs = { children: [...tabIds.map(id => node('terminal-tab', id)), node('terminal-tab-actions', '')] };
  const sidebarRows = [...visibleIds.map(id => {
    const button = node('v7-session-item', id);
    return node('v7-session-row', id, button);
  }), node('v7-session-section-header', '')];
  const sidebarElement = sidebar ? { children: sidebarRows } : null;
  let rebuilds = 0;
  let pickerCloses = 0;
  const ctx = {
    state: { terminals: new Map(allSessions.map(value => [value.terminalId, value])), activeTerminalId: activeId },
    $: selector => selector === '#terminal-tabs' ? tabs : selector === '#v7-session-list' ? sidebarElement : null,
    renderTerminalTabs: () => rebuilds++,
    closeTerminalTabPicker: () => pickerCloses++
  };
  vm.runInNewContext(`${activationSource}\nupdateTerminalTabActivation();`, ctx, {timeout: 1000});
  return { tabs, sidebarRows, rebuilds, pickerCloses };
}

const normal = scenario();
assert.equal(normal.rebuilds, 0, 'Selection should not rebuild tabs');
assert.equal(normal.pickerCloses, 1);
assert.deepEqual(normal.tabs.children.filter(n => n.hasClass('active')).map(n => n.dataset.terminalId), ['ssh-b']);
assert.deepEqual(normal.tabs.children.filter(n => n.getAttribute('aria-selected') === 'true').map(n => n.dataset.terminalId), ['ssh-b']);
assert.deepEqual(normal.sidebarRows.filter(n => n.hasClass('active')).map(n => n.dataset.terminalId), ['ssh-b']);
assert.equal(normal.sidebarRows[0].querySelector('.v7-session-item').getAttribute('aria-current'), 'false');
assert.equal(normal.sidebarRows[1].querySelector('.v7-session-item').getAttribute('aria-current'), 'true');
assert.equal(scenario({activeId:'local-a', sidebar:false}).rebuilds, 0);
assert.equal(scenario({tabIds: ['local-a']}).rebuilds, 1, 'Missing tab must rebuild');
assert.equal(scenario({tabIds: ['ssh-b','local-a']}).rebuilds, 1, 'Reordered tabs must rebuild');
assert.equal(scenario({tabIds: ['local-a','unknown']}).rebuilds, 1, 'Unexpected tab must rebuild');
console.log('PASS: Tab selection reuses DOM and updates active/accessibility state.');
console.log('PASS: Missing, stale or reordered tabs trigger full-render fallback.');
console.log('PASS: Hidden reconnect replacements and absent sidebar are handled.');
