'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/renderer/v7-minimal-shell.css'), 'utf8');
for (const selector of ['.v7-session-close', '.v7-session-context-menu', '.v7-session-color-option', '.v7-session-group-header']) {
  assert(css.includes(selector), `Missing style: ${selector}`);
}
for (const marker of ["showV7SessionActionsMenu(terminalId, rect, actionsButton)", "closeTerminalSession(terminalId, { force: true });", "showV7SessionActionsMenu(terminalId, { left:", "session.tabPinned === true", 'renderV7MinimalSessionList();']) {
  assert(js.includes(marker), `Missing session-card behavior: ${marker}`);
}
class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this._classes = new Set();
    this.classList = { add: (name) => this._classes.add(name) };
    this.dataset = {};
    this.disabled = false;
    this.textContent = '';
    this.style = { setProperty: (key, value) => (this.style[key] = value) };
    this.listeners = {};
  }
  set className(value) { this._classes = new Set(value.split(/\s+/).filter(Boolean)); }
  get className() { return Array.from(this._classes).join(' '); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  appendChild(node) { node.remove(); this.children.push(node); node.parentNode = this; }
  remove() { if (this.parentNode) { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; } }
  getBoundingClientRect() { return { width: 180, height: 225, left: 10, bottom: 30 }; }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  click() { if (!this.disabled) for (const handler of this.listeners.click || []) handler({ stopPropagation() {} }); }
  querySelector(selector) { if (selector === 'button:not(:disabled)') return this.children.find((node) => node.tagName === 'button' && !node.disabled) || null; return null; }
  focus() {}
}
const document = { body: new FakeElement('body'), createElement: (tag) => new FakeElement(tag) };
const session = { terminalId: 'tab-1', tabPinned: false, tabColor: '', server: { name: 'Example terminal', type: 'local' } };
const state = { terminals: new Map([['tab-1', session]]) };
const actions = [];
const context = {
  document, state, console, Promise,
  window: { innerWidth: 700, innerHeight: 600 },
  requestAnimationFrame: (fn) => fn(),
  closeTerminalTabPicker: () => {},
  hideSidebarContextMenu: () => {},
  getTerminalTabTitle: (s) => s.server.name,
  normalizeTerminalTabColor: (color) => color || '',
  setTerminalTabPinned: (id, value) => { actions.push(['pin', id, value]); session.tabPinned = value; },
  renderV7MinimalSessionList: () => actions.push(['render']),
  openTerminalTabRenameModal: (id) => actions.push(['rename', id]),
  closeTerminalSession: (id, options) => actions.push(['close', id, options?.force === true]),
  setTerminalTabColor: (id, color) => { actions.push(['color', id, color]); session.tabColor = color; },
  showToast: (message) => { throw Error(message); }
};
vm.createContext(context);
function slice(start, end) {
  const a = js.indexOf(start);
  const b = js.indexOf(end, a);
  assert(a !== -1 && b > a, `Cannot isolate ${start}`);
  return js.slice(a, b);
}
vm.runInContext('let terminalTabContextMenu = null; function closeTerminalTabContextMenu() { terminalTabContextMenu?.remove(); terminalTabContextMenu = null; }', context);
vm.runInContext(slice('function terminalTabMenuButton(', '\nfunction showTerminalTabContextMenu('), context);
vm.runInContext(slice('let v7SessionGroupCounter = 0;', '\nfunction getV7SessionStatus('), context);
function openMenu() {
  context.showV7SessionActionsMenu('tab-1', { left: 15, bottom: 32 });
  const menu = document.body.children[0];
  assert(menu, 'Menu did not open');
  return menu;
}
async function run() {
  let menu = openMenu();
  assert.equal(menu.attributes.role, 'menu');
  assert.deepEqual(menu.children.slice(0, 4).map((item) => item.textContent), ['Pin', 'New Group', 'Rename', 'Close']);
  const colors = menu.children[5];
  assert.equal(colors.children.length, 8);
  assert.equal(colors.children[0].attributes['aria-label'], 'Clear session color');
  menu.children[0].click();
  await Promise.resolve();
  assert(actions.some((x) => x[0] === 'pin' && x[2] === true), 'Pin action missing');
  menu = openMenu();
  assert.equal(menu.children[0].textContent, 'Unpin');
  assert.equal(menu.children[3].disabled, false, 'Pinned tab must be closable');
  menu.children[3].click();
  await Promise.resolve();
  assert(actions.some((x) => x[0] === 'close' && x[1] === 'tab-1' && x[2] === true), 'Pinned Close must use explicit force path');
  menu = openMenu();
  menu.children[0].click();
  await Promise.resolve();
  menu = openMenu();
  menu.children[1].click();
  await Promise.resolve();
  assert(session.v7GroupId, 'New Group must assign group');
  assert(session.v7GroupName, 'New Group must have a visible name');
  menu = openMenu();
  menu.children[2].click();
  await Promise.resolve();
  assert(actions.some((x) => x[0] === 'rename'));
  menu = openMenu();
  menu.children[5].children[3].click();
  assert.equal(session.tabColor, '#a0d96e', 'Palette action did not use the existing color setter');
  // Legacy swatches stay recognizable in the new palette, without rewrites.
  session.tabColor = '#ff746b';
  menu = openMenu();
  assert.equal(menu.children[5].children[1].attributes['aria-pressed'], 'true', 'Legacy red must select Coral Red swatch');
  assert.equal(menu.children[5].children[1].attributes['aria-label'], 'Set session color Coral Red');
  assert.equal(session.tabColor, '#ff746b', 'Displaying legacy color must not change saved value');
  menu = openMenu();
  menu.children[5].children[0].click();
  assert.equal(session.tabColor, '', 'Clear color should reset the session color');
  menu = openMenu();
  menu.children[3].click();
  await Promise.resolve();
  assert(actions.some((x) => x[0] === 'close' && x[2] === true), 'Close must use original session close handler explicitly');
  assert.equal(state.terminals.size, 1, 'Menu must never mutate running sessions directly');
  console.log('PASS: V7 session cards, pinned close, groups, rich color palette, and legacy palette compatibility');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
