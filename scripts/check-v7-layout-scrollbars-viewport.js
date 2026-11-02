// Read-only focused verification for V7 viewport, resize and scrollbars.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const js = read('src/renderer/renderer.js');
const html = read('src/renderer/index.html');
const css = read('src/renderer/v7-layout-consistency.css');
assert(html.includes('href="./v7-layout-consistency.css"'), 'V7 stylesheet not loaded');
assert(html.indexOf('href="./v7-layout-consistency.css"') > html.indexOf('href="./v7-command-autocomplete.css"'), 'Layout overrides must load last');
assert(js.includes('  setupV7TerminalHostResizeObserver();\n  state.activityFeedReady = true;'), 'Viewport observer not initialized');
assert.match(css, /#terminal-host > \.terminal-pane\s*\{[^}]*padding:\s*0/s, 'Pane must not contribute unmeasured padding');
assert.match(css, /#terminal-host > \.terminal-pane > \.xterm\s*\{[^}]*padding:\s*8px 8px 16px/s, 'Measured xterm gutter missing');
assert(css.includes('.xterm-viewport') && css.includes('width: 5px') && css.includes('scrollbar-width: auto') && css.includes('scrollbar-color: auto'), 'Custom Chromium xterm scrollbar must be 5px, not native thin');
assert(css.includes('border-radius: 999px') && css.includes('::-webkit-scrollbar-button') && css.includes('display: none'), 'Rounded scrollbar thumb and hidden buttons missing');
assert(css.includes('.server-list') && css.includes('.command-list') && css.includes('.v7-session-list'), 'Side list styling missing');
assert(css.includes('scroll-padding-bottom: 14px'), 'Last connection row scroll padding missing');
assert(!/\b(filter|opacity)\s*:/.test(css), 'Do not fade terminal text or scrollbar contents');

const start = js.indexOf('let v7TerminalHostResizeObserver = null;');
const end = js.indexOf('\nfunction openSecretModal(', start);
assert(start >= 0 && end > start, 'Cannot locate observer logic');
const host = { id: 'terminal-host' };
const live = { closed: false, pane: { classList: { contains: () => true } } };
const calls = [];
const queue = [];
let instance;
class FakeObserver {
  constructor(cb) { this.cb = cb; instance = this; }
  observe(node) { calls.push(['observe', node]); }
  fire(width, height) { this.cb([{contentRect:{width, height}}]); }
}
const state = { activeTerminalId:'one', terminals:new Map([['one', live]]) };
const sandbox = {
  state, ResizeObserver:FakeObserver, Number, Math,
  $: () => host,
  requestAnimationFrame: cb => { queue.push(cb); return queue.length; },
  fitTerminalSessionNow: session => calls.push(['fit',session])
};
vm.createContext(sandbox);
vm.runInContext(js.slice(start, end), sandbox);
sandbox.setupV7TerminalHostResizeObserver();
sandbox.setupV7TerminalHostResizeObserver();
assert.equal(calls.filter(([name]) => name === 'observe').length, 1, 'Attach observer once');
instance.fire(800, 600);
instance.fire(760, 600);
assert.equal(queue.length, 1, 'Coalesce multiple geometry changes into one animation frame');
queue.shift()();
assert.equal(calls.filter(([name]) => name === 'fit').length, 1, 'Fit once after actual resize');
instance.fire(760, 600);
assert.equal(queue.length, 0, 'No fit for identical dimensions');
instance.fire(759.7, 600);
assert.equal(queue.length, 0, 'Ignore subpixel/no-op shifts');
instance.fire(700, 590);
live.closed = true;
queue.shift()();
assert.equal(calls.filter(([name]) => name === 'fit').length, 2, 'Fit disconnected/restored display without backend resize');
live.closed = false;
instance.fire(680, 570);
state.activeTerminalId = 'gone';
queue.shift()();
assert.equal(calls.filter(([name]) => name === 'fit').length, 2, 'No fit when there is no active session');
console.log('PASS: bottom gutter, scrollbar styling, coalesced resize, disconnected display refit');
