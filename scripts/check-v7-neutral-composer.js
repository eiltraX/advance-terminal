// V7 neutral composer UI check; no settings, sessions, or SSH data are touched.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const cssFile = path.join(root, 'src/renderer/v7-command-composer.css');
const htmlFile = path.join(root, 'src/renderer/index.html');
const before = '967bd94b91b3071d751314c6d6ff1e9f6c9e66f59ae2de8dd77d240eac63193b';
const after = '4de87c5d6d61c2256303609d418ea1f73d59f375c666232410c0b55cf05882ba';
const beforeComposerCheck = '85511dfd475832274eb316bc9764361f8651423fc1bfb64206476194dfa07f21';
const afterComposerCheck = '09ad28f5891df662365b5139e7c6e200b3e11946e258a34dd7bf62533b8d72c2';
const composerCheckFile = path.join(root, 'scripts/check-v7-command-composer.js');
const autocompleteCheckFile = path.join(root, 'scripts/check-v7-command-autocomplete.js');
const ghostCheckFile = path.join(root, 'scripts/check-v7-ghost-visibility.js');
const digestFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const expectedOther = {
  autoBefore: '169b4b2cfe5d896eef017f985865662cf58b7c012d48e11bfc039f4fe996cb49', autoAfter: '34288b7a8d5b026181be91086aa3a87be2909b9b7dec56a2e8d40d9283a2a157',
  ghostBefore: '384b367104194398fa9952d759f4de5bc39b07416d5d1461d7da9f67fae9f932', ghostAfter: 'b9415c82c9aca824b4084be4430706431a2a36fe41ac95f4f9dc6bb7214732f4'
};
const testHash = crypto.createHash('sha256').update(fs.readFileSync(composerCheckFile)).digest('hex');
const current = fs.readFileSync(cssFile, 'utf8');
const hash = crypto.createHash('sha256').update(current).digest('hex');
const html = fs.readFileSync(htmlFile, 'utf8');
assert(html.includes('id="terminal-toolbar-actions"') && html.includes('id="v7-composer-project"'),
  'Expected current V7 composer markup is missing; STOP before overwriting.');
assert(html.includes('id="v7-composer-ghost"'), 'Ghost autocomplete must remain present.');
if (process.argv.includes('--before')) {
  assert.equal(hash, before, 'STOP: Composer stylesheet differs from the inspected baseline. Upload the current stylesheet before replacing.');
  assert.equal(testHash, beforeComposerCheck, 'STOP: Existing composer regression test differs from inspected baseline.');
  assert.equal(digestFile(autocompleteCheckFile), expectedOther.autoBefore, 'STOP: Existing autocomplete test differs from inspected baseline.');
  assert.equal(digestFile(ghostCheckFile), expectedOther.ghostBefore, 'STOP: Existing ghost visibility test differs from inspected baseline.');
  console.log('PASS: Current composer stylesheet matches the reviewed V7 version.');
  process.exit(0);
}
assert.equal(hash, after, 'STOP: The neutral composer stylesheet is not installed exactly as tested.');
assert.equal(testHash, afterComposerCheck, 'STOP: Updated composer regression test was not installed.');
assert.equal(digestFile(autocompleteCheckFile), expectedOther.autoAfter, 'STOP: Updated autocomplete regression test was not installed.');
assert.equal(digestFile(ghostCheckFile), expectedOther.ghostAfter, 'STOP: Updated ghost visibility regression test was not installed.');
for (const marker of [
  'min-height: 28px !important; /* override the shared 60px toolbar minimum */',
  '--tool-accent: #c8cbd0 !important;',
  '#v7-composer-project { display: none !important; }',
  'font-size: 15px !important;',
  'filter: none !important;',
  'height: 40px;',
]) {
  assert(current.includes(marker), 'Missing expected styling: ' + marker);
}
assert(current.includes('v7-composer-automatic'), 'Auto-send control was removed unexpectedly.');
console.log('PASS: V7 compact neutral toolbar styling, hidden folder, small checkmark, one-line composer, and ghost input markers.');
