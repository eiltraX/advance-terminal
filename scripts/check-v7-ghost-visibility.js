// V7 fix for inline completion invisibility: HTML indentation must not produce a hidden line box.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const expected = Object.freeze({
  before: Object.freeze({
    'src/renderer/v7-command-autocomplete.css': '558b8d533ce8a3a002d028238accec6c91845205766b86a4c02f9a4889771490',
    'scripts/check-v7-command-autocomplete.js': 'c899a88dfd0856edc8e25e90e47d2eb46f1c6725e5a659b997a432bfc61cbe58'
  }),
  after: Object.freeze({
    'src/renderer/v7-command-autocomplete.css': '839ba5132c0db069f078ed711c60ed1685ec50041c887d4574309ba8fa39fc83',
    'scripts/check-v7-command-autocomplete.js': '34288b7a8d5b026181be91086aa3a87be2909b9b7dec56a2e8d40d9283a2a157'
  })
});
const mode = process.argv.includes('--before') ? 'before' : 'after';
for (const [rel, digest] of Object.entries(expected[mode])) {
  const filename = path.join(root, rel);
  assert(fs.existsSync(filename), `STOP: Missing ${rel}`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  assert.equal(actual, digest, `STOP: ${rel} does not match inspected ${mode}-patch baseline; leave current files unchanged`);
}
if (mode === 'after') {
  const css = fs.readFileSync(path.join(root, 'src/renderer/v7-command-autocomplete.css'), 'utf8');
  assert(/\.v7-composer-ghost\s*\{[^}]*white-space:\s*normal\s*;/.test(css));
  assert(/\.v7-composer-ghost-line\s*\{[^}]*white-space:\s*pre\s*;/.test(css));
}
console.log(mode === 'before'
  ? 'PASS: V7 autocomplete source matches inspected baseline; safe to back up and apply CSS visibility hotfix.'
  : 'PASS: V7 ghost overlay CSS and updated autocomplete regression check installed correctly.');
