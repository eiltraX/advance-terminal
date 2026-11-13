/* eslint-disable no-console */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
assert.match(html, /id="v7-composer-multiline-toggle"[^>]*aria-pressed="false"/);
assert.match(html, /id="v7-composer-input"/);
assert.match(html, /v7-multiline-composer\.css/);
const start = source.indexOf('// V7 command composer:');
const end = source.indexOf('function bindEvents() {', start);
assert.ok(start > 0 && end > start, 'Composer source block missing');
assert.match(source, /pane\.addEventListener\('paste', terminalPasteHandler, true\)/);
assert.match(source, /pane\.removeEventListener\('paste', session\.terminalPasteHandler, true\)/);
assert.match(source, /options\?\.normalizeLineEndings === false[\s\S]*?replace\(\/\\r\\n\|\\n\|\\r\/g, '\\r'\)/);

function element() {
  const handlers = new Map();
  const classes = new Set();
  const attrs = new Map();
  return {
    value: '', checked: false, disabled: false, hidden: true,
    title: '', rows: 1, scrollHeight: 155, selectionStart: 0, selectionEnd: 0,
    focusCalled: 0,
    style: { height: '', removeProperty(key) { if (key === 'height') this.height = ''; } },
    classList: { toggle(key, enabled) { enabled ? classes.add(key) : classes.delete(key); }, contains(key) { return classes.has(key); } },
    setAttribute(name, value) { attrs.set(name, value); },
    getAttribute(name) { return attrs.get(name); },
    addEventListener(name, listener) { handlers.set(name, listener); },
    fire(name, data = {}) { assert.ok(handlers.has(name), `Missing ${name} handler`); return handlers.get(name)(data); },
    focus() { this.focusCalled++; },
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  };
}
function press(key, mods={}) {
  const event = {key, keyCode:13, isComposing:false, shiftKey:false, ctrlKey:false, metaKey:false,
    prevented:false, preventDefault(){this.prevented=true;}, ...mods};
  input.fire('keydown', event);
  return event;
}
const names = [
  'v7-composer-input', 'v7-composer-send', 'v7-composer-auto-send',
  'v7-composer-project', 'v7-command-composer', 'v7-composer-multiline-toggle',
  'v7-composer-multiline-hint'
];
const nodes = new Map(names.map(n => [n, element()]));
const $ = selector => nodes.get(selector.slice(1)) || null;
const input = $('#v7-composer-input');
const btn = $('#v7-composer-multiline-toggle');
const auto = $('#v7-composer-auto-send');
const state = {
  activeTerminalId: 'local-a',
  terminals: new Map([
    ['local-a', {terminalId:'local-a', closed:false}],
    ['ssh-b', {terminalId:'ssh-b', closed:false}]
  ])
};
const writes = [];
const notices = [];
const frames = [];
const ctx = {
  $, state, console,
  isMultilinePasteText: text => /[\r\n]/.test(text),
  writeClipboardTextToTerminal: async (_session, text, _source, options) => {
    writes.push({text, options}); return true;
  },
  showToast: (msg) => notices.push(msg),
  localStorage: { getItem: () => null, setItem(){} },
  requestAnimationFrame: fn => frames.push(fn),
  toggleV7NewSessionMenu(){}
};
vm.createContext(ctx);
vm.runInContext(source.slice(start, end) + `\nthis.__test = {
  bindV7CommandComposer, syncV7CommandComposer,
  getDraft(id) { return v7ComposerDrafts.get(id); },
  getMulti(id) { return v7ComposerMultilineModes.has(id); }
};`, ctx, {timeout:1200});
const api = ctx.__test;
api.bindV7CommandComposer();
assert.equal($('#v7-command-composer').classList.contains('is-multiline'),false);
assert.equal($('#v7-composer-send').disabled,true);

function setDraft(text) {
  input.value=text;
  input.fire('input');
}
async function flush(){ await new Promise(resolve => setImmediate(resolve)); }

(async () => {
  setDraft('Get-Date');
  assert.equal(input.rows,1);
  assert.equal(press('Enter').prevented,true, 'Single-line Enter must still send');
  await flush();
  assert.equal(writes.length,1);
  assert.equal(writes[0].text,'Get-Date');
  assert.equal(writes[0].options.requireMultilineConfirm,false);

  btn.fire('click');
  assert.equal(btn.getAttribute('aria-pressed'),'true');
  assert.equal(input.rows,5);
  assert.equal(input.style.height,'155px');
  assert.equal($('#v7-composer-multiline-hint').hidden,false);
  setDraft('Get-Date\nGet-Location');
  assert.equal(press('Enter').prevented,false, 'Multi-line Enter must insert line break');
  assert.equal(press('Enter',{shiftKey:true}).prevented,false);
  assert.equal(press('Enter',{ctrlKey:true}).prevented,true);
  await flush();
  assert.equal(writes.length,2);
  assert.equal(writes[1].text,'Get-Date\nGet-Location');
  assert.equal(writes[1].options.requireMultilineConfirm,true,'Multi-line commands require review');
  assert.equal(input.value,'');
  assert.equal(btn.getAttribute('aria-pressed'),'true','Multi-line mode remains available for the next command');

  // Tab-specific draft preservation; do not send the wrong tab's draft.
  setDraft('echo multiline\necho second');
  state.activeTerminalId = 'ssh-b'; api.syncV7CommandComposer();
  assert.equal(input.value,'');
  assert.equal(input.rows,1);
  setDraft('echo from ssh');
  state.activeTerminalId = 'local-a'; api.syncV7CommandComposer();
  assert.equal(input.value,'echo multiline\necho second');
  assert.equal(input.rows,5);
  btn.fire('click');
  assert.equal(btn.getAttribute('aria-pressed'),'true','Cannot turn off multi-line mode with line breaks still present');
  assert.ok(notices.some(msg=>msg.includes('Remove line breaks')));

  // Auto-send is opt-in; multiline paste is never auto-sent.
  auto.checked = true;
  const pasted = 'echo first\necho second';
  const event = { clipboardData: {getData:()=>pasted}, preventDefault(){this.prevented=true;} };
  input.selectionStart = 0; input.selectionEnd = input.value.length;
  input.fire('paste', event);
  assert.equal(event.prevented,true);
  assert.equal(input.value,pasted);
  assert.equal(frames.length,0);
  assert.equal(writes.length,2);
  assert.equal(api.getDraft('local-a'),pasted);

  // One-line paste with auto-send ON retains the existing guarded feature.
  state.activeTerminalId = 'ssh-b'; api.syncV7CommandComposer();
  input.selectionStart=0; input.selectionEnd=input.value.length;
  input.fire('paste', {clipboardData:{getData:()=> 'echo safe'}, preventDefault(){}});
  assert.equal(frames.length,1);
  frames.shift()();
  assert.equal(frames.length,1);
  frames.shift()();
  await flush();
  assert.equal(writes.length,3);
  assert.equal(writes[2].text,'echo safe');

  // Paste into normal editor (auto-send OFF) should remain editable.
  auto.checked=false;
  setDraft('echo A\necho B');
  assert.equal(input.rows,5);
  assert.equal(press('Enter').prevented,false);
  assert.equal(press('Enter',{metaKey:true}).prevented,true);
  await flush();
  assert.equal(writes.length,4);
  assert.equal(writes[3].options.requireMultilineConfirm,true);
  console.log('PASS: Single-line Enter preserved; multi-line Enter edits and Ctrl+Enter sends.');
  console.log('PASS: Multi-line drafts expand, survive tab switching and require confirmation.');
  console.log('PASS: Single-line auto-send remains; multi-line clipboard text never auto-executes.');
  console.log('PASS: Terminal paste interception, CR normalization, and listener cleanup are present.');
})().catch(error => { console.error(error); process.exitCode=1; });
