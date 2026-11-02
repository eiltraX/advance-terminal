// V7 FINAL VISUAL PREFLIGHT: read-only; does not touch settings, SSH, or profiles.
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const file = path.resolve(__dirname, '../src/renderer/styles.css');
const expected = '8e2930585c2ac93d206601e18dfcf7d5bab913977132390f3f5146d247c24da3';
if (!fs.existsSync(file)) { console.error('STOP: styles.css is missing.'); process.exit(1); }
const found = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (found !== expected) {
  console.error('STOP: Current styles.css differs from the last verified V7 reference patch.');
  console.error('Expected:', expected);
  console.error('Found:   ', found);
  process.exit(1);
}
console.log('PASS: Stylesheet matches the inspected V7 snapshot. Back up before applying the final CSS.');
