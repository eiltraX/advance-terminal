// UI-only verification: no profile, network, settings, or terminal writes.
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/renderer/styles.css'), 'utf8');
assert.match(html, /<div class="terminal-location-pill">\s*<span class="terminal-location-prefix">Location:<\/span>\s*<div id="terminal-location"/);
for (const id of ['terminal-nav-back','terminal-nav-forward','terminal-nav-reload','terminal-tabs','connection-group-filter-toggle','server-search','left-tab-connections','left-tab-commands']) {
  assert.ok(html.includes(`id="${id}"`), `Missing existing control: ${id}`);
}
assert.match(css, /\.servers-panel \.left-tabbar \{[^}]*border: 0;[^}]*box-shadow: none;/s);
assert.match(css, /\.servers-panel \.left-tab::before,\s*\.servers-panel \.left-tab::after \{[^}]*content: none;[^}]*display: none;/s);
assert.match(css, /\.servers-panel \.left-tab\.active \{[^}]*border|\.servers-panel \.left-tab\.active \{[^}]*box-shadow: none;/s);
assert.match(css, /\.terminal-location::before \{[^}]*content: none;/s);
assert.match(css, /\.terminal-location-pill \{[^}]*border-radius: 999px;/s);
assert.match(css, /#terminal-nav-back:disabled,\s*#terminal-nav-forward:disabled \{[^}]*display: none;/s);
assert.ok(!html.includes('TERMINAL SESSION</span>'), 'Removed label restored');
console.log('PASS: V7 smooth sidebar tabs, location pill, original tab controls, and duplicate-label guard');
