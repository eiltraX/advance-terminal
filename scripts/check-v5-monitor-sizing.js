// Pure sizing assertions: no Electron import or settings access.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');
const start = source.indexOf('function getMonitorWindowOptions(workArea) {');
const end = source.indexOf('\nfunction keepMainWindowOnAvailableMonitor()', start);
assert(start > -1 && end > start, 'Monitor sizing implementation missing');
const getOptions = vm.runInNewContext(`(${source.slice(start, end).trim()})`);

const scenarios = [
  { name: 'HD laptop', area: { x: 0, y: 0, width: 1366, height: 728 } },
  { name: 'Full HD external', area: { x: 0, y: 0, width: 1920, height: 1040 } },
  { name: '4K with scaling', area: { x: 0, y: 0, width: 2560, height: 1390 } },
  { name: 'compact display', area: { x: 0, y: 0, width: 800, height: 570 } },
  { name: 'secondary display', area: { x: -1280, y: 50, width: 1280, height: 680 } }
];
for (const { name, area } of scenarios) {
  const b = getOptions(area);
  assert(b.width > 0 && b.width <= area.width, name + ': width exceeds monitor');
  assert(b.height > 0 && b.height <= area.height, name + ': height exceeds monitor');
  assert(b.x >= area.x && b.x + b.width <= area.x + area.width, name + ': horizontal overflow');
  assert(b.y >= area.y && b.y + b.height <= area.y + area.height, name + ': vertical overflow');
  assert(b.minWidth <= area.width && b.minHeight <= area.height, name + ': min window size too large');
}
assert(source.includes('mainWindow.maximize();'), 'Start-maximized behavior missing');
assert(source.includes("screen.on('display-metrics-changed', keepMainWindowOnAvailableMonitor)"), 'Resolution change handler missing');
assert(source.includes("screen.on('display-removed', keepMainWindowOnAvailableMonitor)"), 'Monitor removal handler missing');
assert(source.includes("const v5ComparisonProfile = path.join(app.getPath('appData'), 'advance-terminal-v5-performance-test')"), 'v5 isolation protection missing');
console.log('PASS: Monitor-aware window sizing, bounds and v5 isolation checks');
