const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const sum = (name) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const originals = {
  "src/renderer/renderer.js": "1a24e88e24ac1d26f0d28ceefab57ba9c1f78e0b78d361046627cd9484f07103",
  "src/renderer/index.html": "8cbba177911565d06e4409b5155e8353767446f033be57e2a097441f96209433"
};
if (process.argv.includes('--before')) {
  for (const [name, expected] of Object.entries(originals)) {
    assert.strictEqual(sum(name), expected, `STOP: ${name} has changed since inspected snapshot`);
  }
  assert(!fs.existsSync(path.join(root, 'src/renderer/v7-minimal-shell.css')), 'STOP: minimal shell stylesheet already exists');
  console.log('PASS: Original renderer sources match inspected snapshot; safe to back up and apply.');
  process.exit(0);
}
const html = read('src/renderer/index.html');
const js = read('src/renderer/renderer.js');
const css = read('src/renderer/v7-minimal-shell.css');
for (const token of ['id="v7-shell-menu-toggle"','id="v7-shell-menu"','id="v7-global-search"','id="v7-global-results"','id="v7-session-list"','v7-minimal-shell.css']) {
  assert(html.includes(token), `Missing minimal-shell HTML: ${token}`);
}
for (const token of ['data-menu-action="settings"','data-menu-action="report"','data-menu-action="terminal"','id="tool-new-server"','id="terminal-tabs"','id="server-list"','id="connection-group-filter-toggle"','id="terminal-nav-reload"']) {
  assert(html.includes(token), `Lost original action/feature: ${token}`);
}
for (const token of ['bindV7MinimalShell()', 'renderV7MinimalSessionList()', 'showTerminalTabPicker(button)', 'renderV7GlobalResults()', 'state.settings?.servers', 'activateTerminalAndFocus(session.terminalId)']) {
  assert(js.includes(token), `Missing functional wiring: ${token}`);
}
assert(css.includes('grid-template-rows: 38px minmax(0, 1fr) 28px'));
assert(css.includes('v7-global-results[hidden]'));
assert(!css.includes('animation: infinite'));
const navs = [...html.matchAll(/data-menu-action="(terminal|view|settings|report|help)"/g)];
assert.strictEqual(navs.length, 5, 'Original five menu navigation actions must be retained exactly once');
console.log('PASS: Single app menu, centered search, sessions, actions, and safe terminal surface integration');
