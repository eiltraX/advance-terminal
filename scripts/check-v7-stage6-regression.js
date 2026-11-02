'use strict';
// Read-only V7 Stage 6 regression runner. Does not launch Electron or open SSH sessions.
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const checks = [
  'check-v7-design-tokens.js',
  'check-v7-design-forms-dialogs.js',
  'check-v7-design-menus-flyouts.js',
  'check-v7-layout-scrollbars-viewport.js',
  'check-v7-terminal-bottom-fit.js',
  'check-v7-terminal-fit-content-box.js',
  'check-v7-tab-loading.js',
  'check-v7-session-activity-detection.js',
  'check-v7-powershell-spinner-completion.js',
  'check-v7-quiet-in-app-notifications.js',
  'check-v7-native-process-notifications.js',
  'check-v7-reconnect-preserves-tabs.js',
  'check-v7-session-ungroup.js',
  'check-v7-persistent-session-groups.js',
  'check-v7-tools-menu-four-items.js',
];
let failures = 0;
for (const name of checks) {
  const target = path.join(__dirname, name);
  const result = spawnSync(process.execPath, [target], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000,
    windowsHide: true,
  });
  if (result.status === 0 && !result.error) {
    console.log(`PASS: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}`);
    if (result.error) console.error(result.error.message);
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    if (detail) console.error(detail.slice(-2500));
  }
}
const mainPath = path.join(root, 'src/main/main.js');
if (fs.existsSync(mainPath)) {
  const mainSource = fs.readFileSync(mainPath, 'utf8');
  if (mainSource.includes('V5_COMPARISON_MODE = true')) {
    console.warn('AUDIT WARNING: V5 comparison profile is still enabled in main.js; do not change without a saved-data migration plan.');
  }
}
console.log(`STAGE 6 RESULT: ${checks.length - failures}/${checks.length} focused checks passed`);
process.exitCode = failures ? 1 : 0;
