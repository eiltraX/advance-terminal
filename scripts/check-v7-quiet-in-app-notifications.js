'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(base, 'src/renderer/renderer.js'), 'utf8');
const html = fs.readFileSync(path.join(base, 'src/renderer/index.html'), 'utf8');
function between(from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `missing source region ${from}`);
  return source.slice(start, end);
}
const definitions = [
  between("const IN_APP_TOAST_MODE_STORAGE_KEY", "function previewNotification()"),
  between('function dismissToast()', '// Prompt-only terminals'),
].join('\n');
assert.ok(html.includes('<select id="in-app-toast-mode-select">'), 'Mode control is in Appearance settings');
for (const s of ['important', 'errors', 'all', 'off']) assert.ok(html.includes(`value="${s}"`), `${s} option`);
assert.ok(source.includes("$('#in-app-toast-mode-select')?.addEventListener('change'"), 'Select change listener');
assert.ok(source.includes('updateInAppToastModeControl();\n  updatePasteProtectionControls();'), 'Initialize select on startup');
assert.ok(source.includes('showToast(`Notification preview: ${label}`, 4500, \'info\', { force: true })'), 'Preview remains supported');
assert.ok(source.includes('onTerminalNotificationOpen?.((payload)'), 'Native Windows notification click routing preserved');
assert.ok(!source.includes("showToast(`${session.server?.name || 'Terminal'} disconnected. Auto reconnect is scheduled."), 'Routine auto-reconnect warning toast suppressed');
assert.ok(source.includes('if (errorMessage || Number(payload.code)) {'), 'Real disconnect errors still toast');
assert.ok(!source.includes("window.advanceTerminal.saveSettings(state.settings.ui.inAppToastMode)"));

const saved = new Map();
const localStorage = {
  getItem(k) { return saved.get(k) || null; },
  setItem(k, v) { saved.set(k, String(v)); },
};
const events = [];
let currentTime = 100000;
const toast = {
  textContent: '',
  offsetWidth: 20,
  attributes: {},
  classes: new Set(['hidden']),
  classList: {
    add(...names) { names.forEach(n => toast.classes.add(n)); },
    remove(...names) { names.forEach(n => toast.classes.delete(n)); },
  },
  setAttribute(k,v) {this.attributes[k] = v;},
};
const select = { value: 'all' };
const ctx = {
  Map, Set, Date: { now: () => currentTime }, Number, String,
  localStorage,
  $: selector => ({ '#toast': toast, '#in-app-toast-mode-select': select }[selector] || null),
  inferToastType: (_message, explicit) => explicit || 'info',
  applyNotificationPosition() {},
  getNotificationPosition() { return 'top-right'; },
  appendActivityFeedEvent: (msg, type) => events.push({msg,type}),
  clearTimeout() {},
  setTimeout: () => 77,
};
vm.createContext(ctx);
vm.runInContext(definitions,ctx);
function run(str) { return vm.runInContext(str,ctx); }
const count = () => events.length;
run("showToast('Connected', 4000, 'success')");
assert.equal(count(),0,'Default quiet mode suppresses routine success');
run("showToast('Copied', 4000, 'info')");
assert.equal(count(),0,'Default quiet mode suppresses info');
run("showToast('Password needed', 4000, 'warning')");
assert.equal(count(),1,'Warning remains visible');
run("showToast('Password needed', 4000, 'warning')");
assert.equal(count(),1,'Duplicate warning suppressed');
run("showToast('Another warning', 4000, 'warning')");
assert.equal(count(),2,'Distinct warning remains visible');
run("showToast('SSH auth failed', 4000, 'error')");
assert.equal(count(),3,'Error remains visible');
run("showToast('SSH auth failed', 4000, 'error')");
assert.equal(count(),3,'Duplicate error suppressed');
currentTime += 6100;
run("showToast('SSH auth failed', 4000, 'error')");
assert.equal(count(),4,'Errors can appear again after 6 seconds');
run("setInAppToastMode('errors')");
assert.equal(select.value,'errors');
assert.equal(saved.get('advanceTerminal.ui.inAppToastMode'),'errors');
run("showToast('Warning hidden', 4000, 'warning')");
assert.equal(count(),4,'Errors-only suppresses warnings');
run("showToast('Different error', 4000, 'error')");
assert.equal(count(),5);
run("setInAppToastMode('all')");
run("showToast('Connected', 4000, 'success')");
assert.equal(count(),6,'All mode restores routine success');
run("setInAppToastMode('off')");
run("showToast('Hidden error', 4000, 'error')");
assert.equal(count(),6,'Opt-in Off suppresses every toast');
run("showToast('Preview', 4500, 'info', { force: true })");
assert.equal(count(),7,'Preview overrides suppression');
run("setInAppToastMode('important')");
run("showToast('Default warning', 4000, 'warning')");
assert.equal(count(),8,'Mode switching immediately takes effect');
assert.equal(toast.attributes['aria-live'],'polite');
assert.equal(toast.classes.has('toast-warning'),true);
console.log('PASS: V7 quiet in-app notifications, mode persistence, dedupe, explicit preview, warnings/errors, desktop notification separation');
