// V7 Option A: source preflight and installed patch verification.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const original={
  "src/renderer/renderer.js": "e6e2e1be4968d8fa29b239cb525e89b0ffc6162e971da2490b15eb78e55b9f59",
  "src/renderer/index.html": "8ba53a9b491422585c382c215da115c1a80fb35ed1bcf8afc02fbb03a55f023c",
  "src/renderer/v7-frameless-titlebar.js": "ed284d980b760e623634b3734a22ce17f1f32316585d88b68fa245ed626116f2"
};
if (process.argv.includes('--before')) {
  for (const [file,expected] of Object.entries(original)) {
    assert.equal(sha(file),expected,`STOP: ${file} changed since snapshot; upload current files first`);
  }
  assert(!fs.existsSync(path.join(root,'src/renderer/v7-push-flyout.css')),
    'STOP: push panel stylesheet already exists; inspect before overwriting');
  console.log('PASS: source matches inspected V7 snapshot; safe to back up and apply patch');
  process.exit(0);
}
const main=read('src/renderer/renderer.js');
const html=read('src/renderer/index.html');
const titlebar=read('src/renderer/v7-frameless-titlebar.js');
const css=read('src/renderer/v7-push-flyout.css');
assert(html.includes('href="./v7-push-flyout.css"'));
assert(main.includes('window.v7PushFlyout.openPage(view)'));
assert(main.includes('window.v7PushFlyout.openTool(normalized)'));
assert(titlebar.includes('workspace.insertBefore(panel, terminalArea)'));
assert(titlebar.includes('content.appendChild(node)'));
assert(titlebar.includes('setConnectionFilter(type)'));
for (const name of ['Sessions','Servers','SSH','Settings','Report','Help']) {
  assert(titlebar.includes(`label:'${name}'`),`${name} menu item missing`);
}
assert(titlebar.includes("{label:'SSH',tool:'ssh',icon:'ssh'}"));
assert(titlebar.includes("const type = key === 'ssh' ? 'remote' : 'all'"));
assert(titlebar.includes("view:'about',icon:'help'"));
assert(css.includes('.workspace.v7-flyout-open'));
assert(css.includes('grid-template-columns: 250px'));
assert(css.includes('.v7-flyout-content > .view.v7-flyout-visible'));
assert(!titlebar.includes("label: 'Commands', sidebar: 'commands'"));
assert(!titlebar.includes("label: 'Report', view: 'report'"));
new (require('node:vm').Script)(titlebar,{filename:'v7-frameless-titlebar.js'});
console.log('PASS: V7 push panel wiring, menu choices, SSH filter, terminal preservation, and CSS layout');
