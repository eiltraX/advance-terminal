// V7 unified Settings flyout; safe read-only preflight / post-patch checks.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const r = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const originals = {"src/renderer/renderer.js": "43679352c4379e29ef95320193fa8bc57633732db5466b21848f28c4991fb155", "src/renderer/v7-push-flyout.css": "c89f74087ad4a83d9efc44de3816e0f11164ecd9fd3e77d940d2c326b5e614d8"};
if (process.argv.includes('--before')) {
  for (const [file, hash] of Object.entries(originals)) {
    assert.equal(sha(file), hash, `STOP: ${file} differs from inspected source. Upload current copies before overwriting.`);
  }
  console.log('PASS: Current Settings flyout sources match inspected V7 snapshot. Back up and install patch.');
  process.exit(0);
}
const renderer = r('src/renderer/renderer.js');
const css = r('src/renderer/v7-push-flyout.css');
assert(renderer.includes('function populateUnifiedSettingsFlyout()'));
assert(renderer.includes("if (window.v7PushFlyout?.active !== 'settings') return;"));
assert(renderer.includes('renderSettings();\n      populateUnifiedSettingsFlyout();'));
for (const fn of ['updatePasteProtectionControls()', 'renderSettingsRestorePoints()', 'renderTerminalActionsSettings()', 'refreshAiStatus({ silent: true })', 'refreshSshKeys({ silent: true })', 'refreshUpdateStatus()']) {
  const helper = renderer.split('function populateUnifiedSettingsFlyout() {')[1].split('\nfunction setActiveView(')[0];
  assert(helper.includes(fn), `${fn} section not initialized`);
}
assert(css.includes('#settings-view .settings-nav {\n  display: none !important;'));
assert(css.includes('#settings-view .settings-section:not(.active) {\n  display: block !important;'));
assert(css.includes('overflow-y: auto;'));
const html = r('src/renderer/index.html');
for (const name of ['safety','restore','terminal-actions','ai','keys','updates']) {
  assert(html.includes(`id="settings-tab-${name}"`), `${name} original form missing`);
}
new (require('node:vm').Script)(renderer, {filename:'renderer.js'});
console.log('PASS: All six Settings sections, on-demand hydration, preserved controls, single scroll pane, and JS syntax.');
