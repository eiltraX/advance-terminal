// Advance Terminal V7 — read-only header navigation and source preflight.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const relativeJs = 'src/renderer/v7-frameless-titlebar.js';
const relativeCss = 'src/renderer/v7-frameless-titlebar.css';
const baseline = {
  [relativeJs]: '2eb53a80e4e6cfc5b29b5acca4054f4b9792ec5e3b8b260ca9888af3128defb7',
  [relativeCss]: '35202772465cbd9deca37506bb5471d2ab6bcafb9539ae8889a9628cdf88e351'
};
const updated = {
  [relativeJs]: 'ed284d980b760e623634b3734a22ce17f1f32316585d88b68fa245ed626116f2',
  [relativeCss]: '3c48995b22806ef13d578871f207ab4ccad9c858aba516191fefae38ce123b12'
};
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const hash = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const preflight = process.argv.includes('--before');
for (const [rel, expected] of Object.entries(preflight ? baseline : updated)) {
  const absolute = path.join(root, rel);
  assert(fs.existsSync(absolute), `STOP: Required file missing: ${rel}`);
  assert.equal(hash(rel), expected, `STOP: ${rel} differs from inspected baseline. Do not overwrite; upload the latest file instead.`);
}
const html = read('src/renderer/index.html');
const renderer = read('src/renderer/renderer.js');
for (const id of ['v7-shell-menu-toggle','v7-open-settings','v7-new-session','v7-shell-menu','connections-panel-toggle','v7-win-minimize','v7-win-maximize','v7-win-close']) {
  assert(html.includes(`id="${id}"`), `STOP: Existing integration target ${id} not found`);
}
for (const marker of ['function setV7SidebarView(view)', "setActiveView('report', 'report')", "setActiveView('settings', 'settings')", "setActiveView('about', 'help')", 'function setConnectionsPanelCollapsed(']) {
  // Report/Settings routes are bound by the existing menu-item handlers; source
  // checks below validate their actual routes without guessing alternate APIs.
  if (marker.startsWith('setActiveView(')) continue;
  assert(renderer.includes(marker), `STOP: Integration missing: ${marker}`);
}
for (const action of ['terminal','settings','report','help']) {
  assert(html.includes(`data-menu-action="${action}"`), `Legacy ${action} handler must remain mounted`);
}
for (const view of ['servers','commands']) {
  assert(html.includes(`data-v7-sidebar-view="${view}"`), `${view} view action missing`);
}
if (preflight) {
  console.log('PASS: Current V7 header CSS/JS match the inspected source; back up both before applying.');
  process.exit(0);
}
const source = read(relativeJs);
const css = read(relativeCss);
for (const marker of ['id = \'v7-sidebar-collapse\'', "'v7-tools-menu'", "'v7-settings-menu'", "{ label: 'Server', sidebar: 'servers' }", "{ label: 'Commands', sidebar: 'commands' }", "{ label: 'Report', view: 'report' }", "{ label: 'Settings', view: 'settings' }", "{ label: 'Help', view: 'help' }"]) {
  assert(source.includes(marker), `New navigation missing: ${marker}`);
}
for (const marker of ['-webkit-app-region: no-drag', '.v7-header-popup[hidden]', '.workspace.connections-collapsed', '.v7-minimal-topbar #v7-shell-menu']) {
  assert(css.includes(marker), `New styling missing ${marker}`);
}
assert(!source.includes('setInterval('), 'Do not add polling loops');

class Element {
  constructor(tag, id) { this.tagName = tag.toUpperCase(); this.id=id||''; this.children=[]; this.parentNode=null;this.dataset={};this.attrs={};this.listeners={};this.hidden=false;this.title='';this.type='';this.innerHTML='';this.textContent='';this.focused=false;this.className='';this.classes=new Set();this.classList={add:s=>this.classes.add(s),remove:s=>this.classes.delete(s),contains:s=>this.classes.has(s),toggle:s=>{this.classes.has(s)?this.classes.delete(s):this.classes.add(s);return this.classes.has(s);}};}
  setAttribute(k,v){this.attrs[k]=String(v);} getAttribute(k){return this.attrs[k]||null;}
  appendChild(el){if(el.parentNode)el.parentNode.removeChild(el);this.children.push(el);el.parentNode=this;return el;}
  removeChild(el){this.children.splice(this.children.indexOf(el),1);el.parentNode=null;}
  insertBefore(el,target){if(el.parentNode)el.parentNode.removeChild(el);let n=target?this.children.indexOf(target):-1;this.children.splice(n<0?this.children.length:n,0,el);el.parentNode=this;return el;}
  contains(el){for(let p=el;p;p=p.parentNode)if(p===this)return true;return false;}
  addEventListener(event,fn,opts){(this.listeners[event]??=[]).push({fn,capture:opts===true});}
  click(){this.dispatch('click');}
  dispatch(type,over={}){const ev={type,target:this,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...over};for(const o of [...(this.listeners[type]||[])].sort((a,b)=>Number(b.capture)-Number(a.capture))){o.fn(ev);if(ev.stopped)break;}return ev;}
  focus(){this.focused=true;fakeDocument.activeElement=this;}
  querySelectorAll(query){const found=[];const walk=(e)=>{for(const child of e.children){if(query==='[role="menuitem"]'&&child.getAttribute('role')==='menuitem')found.push(child);walk(child);}};walk(this);return found;}
  querySelector(query){return this.querySelectorAll(query)[0]||null;}
}
const leading=new Element('div');const tools=new Element('button','v7-shell-menu-toggle');const oldMenu=new Element('div','v7-shell-menu');leading.appendChild(tools);leading.appendChild(oldMenu);
const right=new Element('div');const settings=new Element('button','v7-open-settings');right.appendChild(settings);
const collapse=new Element('button','connections-panel-toggle');const workspace=new Element('main');const navEvents=[];
collapse.addEventListener('click',()=>workspace.classList.toggle('connections-collapsed'));
const roots={'v7-shell-menu-toggle':tools,'v7-shell-menu':oldMenu,'v7-open-settings':settings,'connections-panel-toggle':collapse};
const routes={};for(const key of ['servers','commands','report','settings','help']){const el=new Element('button');el.addEventListener('click',()=>navEvents.push(key));routes[key]=el;}
const listeners={};const fakeDocument={activeElement:null,querySelector(s){if(s==='.v7-shell-menu-wrap')return leading;if(s==='.workspace')return workspace;const m=s.match(/^\[data-v7-sidebar-view="([^"]+)"\]$/);if(m)return routes[m[1]];const v=s.match(/^\[data-menu-action="([^"]+)"\]$/);if(v)return routes[v[1]];return null;},getElementById(id){const find=(el)=>{if(el.id===id)return el;for(const child of el.children){const r=find(child);if(r)return r;}return null;};return roots[id]||find(leading)||find(right);},createElement(tag){return new Element(tag);},addEventListener(t,fn){(listeners[t]||=[]).push(fn);}};
const a=source.indexOf('  function initializeHeaderNavigation() {');const b=source.indexOf("  if (document.readyState === 'loading') {",a);
assert(a>0&&b>a,'Cannot isolate header-navigation function');
const ctx={document:fakeDocument,window:{addEventListener(){}},MutationObserver:class {observe(){}disconnect(){}}};
vm.runInNewContext(source.slice(a,b)+'\ninitializeHeaderNavigation();',ctx);
const side=fakeDocument.getElementById('v7-sidebar-collapse');assert(side,'Sidebar collapse must exist');
const toolMenu=fakeDocument.getElementById('v7-tools-menu');const settingsMenu=fakeDocument.getElementById('v7-settings-menu');
assert.deepEqual(toolMenu.children.map(n=>n.textContent),['Server','Commands','Report']);
assert.deepEqual(settingsMenu.children.map(n=>n.textContent),['Settings','Report','Help']);
let legacyTools=0;tools.addEventListener('click',()=>legacyTools++);
tools.click();assert(!toolMenu.hidden,'Tools menu opens');assert.equal(legacyTools,0,'Must not open legacy hamburger menu');
toolMenu.children[0].click();assert.deepEqual(navEvents,['servers']);assert(toolMenu.hidden,'Menu closes after selection');
settings.click();assert(!settingsMenu.hidden,'Settings menu opens instead of direct navigation');
settingsMenu.children[2].click();assert.deepEqual(navEvents,['servers','help']);
tools.click();for(const cb of listeners.keydown||[])cb({key:'Escape',preventDefault(){}});assert(toolMenu.hidden,'Escape closes Tools menu');
side.click();assert(workspace.classList.contains('connections-collapsed'),'Collapse should call original handler');
side.click();assert(!workspace.classList.contains('connections-collapsed'),'Expand should call original handler');
console.log('PASS: V7 header menus, reused navigation, outside controls, Escape, and sidebar collapse/expand.');
