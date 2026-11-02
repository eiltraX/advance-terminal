"use strict";
// Read-only V7 appearance preflight + post-install check. No settings touched.
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const assert = require("assert");
const file = path.join(__dirname, "../src/renderer/styles.css");
const before = "6b42baa30319f79af74915f31c93277e9fff60d9dd1296eb3113fec2c1ba3320";
const after = "12b8ae7d0c1d23bc00c5c20bbed4e6083880012bd412bbab5c35f93bffd5feae";
const current = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
if (process.argv.includes("--before")) {
  if (current !== before) {
    console.error("STOP: Current V7 CSS differs from inspected baseline. Do not apply patch. SHA256=" + current);
    process.exit(1);
  }
  console.log("PASS: Inspected V7 CSS baseline matches; safe to back up and apply stylesheet.");
} else {
  assert.strictEqual(current, after, "Expected clean workspace stylesheet is not installed");
  const css = fs.readFileSync(file,"utf8");
  for (const rule of ["V7 Clean Workspace", "#terminal-nav-back", ".terminal-tabs", ".terminal-session-header", ".server-card", ".tool-button", ".terminal-tab.is-working"]) {
    assert(css.includes(rule), "Missing CSS rule: " + rule);
  }
  console.log("PASS: Clean V7 workspace stylesheet installed; visual rules present.");
}
