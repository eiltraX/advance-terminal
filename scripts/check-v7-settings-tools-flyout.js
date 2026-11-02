// V7 Settings gear + complete menu + Option A push flyout integration.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const text=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const originals={"src/renderer/index.html": "8ba53a9b491422585c382c215da115c1a80fb35ed1bcf8afc02fbb03a55f023c", "src/renderer/renderer.js": "e6e2e1be4968d8fa29b239cb525e89b0ffc6162e971da2490b15eb78e55b9f59", "src/renderer/v7-frameless-titlebar.js": "ed284d980b760e623634b3734a22ce17f1f32316585d88b68fa245ed626116f2"};
if(process.argv.includes('--before')) {
  for(const [file,expected] of Object.entries(originals)) {
    assert.equal(sha(file),expected,`STOP: ${file} differs from inspected V7 source; upload updated files before patching.`);
  }
  assert(!fs.existsSync(path.join(root,'src/renderer/v7-push-flyout.css')),
    'STOP: push flyout CSS is already present; inspect the live source before overwriting.');
  console.log('PASS: source matches inspected V7 header snapshot. Back up and install the patch.');
  process.exit(0);
}
const header=text('src/renderer/v7-frameless-titlebar.js');
const renderer=text('src/renderer/renderer.js');
const css=text('src/renderer/v7-push-flyout.css');
const html=text('src/renderer/index.html');
for (const label of ['Sessions','Servers','SSH','All Settings','Appearance','Terminal Actions','Terminal Safety','SSH Keys','Restore Points','AI Settings','Updates','Reports','Audit Log','Help','Quick Start']) {
  assert(header.includes(`label:'${label}'`),`Missing navigation entry: ${label}`);
}
assert(header.includes('function openSettingsSection(section)'));
assert(header.includes("settings.innerHTML = svg('settings')"));
assert(!header.includes("M12 2v2M12 20v2"),'Sun/light-mode icon still present');
assert(header.includes('workspace.insertBefore(panel, terminalArea)'),'Push flyout does not sit next to terminal');
assert(header.includes('content.appendChild(node)'),'Existing live nodes not reused');
assert(header.includes("const type = key === 'ssh' ? 'remote' : 'all'"),'SSH must filter existing connections');
assert(renderer.includes('function populateUnifiedSettingsFlyout()'));
for (const part of ['updatePasteProtectionControls()', 'renderSettingsRestorePoints()', 'renderTerminalActionsSettings()', 'refreshAiStatus({ silent: true })', 'refreshSshKeys({ silent: true })', 'refreshUpdateStatus()']) {
 const helper=renderer.split('function populateUnifiedSettingsFlyout() {')[1].split('\nfunction setActiveView(')[0];
 assert(helper.includes(part),`Settings section missing initializer: ${part}`);
}
assert(css.includes('.workspace.v7-flyout-open'));
assert(css.includes('grid-template-columns: 250px'));
assert(css.includes('max-height: min(76vh, 555px)'));
assert(css.includes('#settings-view .settings-nav {\n  display: none !important;'));
assert(css.includes('#settings-view .settings-section:not(.active) {\n  display: block !important;'));
assert(html.includes('href="./v7-push-flyout.css"'));
for(const id of ['safety','restore','terminal-actions','ai','keys','updates'])
 assert(html.includes(`id="settings-tab-${id}"`),`${id} original settings section missing`);
for(const js of ['src/renderer/v7-frameless-titlebar.js','src/renderer/renderer.js'])
 new (require('node:vm').Script)(text(js),{filename:js});
console.log('PASS: Settings gear icon, full menu, all six settings sections, push-side-panel routing and source syntax.');
