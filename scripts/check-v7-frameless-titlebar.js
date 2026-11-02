'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const vm = require('vm');
const project = path.resolve(__dirname, '..');
const before = {
  "src/main/main.js": "144184717c0a2ed40f1fd7544739a6008710f7cde868bb8f1e4800149af66c27",
  "src/main/preload.js": "038640fd8c5c18a06c80f87600a11e522f365033eb89134f771a626c9de9c5a2",
  "src/renderer/index.html": "7b12839ca620e089d2318f24fc3a29ed65c597ec6bddf629b3f39f89450de044"
};
const after = {
  "src/main/main.js": "4e5b460ebbc1dd9b2452a94a52f62246d33290a27d4ef0aa3b20540de2f263d0",
  "src/main/preload.js": "c58e6ce354fb16b0f7add1e315419022f529efd379c0ed8f976b170262455cb8",
  "src/renderer/index.html": "8ba53a9b491422585c382c215da115c1a80fb35ed1bcf8afc02fbb03a55f023c",
  "src/renderer/v7-frameless-titlebar.css": "3c48995b22806ef13d578871f207ab4ccad9c858aba516191fefae38ce123b12",
  "src/renderer/v7-frameless-titlebar.js": "ed284d980b760e623634b3734a22ce17f1f32316585d88b68fa245ed626116f2"
};
const mode = process.argv[2] === '--before' ? 'before' : 'after';

function fileHash(file) {
  const abs = path.join(project, file);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
}

function verifyHashes() {
  const expected = mode === 'before' ? before : after;
  for (const [file, sha] of Object.entries(expected)) {
    const found = fileHash(file);
    assert.strictEqual(found, sha, `STOP: ${file} differs from expected ${mode} source. Expected ${sha}, found ${found || 'missing'}.`);
  }
  if (mode === 'before') {
    for (const file of ['src/renderer/v7-frameless-titlebar.css','src/renderer/v7-frameless-titlebar.js']) {
      assert.strictEqual(fileHash(file), null, `STOP: ${file} already exists; inspect before applying.`);
    }
  }
}

function verifySource() {
  const main = fs.readFileSync(path.join(project, 'src/main/main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(project, 'src/main/preload.js'), 'utf8');
  const html = fs.readFileSync(path.join(project, 'src/renderer/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(project, 'src/renderer/v7-frameless-titlebar.css'), 'utf8');
  const chrome = fs.readFileSync(path.join(project, 'src/renderer/v7-frameless-titlebar.js'), 'utf8');
  assert(main.includes('frame: false'), 'Window must be frameless');
  assert(main.includes('resizable: true'), 'Window must remain resizable');
  assert(main.includes("ipcMain.handle('window:getState'"), 'Read-only window state IPC must exist');
  assert(main.includes("ipcMain.handle('window:action'"), 'Existing window actions must remain present');
  assert(main.includes('getMonitorWindowOptions('), 'Responsive monitor logic must remain');
  assert(main.includes('terminalManager.closeAll()'), 'Existing terminal cleanup must remain');
  assert(preload.includes('getWindowState:'), 'Preload must expose window state');
  assert(preload.includes('onWindowStateChanged:'), 'Preload must expose state changes');
  assert(html.includes('v7-frameless-titlebar.css') && html.includes('v7-frameless-titlebar.js'), 'Chrome assets must load');
  assert(html.includes('v7-minimal-shell.css') && html.includes('v7-menu-settings-polish.css'), 'Existing styling must stay loaded');
  for (const id of ['v7-win-minimize', 'v7-win-maximize', 'v7-win-close','v7-global-search','v7-shell-menu-toggle']) {
    assert(html.includes(`id="${id}"`), `Missing control ${id}`);
  }
  assert(css.includes('-webkit-app-region: drag') && css.includes('-webkit-app-region: no-drag'), 'Draggable header and usable controls required');
  assert(css.includes('.v7-window-close:hover'), 'Close hover must be distinguishable');
  assert(!chrome.includes('setInterval('), 'No new recurring loop is allowed');
}

async function verifyBehavior() {
  const source = fs.readFileSync(path.join(project, 'src/renderer/v7-frameless-titlebar.js'), 'utf8');
  const buttons = new Map();
  for (const id of ['v7-win-minimize','v7-win-maximize','v7-win-close']) {
    const events = {};
    const classes = new Set();
    const attrs = {};
    buttons.set(id, {
      events, classes, attrs, title: '',
      classList: { toggle(cls, active) { if (active) classes.add(cls); else classes.delete(cls); } },
      setAttribute(key, val) { attrs[key] = val; },
      addEventListener(type, callback) { events[type] = callback; }
    });
  }
  const calls = [];
  let isMaximized = true;
  let stateListener = null;
  let unsubscribed = false;
  const windowEvents = {};
  const api = {
    windowAction: async (action) => {
      calls.push(action);
      if (action === 'maximize') { isMaximized = !isMaximized; stateListener?.({ok:true,maximized:isMaximized}); }
      return {ok:true};
    },
    getWindowState: async () => ({ok:true,maximized:isMaximized}),
    onWindowStateChanged: (callback) => { stateListener = callback; return () => {unsubscribed = true;}; }
  };
  const context = {
    window: { advanceTerminal:api, addEventListener:(type,cb)=>{windowEvents[type]=cb;} },
    document: { readyState:'complete', getElementById:(id)=>buttons.get(id) },
    Promise, console
  };
  vm.runInNewContext(source, context, {filename:'v7-frameless-titlebar.js'});
  await new Promise(setImmediate);
  const max = buttons.get('v7-win-maximize');
  assert(max.classes.has('is-maximized'), 'Initially maximized window must offer Restore');
  assert.strictEqual(max.attrs['aria-label'], 'Restore window');
  buttons.get('v7-win-minimize').events.click();
  await new Promise(setImmediate);
  max.events.click();
  await new Promise(setImmediate);
  assert(!max.classes.has('is-maximized'), 'Restore must update maximize button');
  assert.strictEqual(max.attrs['aria-label'], 'Maximize window');
  max.events.click();
  await new Promise(setImmediate);
  assert(max.classes.has('is-maximized'), 'Maximize must update restore icon');
  buttons.get('v7-win-close').events.click();
  await new Promise(setImmediate);
  assert.deepStrictEqual(calls, ['minimize','maximize','maximize','close']);
  assert.strictEqual(typeof windowEvents.beforeunload, 'function', 'Listeners must clean up on unload');
  windowEvents.beforeunload();
  assert(unsubscribed, 'State listener must unsubscribe');
}

(async () => {
  verifyHashes();
  if (mode === 'after') {
    verifySource();
    await verifyBehavior();
  }
  process.stdout.write(`PASS: V7 frameless window ${mode} source integrity${mode === 'after' ? ', controls, window-state notifications and layout safety' : ''}\n`);
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
