'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// SHA-256 values from the current V7 inspection ZIP combined with the
// user-approved action-button/tab-loading patch. Read-only; no settings access.
const expected = {
  'src/renderer/index.html': 'ab703efc0c36ff37a2fbf5bd72c4484ded3ec78bd9ca84ae0021d354d78f8b1f',
  'src/renderer/styles.css': '6fa93d60145d048c7db1d33a593b55bb4d761e13f6903bf013fe545486a022da',
  'src/renderer/renderer.js': '567b4ab53134bd103649eae5619884a11efbea91b173506595868b80e1a94718',
};
for (const [name, hash] of Object.entries(expected)) {
  const file = path.resolve(process.cwd(), name);
  assert.ok(fs.existsSync(file), `STOP: Missing ${name}`);
  const found = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(found, hash, `STOP: ${name} has changed; do not overwrite with the layout patch.`);
}
console.log('PASS: Current V7 frontend matches the inspected tab-loading version. Safe to back up before applying.');
