"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root,"src/renderer/index.html"),"utf8");
const css = fs.readFileSync(path.join(root,"src/renderer/v7-design-forms-dialogs.css"),"utf8");
const tokenCss = fs.readFileSync(path.join(root,"src/renderer/v7-design-tokens.css"),"utf8");
const i1 = html.indexOf('href="./v7-design-tokens.css"');
const i2 = html.indexOf('href="./v7-design-forms-dialogs.css"');
assert(i1 !== -1 && i2 > i1,"Stage 2 styles must load after Stage 1 tokens");
assert.equal(html.match(/href="\.\/v7-design-forms-dialogs\.css"/g)?.length,1,"Exactly one Stage 2 stylesheet");
for (const key of ["--v7ds-radius-control", "--v7ds-radius-popup", "--v7ds-font-control", "--v7ds-focus-ring", "--v7ds-motion-fast"])
  assert(tokenCss.includes(key+":"),"Missing Stage 1 token " + key);
for (const key of ["#settings-view .settings-tab", "#settings-view .windows-group", ".modal .modal-box", "prefers-reduced-motion"])
  assert(css.includes(key),"Missing scoped Stage 2 rule: " + key);
for (const key of [".terminal-host", ".terminal-pane", ".xterm", ".v7-command-composer", ".v7-session-row", "scrollbar-width", "scrollbar-color", "grid-template-columns", "min-height:", "max-height:"])
  assert(!css.includes(key),"Protected layout/terminal rule introduced: " + key);
// The checkbox and radio exclusions guard our existing safety switches.
assert(css.includes(':not([type="checkbox"]):not([type="radio"])'));
console.log("PASS: V7 Stage 2 stylesheet order, scope, token reuse, accessibility and layout safeguards");
