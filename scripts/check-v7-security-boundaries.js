/* eslint-disable no-console */
'use strict';
// Isolated security regression test. No real Electron process or user profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');

function block(from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start + from.length);
  assert(start >= 0 && end > start, `Missing security block: ${from}`);
  return source.slice(start, end);
}

const navCode = block('function configureBrowserWindowSecurity(win) {', 'function createWindow() {');
assert.match(source, /configureBrowserWindowSecurity\(mainWindow\);\s+mainWindow\.setMenu\(null\)/);
const registered = new Map();
const navEvents = new Map();
const mockContents = {
  mainFrame: { name: 'top-frame' },
  isDestroyed: () => false,
  setWindowOpenHandler(fn) { this.popupHandler = fn; },
  on(event, fn) { navEvents.set(event, fn); }
};
const mockWindow = { isDestroyed: () => false, webContents: mockContents };
const context = { mainWindow: mockWindow, ipcMain: {handle(channel, fn) { registered.set(channel, fn); }} };
vm.createContext(context);
vm.runInContext(navCode + '\nconfigureBrowserWindowSecurity(mainWindow);', context, {timeout: 1000});
assert.equal(mockContents.popupHandler({url:'https://example.invalid'}).action, 'deny');
for (const eventName of ['will-navigate','will-frame-navigate']) {
  const cb = navEvents.get(eventName);
  assert.equal(typeof cb, 'function', `${eventName} guard missing`);
  let prevented = false;
  cb({preventDefault() { prevented = true; }});
  assert(prevented, `${eventName} did not block navigation`);
}

const ipcCode = block('function isTrustedRendererIpc(event) {', 'function getWindowFromEvent(event) {');
vm.runInContext(ipcCode, context, {timeout: 1000});
const handlers = [...source.matchAll(/registerTrustedIpcHandler\('([^']+)'/g)].map(match=>match[1]);
assert.equal(handlers.length, 33, 'Unexpected number of registered IPC endpoints');
assert.equal(new Set(handlers).size, handlers.length, 'Duplicate IPC channel registration');
assert.equal((source.match(/ipcMain\.handle\(/g) || []).length, 1,
  'Direct ipcMain.handle outside guarded registrar');
assert.match(source, /ipcMain\.on\('terminal:activity-complete', \(event, payload\) => \{\s+if \(!isTrustedRendererIpc\(event\)\) return;/);

let invoked = 0;
vm.runInContext('registerTrustedIpcHandler("security:fixture", (event, payload) => { return {ok:true, payload}; });', context);
const handler = registered.get('security:fixture');
assert.equal(typeof handler, 'function');
const trusted = {sender:mockContents, senderFrame:mockContents.mainFrame};
assert.equal(handler(trusted, 'fixture').ok, true, 'Trusted main frame rejected');
const denied = [
  {sender:{}, senderFrame:mockContents.mainFrame},
  {sender:mockContents, senderFrame:{}},
  {sender:mockContents, senderFrame:null},
  {}
];
for (const event of denied) {
  assert.equal(handler(event).ok, false, 'Untrusted IPC was accepted');
}
context.mainWindow = {...mockWindow, isDestroyed:()=>true};
assert.equal(handler(trusted).ok, false, 'Closed window retained IPC authority');
assert.match(html, /object-src 'none'; base-uri 'none'; frame-src 'none'/,
  'CSP does not reject embedded objects/base redirects/frames');
console.log('PASS: Unexpected popups and renderer navigation are blocked.');
console.log('PASS: All privileged IPC channels validate main-window and main-frame identity.');
console.log('PASS: Non-main-frame, unrelated and destroyed senders are rejected.');
console.log('PASS: Terminal notification IPC and local UI CSP are restricted.');
