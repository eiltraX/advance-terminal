// Visual-only V7 regressions. No profile, settings or SSH operations.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/renderer/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const section = css.split('Advance Terminal V7 — final compact dark workspace refinement.')[1];
assert(section, 'Final visual override missing');
const required = [
  [/grid-template-rows:\s*29px\s+54px\s+minmax\(0,\s*1fr\)\s+38px/, 'compact shell'],
  [/\.toolbar-panel\[data-toolbar-panel="terminal"\] \.tool-button\s*\{/, 'compact terminal buttons'],
  [/\.toolbar-panel\[data-toolbar-panel="terminal"\] \.tool-button > span:not\(\.tool-icon\)/, 'accessible icon-only labels'],
  [/\.workspace\s*\{[^}]*padding:\s*8px 0 0/, 'workspace spacing'],
  [/\.servers-panel \.left-tab\s*\{[^}]*border-radius:\s*12px 12px 0 0/, 'curved sidebar tabs'],
  [/#terminal-nav-back,\s*#terminal-nav-forward\s*\{[^}]*display:\s*none !important/, 'reload only'],
  [/\.workspace \.terminal-session-header\s*\{[^}]*margin:\s*8px 0/, 'header breathing room'],
  [/\.workspace \.terminal-location-pill\s*\{[^}]*height:\s*36px/, 'location capsule'],
  [/:root\[data-theme="dark"\] \.workspace \.terminal-location-pill\s*\{[^}]*background:\s*#292929/, 'location background'],
  [/:root\[data-theme="dark"\] \.workspace \.terminal-tabs\s*\{[^}]*--terminal-tab-strip-bg:\s*#0c0c0c/, 'unified black'],
];
for (const [pattern, label] of required) assert.match(section, pattern, label);
for (const id of ['terminal-nav-reload', 'terminal-nav-back','terminal-nav-forward', 'terminal-status', 'terminal-location']) {
  assert(html.includes(`id="${id}"`), `Required existing control ${id} missing`);
}
assert(html.includes('class="terminal-location-prefix">Location:</span>'), 'Location prefix must stay');
assert(!html.includes('>TERMINAL SESSION<'), 'Legacy label should not return');
assert(js.includes('renderTerminalToolbarActions()'), 'Existing toolbar behavior retained');
assert(js.includes("$('#terminal-nav-reload')?.addEventListener('click'"), 'Reload behavior retained');
console.log('PASS: V7 compact toolbar, layout spacing, black workspace, reload-only controls and preserved terminal hooks.');
