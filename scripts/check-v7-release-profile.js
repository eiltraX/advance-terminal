'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveAdvanceTerminalProfile } = require('../src/main/profile-paths');

const sampleAppData = path.resolve('C:/Users/Example/AppData/Roaming');
const packagedPath = resolveAdvanceTerminalProfile({ appDataPath: sampleAppData, packaged: true });
const developmentPath = resolveAdvanceTerminalProfile({ appDataPath: sampleAppData, packaged: false });
assert.equal(path.basename(packagedPath), 'advance-terminal-standalone');
assert.equal(path.basename(developmentPath), 'advance-terminal-v5-performance-test');
assert.notEqual(packagedPath, developmentPath, 'release must not use V5 performance profile');
assert.throws(() => resolveAdvanceTerminalProfile({ appDataPath: './relative', packaged: true }), /absolute/);
assert.throws(() => resolveAdvanceTerminalProfile({ appDataPath: sampleAppData, packaged: undefined }), /boolean/);

const main = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');
assert.match(main, /V5_COMPARISON_MODE\s*=\s*!app\.isPackaged/);
assert.match(main, /const activeProfilePath = resolveAdvanceTerminalProfile/);
assert.match(main, /app\.setPath\('userData', activeProfilePath\)/);
assert.match(main, /app\.setPath\('sessionData', activeProfilePath\)/);
assert.ok(main.indexOf("app.setPath('userData', activeProfilePath)") < main.indexOf("require('./store')"), 'profile must be configured before store import');
assert.ok(main.includes("createProcessCompletionNotifier"), 'native notifications must remain configured');
assert.ok(main.includes("function getAutoUpdaterAvailability()"), 'updater must remain present');
assert.ok(main.includes('if (V5_COMPARISON_MODE) return'), 'dev-only updater guard must remain present');
console.log('PASS: packaged V7 profile isolation, preserved standalone path, dev-only V5, native notifications, updater path');
