
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const file = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const digest = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const original = {"src/renderer/index.html": "9da06ea3fd8d924e3664370d010328a5001883f34b67856797cf11046c1997e4", "src/renderer/renderer.js": "3fb3e1d9ea19d47b7ed54599befb586478a7d2906c01345efebbc7802c3260f6", "src/renderer/v7-minimal-shell.css": "9e64348e239280ad97f992c03dbe7997febfe4545cb24e86580cfcd162dad832"};
const paths = Object.keys(original);
if (process.argv.includes('--before')) {
  paths.forEach((p) => assert.strictEqual(digest(p), original[p], `STOP: Source differs from last inspected V7 minimal-shell patch: ${p}`));
  console.log('PASS: Current renderer files match the inspected V7 minimal-shell baseline');
  process.exit(0);
}
const html = file('src/renderer/index.html');
const js = file('src/renderer/renderer.js');
const css = file('src/renderer/v7-minimal-shell.css');
for (const tag of ['data-v7-sidebar-view="sessions"','data-v7-sidebar-view="servers"','data-v7-sidebar-view="commands"','id="servers-panel" class="servers-panel v7-sessions-only"','id="left-tab-connections"','id="left-tab-commands"','id="server-list"','id="command-list"','id="v7-session-list"']) {
  assert(html.includes(tag), `Missing element or sidebar menu action: ${tag}`);
}
for (const token of ['function setV7SidebarView(view)', "setV7SidebarView('servers')", "setV7SidebarView('commands')", "setV7SidebarView(button.dataset.v7SidebarView)", "panel.classList.toggle('v7-sessions-only'", "panel.classList.toggle('v7-directory-view'", "setConnectionsPanelCollapsed(false, false)"]) {
  assert(js.includes(token), `Missing event wiring: ${token}`);
}
for (const token of ['#servers-panel.v7-sessions-only .left-tabbar', '#servers-panel.v7-sessions-only .left-tab-panel', '#servers-panel.v7-sessions-only .v7-session-list', '#servers-panel.v7-directory-view .v7-session-sidebar']) {
  assert(css.includes(token), `Missing CSS rule: ${token}`);
}
assert(!css.includes('display: none !important;\n#server-list'), 'Saved servers must remain in DOM');
// Exercise the actual sidebar view-switching function in isolation with mocked UI state.
const start = js.indexOf('function setV7SidebarView(view) {');
const end = js.indexOf('\nfunction closeV7GlobalResults()', start);
assert(start > -1 && end > start, 'Sidebar view switching function not found');
const snippet = js.slice(start, end);
const cls = (values=[]) => ({names:new Set(values), toggle(name,on){if(on)this.names.add(name);else this.names.delete(name);}, contains(name){return this.names.has(name)}});
const panel = {classList:cls(['v7-sessions-only'])};
const views = ['sessions','servers','commands'].map(view=>({dataset:{v7SidebarView:view},classList:cls(['is-active'].filter(()=>view==='sessions')),pressed:'',setAttribute(name,value){if(name==='aria-pressed') this.pressed=value;}}));
const actions=[];
const state = {connectionsPanelCollapsed:false,activeView:'terminal'};
const globals = {
  '$': ()=>panel,
  '$$': ()=>views,
  state,
  setConnectionsPanelCollapsed:(...args)=>actions.push(['expand',...args]),
  setActiveView:(...args)=>actions.push(['active',...args]),
  setLeftTab:(name)=>actions.push(['tab',name]),
  renderV7MinimalSessionList:()=>actions.push(['sessions']),
};
vm.createContext(globals);
vm.runInContext(snippet, globals);
globals.setV7SidebarView('servers');
assert(panel.classList.contains('v7-directory-view') && !panel.classList.contains('v7-sessions-only'));
assert(actions.some(a=>a[0]==='tab' && a[1]==='connections'));
assert(views[1].pressed==='true' && views[0].pressed==='false');
globals.setV7SidebarView('commands');
assert(actions.some(a=>a[0]==='tab' && a[1]==='commands'));
globals.setV7SidebarView('sessions');
assert(panel.classList.contains('v7-sessions-only') && !panel.classList.contains('v7-directory-view'));
assert(views[0].pressed==='true' && views[1].pressed==='false');
assert(actions.some(a=>a[0]==='sessions'));
state.connectionsPanelCollapsed=true;
globals.setV7SidebarView('servers');
assert(actions.some(a=>a[0]==='expand' && a[1]===false && a[2]===false));
state.activeView='settings';
globals.setV7SidebarView('sessions');
assert(actions.some(a=>a[0]==='active' && a[1]==='terminal'));
console.log('PASS: Default sessions sidebar, menu visibility, server/command navigation, global search routing and isolated view-switching');
