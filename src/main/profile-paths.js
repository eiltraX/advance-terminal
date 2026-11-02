'use strict';

const path = require('path');

// Pure decision function: no filesystem writes or profile migrations.
function resolveAdvanceTerminalProfile({ appDataPath, packaged }) {
  if (typeof appDataPath !== 'string' || !path.isAbsolute(appDataPath)) {
    throw new TypeError('appDataPath must be an absolute directory path.');
  }
  if (typeof packaged !== 'boolean') {
    throw new TypeError('packaged must be a boolean.');
  }
  return path.join(
    appDataPath,
    packaged ? 'advance-terminal-standalone' : 'advance-terminal-v5-performance-test'
  );
}

module.exports = { resolveAdvanceTerminalProfile };
