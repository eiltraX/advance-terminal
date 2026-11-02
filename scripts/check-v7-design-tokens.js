"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "src/renderer/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "src/renderer/v7-design-tokens.css"), "utf8");
const tokens = [
  "--v7ds-font-ui", "--v7ds-font-control", "--v7ds-font-small",
  "--v7ds-radius-control", "--v7ds-radius-popup", "--v7ds-motion-fast",
  "--v7ds-focus-ring"
];
for (const token of tokens) assert(css.includes(token + ":"), `Missing token ${token}`);
const previous = html.indexOf('href="./v7-layout-consistency.css"');
const installed = html.indexOf('href="./v7-design-tokens.css"');
assert(previous !== -1 && installed > previous, "Design tokens must load after existing V7 overrides");
assert.equal(html.match(/href="\.\/v7-design-tokens\.css"/g)?.length, 1,
  "Design stylesheet must be included exactly once");
const forbidden = [
  "#terminal-host", ".xterm", ".terminal-pane", ".v7-command-composer",
  ".v7-session-row", "scrollbar-width", "scrollbar-color", "grid-template-columns",
  "--v7-session-color"
];
for (const selector of forbidden) assert(!css.includes(selector), `Protected style referenced: ${selector}`);
for (const selector of [".v7-header-icon", ".v7-flyout-close", ".v7-header-popup-item", ".v7-new-session-item", ".v7-result-item"])
  assert(css.includes(selector), `Missing control: ${selector}`);
assert(css.includes("prefers-reduced-motion"), "Motion accessibility preference must be honored");
console.log("PASS: V7 Stage 1 design tokens, stylesheet load order, scoped controls, protected terminal/layout styles");
