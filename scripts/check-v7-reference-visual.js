// Read-only visual source checks, no Electron profile or SSH connection writes.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(base,'src/renderer/styles.css'),'utf8');
const html=fs.readFileSync(path.join(base,'src/renderer/index.html'),'utf8');
const section=css.split('/* V7 visual match, phase 2:')[1];
assert.ok(section,'new design block not found');
for(const expression of [/grid-template-columns:\s*292px/,/terminal-session-summary\s*\{\s*gap:\s*21px/,/terminal-session-header\s*\{[\s\S]*?background:\s*#0e0e0e/,/terminal-location-pill\s*\{[\s\S]*?background:\s*#292929/,/terminal-tabs\s*\{[\s\S]*?background:\s*#222222/]){assert.match(section,expression);}
assert.match(html,/id="terminal-nav-reload"/);
assert.match(html,/class="terminal-location-pill"/);
assert.match(html,/id="terminal-status"/);
assert.match(html,/class="left-tab active"/);
assert.ok(!/terminal-session-label">TERMINAL SESSION/.test(html));
console.log('PASS: V7 reference-aligned CSS and required controls present.');
