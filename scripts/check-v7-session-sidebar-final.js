const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const file = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const hash = (name) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const originals = {
  'src/renderer/index.html': '52827af33a79c55fa7c1478fe5c5014bdfcc9b7d9701cab674dded91a1cae7a5',
  'src/renderer/renderer.js': '91908451f4a89d1a4f7954b0f691ba793ffab753e511e0ef3a75f596a080dbdc',
  'src/renderer/v7-minimal-shell.css': '1f6368dd1d961c9c9c658d72cc23924b1b7d678dff484b5c51f77e2a24974975'
};
if (process.argv.includes('--before')) {
  for (const [name, expected] of Object.entries(originals)) {
    assert.strictEqual(hash(name), expected, `STOP: ${name} differs from the inspected Sessions-Only V7 baseline`);
  }
  console.log('PASS: Current V7 frontend matches the inspected Sessions-Only patch. Back up affected files before replacing them.');
  process.exit(0);
}
const html = file('src/renderer/index.html');
const js = file('src/renderer/renderer.js');
const css = file('src/renderer/v7-minimal-shell.css');
for (const marker of ['id="v7-session-search"', 'id="v7-session-count"', 'id="v7-session-list"', 'data-v7-sidebar-view="servers"', 'data-v7-sidebar-view="commands"', 'id="server-list"', 'id="command-list"']) {
  assert(html.includes(marker), `Missing expected UI: ${marker}`);
}
for (const marker of ['function getV7SessionStatus(session)', 'function createV7SessionRow(terminalId)', 'function renderV7MinimalSessionList()', 'function setV7SidebarView(view)', "sessionSearch?.addEventListener('input', renderV7MinimalSessionList)", "showTerminalTabContextMenu(terminalId", "row.classList.toggle('is-pinned'", 'list.insertBefore(node, list.children[index] || null)']) {
  assert(js.includes(marker), `Missing existing-feature integration: ${marker}`);
}
for (const marker of ['.v7-session-search', '.v7-session-row.active', '.v7-session-actions:focus-visible', '.v7-session-row.is-working', '#servers-panel.v7-sessions-only .left-tab-panel']) {
  assert(css.includes(marker), `Missing session UI styles: ${marker}`);
}
assert(!js.includes('localStorage.setItem(\'advanceTerminal.v7.sidebar'), 'The sidebar must not persist hidden settings changes');

class FakeClassList {
  constructor(el) { this.el = el; this.classes = new Set(); }
  add(s) { this.classes.add(s); }
  contains(s) { return this.classes.has(s); }
  toggle(s, force) { const on = force === undefined ? !this.contains(s) : Boolean(force); on ? this.add(s) : this.classes.delete(s); return on; }
}
class FakeElement {
  constructor(tag) {
    this.tagName = tag.toLowerCase(); this.children = []; this.parentNode = null; this.attributes = {};
    this.dataset = {}; this.classList = new FakeClassList(this); this.style = { values: {}, setProperty: (k, v) => this.style.values[k] = v, removeProperty: (k) => delete this.style.values[k] };
    this.events = {}; this._className = ''; this.textContent = ''; this.value = ''; this.hidden = false; this.focused = false;
  }
  set className(value) { this._className = value; this.classList.classes = new Set(value.split(/\s+/).filter(Boolean)); }
  get className() { return Array.from(this.classList.classes).join(' '); }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k]; }
  append(...nodes) { for (const node of nodes) this.insertBefore(node, null); }
  appendChild(node) { this.insertBefore(node, null); return node; }
  insertBefore(node, next) {
    if (node.parentNode) node.remove();
    const index = next ? this.children.indexOf(next) : -1;
    if (next && index < 0) throw new Error('insertBefore invalid sibling');
    this.children.splice(index < 0 ? this.children.length : index, 0, node); node.parentNode = this;
    return node;
  }
  remove() { if (!this.parentNode) return; const arr = this.parentNode.children; arr.splice(arr.indexOf(this), 1); this.parentNode = null; }
  addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
  fire(type, props = {}) { for (const fn of this.events[type] || []) fn({ key: '', shiftKey: false, preventDefault() {}, stopPropagation() {}, currentTarget: this, target: this, ...props }); }
  matches(selector) { return selector.startsWith('.') ? this.classList.contains(selector.slice(1)) : this.tagName === selector; }
  querySelector(selector) {
    const names = selector.trim().split(/\s+/);
    const search = (root, i) => {
      for (const child of root.children) {
        if (child.matches(names[i])) {
          if (i === names.length - 1) return child;
          const nested = search(child, i + 1); if (nested) return nested;
        }
        const fromDesc = search(child, i); if (fromDesc) return fromDesc;
      }
      return null;
    };
    return search(this, 0);
  }
  getBoundingClientRect() { return { left: 5, bottom: 30 }; }
  focus() { this.focused = true; }
}
const list = new FakeElement('div');
const count = new FakeElement('span');
const search = new FakeElement('input');
const sessions = [
  { terminalId: 'one', tabPinned: true, tabColor: '#aabbcc', tabCustomTitle: 'Agmula', server: { type: 'remote', name: 'Sensitive host omitted' }, status: 'connected', processBusy: false, closed: false },
  { terminalId: 'two', tabPinned: false, server: { type: 'local', name: 'PowerShell' }, status: 'connected', processBusy: false, closed: false },
  { terminalId: 'three', tabPinned: true, server: { type: 'remote', name: 'Soloo' }, status: 'disconnected', closed: true }
];
const state = { terminals: new Map(sessions.map(x => [x.terminalId, x])), activeTerminalId: 'one', activeView: 'terminal' };
const calls = [];
const elements = { '#v7-session-list': list, '#v7-session-count': count, '#v7-session-search': search };
const context = {
  document: { createElement: (tag) => new FakeElement(tag) }, state,
  createV7SessionGroupHeader: (id, name) => { const el = new FakeElement('div'); el.className = 'v7-session-group-header'; el.dataset.v7GroupId = id; el.textContent = name; return el; },
  $: (selector) => elements[selector],
  getTerminalTabTitle: (session) => session.tabCustomTitle || session.server.name,
  normalizeTerminalTabColor: (color) => /^#[0-9a-f]{6}$/i.test(color || '') ? color.toLowerCase() : '',
  isTerminalTabWorking: (session) => !session.closed && (session.processBusy || ['connecting','reconnecting'].includes(session.status)),
  showV7SessionActionsMenu: (...args) => calls.push(['actions', ...args]),
  closeTerminalSession: (...args) => calls.push(['close', ...args]),
  activateTerminalAndFocus: (id) => calls.push(['activate', id]),
  setActiveView: (...args) => calls.push(['view', ...args]),
  focusTerminal: (s) => calls.push(['focus', s.terminalId]),
};
vm.createContext(context);
const paletteStart = js.indexOf('const V7_SESSION_PALETTE = [');
const paletteEnd = js.indexOf('\nfunction createV7SessionGroup(terminalId)', paletteStart);
assert(paletteStart > -1 && paletteEnd > paletteStart, 'Palette helpers missing');
vm.runInContext(js.slice(paletteStart, paletteEnd), context);
const start = js.indexOf('function getV7SessionStatus(session) {');
const end = js.indexOf('\nfunction setV7MenuOpen(open)', start);
assert(start > -1 && end > start, 'Cannot isolate session sidebar functions');
vm.runInContext(js.slice(start, end), context);
context.renderV7MinimalSessionList();
assert.strictEqual(list.children.length, 3);
assert.strictEqual(count.textContent, '3');
assert(list.children[0].classList.contains('is-pinned'));
assert.strictEqual(list.children[2].querySelector('.v7-session-name small').textContent, 'Disconnected');
assert.strictEqual(list.children[0].querySelector('.v7-session-name strong').textContent, 'Agmula');
const stableRow = list.children[0];
context.renderV7MinimalSessionList();
assert.strictEqual(list.children[0], stableRow, 'Repeated render should reuse the same control node');
stableRow.querySelector('.v7-session-item').fire('click');
assert(calls.some(c => c[0] === 'focus' && c[1] === 'one'), 'Clicking active session must refocus without reactivation');
assert(!calls.some(c => c[0] === 'activate'), 'Clicking active session should not cause full tab rebuild');
stableRow.querySelector('.v7-session-actions').fire('click');
assert(calls.some(c => c[0] === 'actions' && c[1] === 'one'), 'Menu actions must be reachable by click');
stableRow.querySelector('.v7-session-item').fire('keydown', {key: 'F10', shiftKey: true});
assert(calls.filter(c => c[0] === 'actions' && c[1] === 'one').length === 2, 'Shift+F10 must work');
stableRow.querySelector('.v7-session-close').fire('click');
assert(calls.some(c => c[0] === 'close' && c[1] === 'one'), 'The hover close button must use the existing close handler');
assert.strictEqual(stableRow.querySelector('.v7-session-close').disabled, false, 'Pinned sessions must be closable by X');
assert(calls.some(c => c[0] === 'close' && c[1] === 'one' && c[2]?.force === true), 'Pinned session X must request explicit close');
sessions[1].processBusy = true;
context.renderV7MinimalSessionList();
assert(list.children[1].classList.contains('is-working'), 'Background status must show without changing active session');
assert.strictEqual(list.children[1].querySelector('.v7-session-name small').textContent, 'Running command');
assert.strictEqual(state.activeTerminalId, 'one');
search.value = 'power';
context.renderV7MinimalSessionList();
assert.strictEqual(list.children.length, 1);
assert.strictEqual(list.children[0].dataset.terminalId, 'two');
assert.strictEqual(state.terminals.size, 3, 'Search must never delete sessions');
list.children[0].querySelector('.v7-session-item').fire('click');
assert(calls.some(c => c[0] === 'activate' && c[1] === 'two'), 'Other sessions must activate');
search.value = 'nonsense';
context.renderV7MinimalSessionList();
assert.strictEqual(list.children.length, 1);
assert.strictEqual(list.children[0].textContent, 'No matching open sessions');
search.value = '';
context.renderV7MinimalSessionList();
assert.strictEqual(list.children.length, 3);
assert.strictEqual(state.terminals.size, 3);
sessions[1].v7GroupId = 'group-1';
sessions[1].v7GroupName = 'Group 1';
context.renderV7MinimalSessionList();
assert.strictEqual(list.children.length, 4, 'New Group should add a visible group header without duplicating sessions');
assert.strictEqual(list.children[1].textContent, 'Group 1');
assert.strictEqual(list.children[2].dataset.terminalId, 'two');
assert.strictEqual(state.terminals.size, 3, 'Grouping must not change connection/session records');
// Render existing saved colors using the new dark-mode palette without writing to settings.
sessions[0].tabColor = '#ff746b';
context.renderV7MinimalSessionList();
const newColorRow = list.children.find((node) => node.dataset.terminalId === 'one');
assert(newColorRow, 'Restored tab row must exist');
assert.strictEqual(newColorRow.style.values['--v7-session-color-idle'], '#422725');
assert.strictEqual(newColorRow.style.values['--v7-session-color-hover'], '#754039');
assert.strictEqual(newColorRow.style.values['--v7-session-color-active'], '#a54e47');
assert.strictEqual(sessions[0].tabColor, '#ff746b', 'Legacy saved color must not be overwritten');
sessions[0].tabColor = '';
context.renderV7MinimalSessionList();
assert.strictEqual(newColorRow.style.values['--v7-session-color-active'], undefined, 'Color reset must clear previous palette variables');
console.log('PASS: V7 Sessions Sidebar search, count, active tab, keyboard actions, pin, status, background loading, keyed rendering, and data isolation');
