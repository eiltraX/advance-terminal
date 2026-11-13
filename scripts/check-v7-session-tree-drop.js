'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/renderer/v7-session-tree-fix.css'), 'utf8');
const start = source.indexOf('function getV7SessionParent(session) {');
const end = source.indexOf('function showV7SessionActionsMenu(', start);
assert.ok(start >= 0 && end > start, 'Session tree functions must be present');
assert.match(source, /const pushDropZone = \(root\) =>/, 'Nested group landing area must be rendered');
assert.match(source, /if \(visibleChildren\.length\) pushDropZone\(root\)/, 'Group drop gap must be after visible children');
assert.match(source, /placement === 'after-tree'[\s\S]+moveV7SessionRelative\(sourceId, parent\.terminalId, 'after'\)/,
  'The final-child after-tree handler must move to the parent root level');
assert.match(source, /v7-tree-last/, 'Last visible child must be marked');
assert.match(html, /<link rel="stylesheet" href="\.\/v7-session-tree-fix\.css">/);
assert.match(css, /\.v7-session-row\.is-child\.v7-tree-last::before[\s\S]*?bottom:\s*50%/);
assert.match(css, /\.v7-session-drop-zone\.is-drop-target::after/);
function env(entries) {
  const sessions = new Map(entries.map(item => [item.terminalId, {...item}]));
  let saves = 0, renders = 0;
  const scope = {state: {terminals: sessions}, persistSavedTerminalSessions: () => { saves++; return true; }, renderTerminalTabs: () => { renders++; },
    renderV7MinimalSessionList: ()=>{}, showToast: () => {}};
  vm.createContext(scope);
  vm.runInContext(source.slice(start, end), scope, {timeout: 2000});
  return {scope, sessions, stats:()=>[saves,renders]};
}
function session(id, order, parent=null, pinned=false) {return {terminalId:id,v7SidebarOrder:order,v7ParentId:parent,tabPinned:pinned};}
const a = env([session('root',0),session('child1',0,'root'),session('child2',1,'root'),session('other',1)]);
const row = {dataset: {terminalId:'child2'}, getBoundingClientRect:()=>({top:100,height:50})};
const placement = (y)=>a.scope.getV7SessionDropPlacement({clientY:y},row);
assert.equal(placement(104),'before');
assert.equal(placement(125),'inside');
assert.equal(placement(149),'after-tree', 'Bottom of final child must not nest');
assert.equal(a.scope.moveV7SessionRelative('other','root','after'),true);
assert.deepEqual(Array.from(a.sessions.values()).filter(x=>!x.v7ParentId).sort((x,y)=>x.v7SidebarOrder-y.v7SidebarOrder).map(x=>x.terminalId),['root','other']);
assert.equal(a.scope.moveV7SessionRelative('child2','root','after'),true,'Last child must be able to unnest after parent');
assert.deepEqual(Array.from(a.sessions.values()).filter(x=>!x.v7ParentId).sort((x,y)=>x.v7SidebarOrder-y.v7SidebarOrder).map(x=>x.terminalId),['root','child2','other']);
assert.equal(a.sessions.get('child2').v7ParentId,null);
assert.equal(a.sessions.get('child1').v7ParentId,'root');
assert.deepEqual(a.stats(),[2,2]);
const b = env([session('pinned',0,null,true),session('nested',0,'pinned'),session('regular',0)]);
assert.equal(b.scope.moveV7SessionRelative('regular','pinned','after'),true);
assert.equal(b.sessions.get('regular').tabPinned,true,'After a pinned group remains pinned');
assert.equal(b.sessions.get('regular').v7ParentId,null);
const c = env([session('group',0),session('member',0,'group'),session('last',1)]);
assert.equal(c.scope.moveV7SessionRelative('group','last','after'),true,'Parent with children may move as one unit');
assert.equal(c.sessions.get('member').v7ParentId,'group','Children follow their original parent');
assert.equal(c.scope.moveV7SessionRelative('group','member','after'),false,'Parent must not be nested under its own child');
// Exercise the actual group-level landing area's event handlers rather than
// relying solely on the movement function or a source-text match.
const dropStart = source.indexOf('  const pushDropZone = (root) => {');
const dropEnd = source.indexOf('  // The parent is', dropStart);
assert.ok(dropStart > 0 && dropEnd > dropStart);
let zone, dropMove, clears = 0;
const dropScope = {
  existingDropZones: new Map(), desired: [],
  document: {createElement: () => {
    const handlers = {};
    const classes = new Set();
    zone = {className:'', dataset:{}, listeners:handlers,
      setAttribute:()=>{}, addEventListener:(type,callback)=>{handlers[type]=callback;},
      classList:{add:(v)=>classes.add(v), contains:(v)=>classes.has(v)},
      contains:()=>false};
    return zone;
  }},
  clearV7SessionDrag:()=>{clears++;},
  moveV7SessionRelative:(source,target,placement)=>{dropMove=[source,target,placement];}
};
vm.createContext(dropScope);
vm.runInContext(`let v7DraggedSessionId = 'child2';\n${source.slice(dropStart, dropEnd)}\npushDropZone({terminalId:'root'});`,dropScope,{timeout:1000});
assert.equal(zone.dataset.afterRootId,'root');
assert.equal(dropScope.desired.length,1);
let prevented=0, stopped=0;
const evt={dataTransfer:{dropEffect:''},preventDefault:()=>{prevented++},stopPropagation:()=>{stopped++}};
zone.listeners.dragover(evt);
assert.equal(evt.dataTransfer.dropEffect,'move');
assert.ok(zone.classList.contains('is-drop-target'));
zone.listeners.drop(evt);
assert.deepEqual(dropMove,['child2','root','after']);
assert.equal(clears,1);
assert.equal(stopped,1);
assert.equal(prevented,2);
console.log('PASS: Final-child lower-edge drop is after-tree, while center retains nesting.');
console.log('PASS: Explicit gap and bottom-edge targeting preserve root order, pinning and parent-child relationships.');
console.log('PASS: Parent groups move together; illegal parent-to-child moves remain rejected.');
console.log('PASS: Connector CSS and HTML stylesheet registration are present.');
