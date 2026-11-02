// Advance Terminal V7 last-compact-layout rollback validation. READ ONLY.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const filename = path.resolve(__dirname, '../src/renderer/styles.css');
const expectedBefore = 'c8af8278dba32bcd4c1a8f9ab32101b5bf0902ff8e75d3af9d3fd87b25f30510';
const expectedAfter = '8e2930585c2ac93d206601e18dfcf7d5bab913977132390f3f5146d247c24da3';
const mode = process.argv[2];
if (mode !== '--before' && mode !== '--after') {
  console.error('Usage: node scripts/check-v7-compact-revert.js --before|--after');
  process.exit(2);
}
if (!fs.existsSync(filename)) {
  console.error('STOP: styles.css not found.');
  process.exit(1);
}
const actual = crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const expected = mode === '--before' ? expectedBefore : expectedAfter;
if (actual !== expected) {
  console.error('STOP: styles.css does not match the ' + (mode === '--before' ? 'last compact patch' : 'restored previous version') + '.');
  console.error('Expected SHA256: ' + expected);
  console.error('Actual SHA256:   ' + actual);
  process.exit(1);
}
console.log('PASS: V7 stylesheet ' + (mode === '--before' ? 'matches last compact patch; safe to back up and revert.' : 'restored to the verified previous version.'));
