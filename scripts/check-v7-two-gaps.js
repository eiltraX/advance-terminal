// Advance Terminal V7: verify the exact spacing-only source before/after applying the ZIP.
// Run: node scripts/check-v7-two-gaps.js --before  OR  --after
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const projectRoot = path.resolve(__dirname, '..');
const file = path.join(projectRoot, 'src', 'renderer', 'styles.css');
const before = '8e2930585c2ac93d206601e18dfcf7d5bab913977132390f3f5146d247c24da3';
const after = '77b7d27245e3e9707de46bea8097bb9a035a21da8009ec3aa7b570bb29dfef06';
const tail = '\n/* V7 spacing-only refinement: two 8px breathing gaps, no visual restyling.\n   Keep original tab shape, header surfaces, terminal area, and input behavior. */\n.terminal-tabs.has-tabs {\n  margin-top: 8px;\n}\n.terminal-tabs.has-tabs + .terminal-session-header {\n  margin-top: 8px;\n}\n';
const mode = process.argv[2];
if (!['--before', '--after'].includes(mode)) {
  console.error('USAGE: node scripts/check-v7-two-gaps.js --before | --after');
  process.exit(2);
}
try {
  const bytes = fs.readFileSync(file);
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (mode === '--before') {
    assert.equal(actual, before, 'STOP: styles.css differs from the verified reverted V7 baseline; do NOT apply the patch.');
    console.log('PASS: Exact pre-patch stylesheet verified. Safe to back up and copy the patched CSS.');
  } else {
    assert.equal(actual, after, 'FAIL: Spacing-only patched stylesheet is not installed as expected.');
    const text = bytes.toString('utf8');
    assert.ok(text.endsWith(tail), 'FAIL: the two spacing rules are absent or altered.');
    assert.equal(text.match(/\.terminal-tabs\.has-tabs\s*\{\s*margin-top:\s*8px;/g)?.length, 1);
    assert.equal(text.match(/\.terminal-tabs\.has-tabs\s*\+\s*\.terminal-session-header\s*\{\s*margin-top:\s*8px;/g)?.length, 1);
    console.log('PASS: Exactly two 8px spacing rules installed; all prior CSS bytes preserved.');
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
