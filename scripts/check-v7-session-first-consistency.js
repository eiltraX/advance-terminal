/* UI06 — Session-first visual consistency guards. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const html = read('src/renderer/index.html');
const css = read('src/renderer/v7-session-first-consistency.css');
assert.equal((html.match(/v7-session-first-consistency\.css/g)||[]).length,1);
assert.ok(html.indexOf('v7-session-tree-safe.css') < html.indexOf('v7-session-first-consistency.css'));
for (const id of ['settings-view','v7-session-list','v7-session-search','safe-paste-multiline-toggle','at-settings-picker']) {
 assert.ok(html.includes(`id="${id}"`), `Missing current UI hook: ${id}`);
}
assert.ok(read('src/renderer/v7-settings-expand.js').includes('v7-settings-resize-handle'), 'Resize handle is dynamically created by existing UI03 code');
for (const marker of ['--at-ui-control: 32px','--at-ui-heading: 14px','#settings-view .report-option-row','#settings-view .at-settings-nav-list .settings-tab','@media (prefers-reduced-motion: reduce)']) assert.ok(css.includes(marker),marker);
for (const prohibited of ['#terminal-host',' .xterm ','.v7-session-row.is-child','grid-template-columns: 250px','transition: width','transition: grid-template-columns']) assert.ok(!css.includes(prohibited),`Unexpected risk: ${prohibited}`);
assert.ok(!css.includes('display: none !important'),'No UI controls should be hidden by theme');
console.log('PASS: Session-first Settings typography, controls and spacing; tree, PTY and resize unaffected.');
