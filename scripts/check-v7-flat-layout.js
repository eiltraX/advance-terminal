'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('src/renderer/index.html', 'utf8');
const css = fs.readFileSync('src/renderer/styles.css', 'utf8');
const js = fs.readFileSync('src/renderer/renderer.js', 'utf8');

// Assert target layout and original IDs used by current tab, sidebar and shell logic.
const aside = html.slice(html.indexOf('<aside id="servers-panel"'), html.indexOf('</aside>', html.indexOf('<aside id="servers-panel"')));
const terminal = html.slice(html.indexOf('<div id="terminal-view"'), html.indexOf('<div id="view-view"'));
assert.ok(!aside.includes('class="panel-header"'), 'Old boxed Servers header is present');
assert.ok(aside.indexOf('class="left-tabbar"') > 0 && aside.indexOf('class="left-tabbar"') < aside.indexOf('id="left-tab-connections"'), 'Sidebar tabs must be first');
assert.ok(aside.includes('id="connections-panel-toggle"'), 'Preserve collapse functionality');
assert.ok(aside.includes('id="connection-group-filter-toggle"'), 'Filter icon missing');
assert.ok(aside.includes('id="connection-group-filter-popover"') && /id="connection-group-filter-popover"[^>]*hidden/.test(aside), 'Filter popover must be hidden initially');
assert.ok(aside.includes('id="connection-group-filter"'), 'Preserve existing group filter select');
assert.ok(terminal.indexOf('id="terminal-tabs"') < terminal.indexOf('terminal-session-header'), 'Terminal tabs must precede session bar');
assert.ok(terminal.indexOf('terminal-session-header') < terminal.indexOf('id="terminal-host"'), 'Session bar must precede terminal host');
assert.ok(css.includes('.workspace {\n  gap: 0;\n  padding: 0;'), 'Outer workspace framing remains');
assert.ok(css.includes('.servers-panel.is-collapsed .left-tabbar'), 'Collapsed sidebar styling missing');
assert.ok(css.includes('.connection-search-row .connection-group-filter-row[hidden]'), 'Hidden filter display guard missing');
assert.ok(js.includes('function renderTerminalTabs()') && js.includes('function renderTerminalToolbarActions('), 'Existing terminal and action rendering changed unexpectedly');
assert.ok(js.includes('terminal-tab-work-indicator'), 'Latest tab loading indicator is missing');

// Execute the ACTUAL new popover function and bound events with isolated DOM stubs.
const fnStart = js.indexOf('function setConnectionGroupFilterPopoverOpen(');
const fnEnd = js.indexOf('function updateConnectionGroupDatalist()', fnStart);
assert.ok(fnStart !== -1 && fnEnd > fnStart, 'Group popover function not found');
const eventStart = js.indexOf("  $('#connection-group-filter-toggle')?.addEventListener('click'", fnEnd);
const eventEnd = js.indexOf("  $('#command-category-filter')?.addEventListener", eventStart);
assert.ok(eventStart !== -1 && eventEnd > eventStart, 'Group popover events not found');
const handlers = {};
const documentHandlers = {};
let renders = 0;
let selectedGroup = null;
let focusCount = 0;
const popover = {hidden:true};
const toggle = {
  attributes: {},
  setAttribute(name,value) {this.attributes[name]=value;},
  focus(){focusCount++;},
  addEventListener(name,fn) {handlers['toggle:'+name]=fn;}
};
const select = {focus(){focusCount++;},addEventListener(name,fn) {handlers['select:'+name]=fn;}};
const lookup = {
  '#connection-group-filter-popover':popover,
  '#connection-group-filter-toggle':toggle,
  '#connection-group-filter':select
};
const context = {
  $: (s)=>lookup[s],
  renderConnectionGroupOptions:()=>{renders++;},
  setConnectionGroupFilter:(s)=>{selectedGroup=s;},
  document: {addEventListener(name,fn){documentHandlers[name]=fn;}}
};
vm.runInNewContext(js.slice(fnStart,fnEnd)+'\n'+js.slice(eventStart,eventEnd), context, {timeout:1000});
handlers['toggle:click']();
assert.equal(popover.hidden,false);
assert.equal(toggle.attributes['aria-expanded'],'true');
assert.equal(renders,1);
handlers['select:change']({target:{value:'Soloo'}});
assert.equal(selectedGroup,'Soloo');
assert.equal(popover.hidden,true);
assert.equal(toggle.attributes['aria-expanded'],'false');
handlers['toggle:click']();
documentHandlers.pointerdown({target:{closest:()=>null}});
assert.equal(popover.hidden,true);
handlers['toggle:click']();
let stopped=false;
documentHandlers.keydown({key:'Escape',preventDefault(){stopped=true;},stopPropagation(){}});
assert.equal(popover.hidden,true);
assert.equal(stopped,true);
assert.ok(focusCount >= 3);
console.log('PASS: Flat sidebar, group-filter toggle/select/Escape/outside close, terminal tab order and V7 feature guards.');
