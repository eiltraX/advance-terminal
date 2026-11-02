// Read-only preflight. Run against the installed source BEFORE copying the v7 files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const expectedSources = {
  "src/main/main.js": "461656a0cc8c3b007178367f7b628bf3819905f98fd2528b6fde721baef3fe7f",
  "src/renderer/index.html": "534df77bd89113284fd6026963d5b39cd0aec87b84ab27d79677faa73e0ab5ff",
  "src/renderer/renderer.js": "cb2671434afe66c9a56351e7ce0befbab8689b7dcdebb42ce7f20666e3989b64",
  "scripts/check-v5-isolation.js": "948848a44add6f7614dd7022fb6b559c5322b28bb465a3261db2ac29ddabe68a"
};
const packagePairs = [
  [
    "5.0.0",
    "bce730d174dd5f64f5a4f191f18c8fdf976e61a86cd473e1f88eb40bd0b8d4e5",
    "2c1525dd95d99a9757264030a81b702c7a64c59cc3e16c11864c7a7ee28c7ab4"
  ],
  [
    "5.1.0",
    "169756a81551ef2cd40376382737831d6db1c80fa282aa18fb0ffd722a722890",
    "7f117a12b807590b33e15dda9e54adaed6b220dea5be49c2f6cc136cd695af56"
  ]
];
try {
  for (const [file, expected] of Object.entries(expectedSources)) {
    const actual = hash(file);
    if (actual !== expected) throw new Error(`STOP: ${file} does not match the inspected source. Expected ${expected}; found ${actual}`);
  }
  const p = hash('package.json');
  const l = hash('package-lock.json');
  const match = packagePairs.find(([version, ph, lh]) => ph === p && lh === l);
  if (!match) throw new Error('STOP: package.json or package-lock.json has changed since v5.0/v5.1 inspection. Do not overwrite.');
  console.log(`PASS: Current v${match[0]} source verified. Safe to back up and manually apply the complete v7 patch.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
