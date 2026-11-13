'use strict';
// Disposable fixtures only. Never read or modify the installed app's profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const storeSource = read('src/main/store.js');
const rendererSource = read('src/renderer/renderer.js');
const mainSource = read('src/main/main.js');

function loadStore(dir, counters) {
  const storeModule = { exports: {} };
  const instrumentedFs = Object.create(fs);
  instrumentedFs.writeFileSync = (...args) => { counters.writes++; return fs.writeFileSync(...args); };
  const secretStore = {
    saveServerSecret: () => ({ok:true}), hasServerSecret: () => false,
    deleteServerSecret: () => {}, pruneSecretsForServerIds: () => {}
  };
  const fakeRequire = (name) => {
    if (name === 'fs') return instrumentedFs;
    if (name === 'electron') return { app: {getPath: () => dir} };
    if (name === './secret-store') return secretStore;
    return require(name);
  };
  const wrapper = vm.runInNewContext(
    `(function (require, module, exports, process) {\n${storeSource}\n})`,
    {}, {filename:'store.js'}
  );
  wrapper(fakeRequire, storeModule, storeModule.exports, process);
  return storeModule.exports;
}

async function tick() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function testStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'at-save-reliability-'));
  try {
    const counters = { writes: 0 };
    const store = loadStore(dir, counters);
    const initial = store.readSettings();
    initial.servers.push({id:'fixture-local', name:'Local Fixture', type:'local', shell:'powershell.exe'});
    initial.servers.push({id:'fixture-remote', name:'SSH Fixture', type:'remote', username:'fixture', host:'example.invalid', authType:'key'});
    let before = counters.writes;
    const saved = store.saveSettings(initial, { auditEntry: {action:'settings_saved', message:'fixture'} });
    assert.equal(counters.writes - before, 1, 'Settings+audit must be one atomic write');
    assert(saved.auditLog.some((item) => item.action === 'settings_saved'));
    assert(saved.servers.some((server) => server.id === 'fixture-remote'));

    const usage = structuredClone(saved.reportUsage);
    const today = Object.keys(usage.days).slice(-1)[0];
    usage.days[today].commandCount = 42;
    before = counters.writes;
    const normalized = store.saveReportUsage(usage);
    assert.equal(counters.writes - before, 1, 'Usage save must be one atomic write');
    assert.equal(normalized.days[today].commandCount, 42);
    assert(store.readSettings().servers.some((server) => server.id === 'fixture-local'));
    assert(store.readSettings().auditLog.some((item) => item.action === 'settings_saved'));

    const settingsPath = path.join(dir, 'settings.json');
    const corrupt = '{not valid json';
    fs.writeFileSync(settingsPath, corrupt, 'utf8');
    before = counters.writes;
    assert.throws(() => store.readSettings(), /NOT been overwritten/);
    assert.equal(fs.readFileSync(settingsPath, 'utf8'), corrupt, 'Corrupt settings must remain untouched');
    assert.equal(counters.writes, before, 'Corrupt settings must not trigger reset/write');
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
  console.log('PASS: Settings and audit share one write; report saves preserve profiles.');
  console.log('PASS: Damaged settings remain untouched rather than silently reset.');
}

async function testSettingsQueue() {
  const begin = rendererSource.indexOf('function runSettingsSaveQueue() {');
  const end = rendererSource.indexOf('\n\nfunction checkpointDailyUsage(', begin);
  assert(begin !== -1 && end > begin, 'Settings save queue not found');
  const queueSource = rendererSource.slice(begin, end);
  const timers = new Map(); let nextTimerId = 1;
  const clock = {
    setTimeout: (fn) => {const id = nextTimerId++; timers.set(id, fn); return id;},
    clearTimeout: (id) => {timers.delete(id);},
    runTimers: () => {const copies = [...timers];timers.clear();for (const [, fn] of copies) fn();}
  };
  const calls = []; const resolutions = [];
  const state = {
    settings: {selectedServerId:'fixture', reportOptions:{}, name:'initial'},
    selectedServerId:'fixture', activeSettingsTab:'safety',
    settingsSaveTimer:null, settingsSaveInFlight:false, settingsSaveBatch:null
  };
  const uiCalls = [];
  const sandbox = {
    state,
    window: {advanceTerminal:{saveSettings:(snapshot)=>{
      calls.push(structuredClone(snapshot));
      return new Promise((resolve, reject)=>resolutions.push({resolve, reject}));
    }}},
    clearTimeout: clock.clearTimeout, setTimeout: clock.setTimeout,
    normalizeReportOptionsClient: (x)=>x,
    updateConnectionGroupDatalist:()=>{}, renderServerList:()=>{}, renderCommandList:()=>{},
    renderTerminalToolbarActions:()=>{}, renderAuditLog:()=>{}, renderTerminalActionList:()=>{},
    showToast: (...args)=>uiCalls.push(args), appendActivityFeedEvent:()=>{},
    Promise, SETTINGS_SAVE_DEBOUNCE_MS:800
  };
  vm.runInNewContext(queueSource, sandbox);
  const first = sandbox.scheduleSettingsSave({refresh:false});
  state.settings.name = 'newest';
  const second = sandbox.scheduleSettingsSave({refresh:false});
  clock.runTimers();
  assert.equal(calls.length, 1, 'Debounced saves should coalesce');
  assert.equal(calls[0].name, 'newest');
  resolutions.shift().resolve({...calls[0]});
  const values = await Promise.all([first, second]);
  assert.equal(values.length, 2, 'Every scheduled save caller must resolve');
  assert.equal(state.settings.name, 'newest');

  const third = sandbox.saveSettingsNow({refresh:false});
  assert.equal(calls.length, 2);
  state.settings.name = 'queued while writing';
  const fourth = sandbox.saveSettingsNow({refresh:false});
  resolutions.shift().resolve({...calls[1]});
  await tick();
  assert.equal(state.settings.name, 'queued while writing', 'Older IPC save response must not clobber a newer edit');
  assert.equal(calls.length, 3, 'Queued edit must cause second serialized IPC write');
  resolutions.shift().resolve({...calls[2]});
  await Promise.all([third, fourth]);
  assert.equal(state.settings.name, 'queued while writing');

  const fifth = sandbox.scheduleSettingsSave({});
  const sixth = sandbox.scheduleSettingsSave({});
  clock.runTimers();
  const failure = new Error('simulated read-only disk');
  resolutions.shift().reject(failure);
  const settled = await Promise.allSettled([fifth,sixth]);
  assert(settled.every((item)=>item.status==='rejected'), 'All callers must receive save failure');
  assert(uiCalls.some((call)=>String(call[0]).includes('Settings save failed')), 'Show save failure to user');
  console.log('PASS: Coalesced save callers all resolve, in-flight edits persist, failures propagate.');
}

async function testUsageThrottle() {
  const begin = rendererSource.indexOf('function scheduleUsagePersist() {');
  const end = rendererSource.indexOf('\nfunction getBusyButtons(', begin);
  assert(begin >= 0 && end > begin, 'Usage scheduling functions missing');
  let fakeNow = 10000000;
  let saveCalls = 0;
  let nextId = 1;
  const timers = new Map();
  const state = {
    settings: {reportUsage:{days:{}}}, usagePersistTimer:null,
    usagePersistInFlight:false, usagePersistAgain:false, usageRevision:0, usageLastSavedAt:0
  };
  const day = {updatedAt:''};
  const sandbox = {
    state, getTodayUsageDay:()=>day,
    USAGE_SAVE_DEBOUNCE_MS:8000, USAGE_SAVE_MIN_INTERVAL_MS:30000,
    normalizeReportUsageClient:(x)=>x,
    window:{advanceTerminal:{saveSettings:()=>{},saveReportUsage:async (usage)=>{saveCalls++; return usage;}}},
    Date:class extends Date { static now(){return fakeNow;} },
    setTimeout:(fn,ms)=>{const id=nextId++;timers.set(id,{fn,ms});return id;},
    clearTimeout:(id)=>{timers.delete(id);},
    showToast:()=>{}, Promise
  };
  vm.runInNewContext(rendererSource.slice(begin,end),sandbox);
  for(let i=0;i<500;i++) sandbox.markUsageDirty(true);
  assert.equal(timers.size,1,'Usage output bursts should schedule one save');
  assert.equal([...timers.values()][0].ms,8000,'First save should debounce bursts');
  const first = [...timers.values()][0]; timers.clear(); first.fn();
  await tick();
  assert.equal(saveCalls,1);
  fakeNow += 1000;
  for(let i=0;i<500;i++) sandbox.markUsageDirty(true);
  assert.equal(timers.size,1);
  assert([...timers.values()][0].ms>=29000,'Writes should be capped to about one per 30s');
  console.log('PASS: High-volume terminal output schedules bounded report writes.');
}

async function main() {
  assert(mainSource.includes("return saveSettings(settings, {"));
  assert(mainSource.includes('return saveReportUsage(reportUsage);'));
  assert(rendererSource.includes('USAGE_SAVE_MIN_INTERVAL_MS = 30000'));
  assert(!rendererSource.includes('state.settings = await window.advanceTerminal.saveSettings(state.settings);'),
    'Direct settings writes bypass the serialized queue');
  const hotPathBegin = rendererSource.indexOf('function getTodayUsageDay() {');
  const hotPathEnd = rendererSource.indexOf('\n\nfunction summarizeSessionForUsage(', hotPathBegin);
  assert(hotPathBegin >= 0 && hotPathEnd > hotPathBegin, 'Report usage hot path missing');
  let normalizeCalls = 0;
  const hotDate = '2026-11-13';
  const hotState = {settings: {reportUsage: {days: {[hotDate]: {commandCount: 4}}}}};
  const hotContext = {state:hotState, todayReportDateKey:()=>hotDate,
    createEmptyReportDay:()=>({commandCount:0}),
    normalizeReportUsageClient: (x)=>{normalizeCalls++;return x;}};
  vm.runInNewContext(rendererSource.slice(hotPathBegin,hotPathEnd),hotContext);
  for (let i=0;i<1000;i++) hotContext.getTodayUsageDay();
  assert.equal(normalizeCalls,0,'Report history is being normalized on each output chunk');
  delete hotState.settings.reportUsage.days[hotDate];
  hotContext.getTodayUsageDay();
  assert.equal(normalizeCalls,1,'Missing day must still be normalized');
  console.log('PASS: Frequent terminal activity does not repeatedly normalize report history.');
  assert(!/backup-auto-/.test(storeSource), 'Auto backup reintroduced');
  await testStore();
  await testSettingsQueue();
  await testUsageThrottle();
  console.log('PASS: M02 save reliability regression suite completed (isolated Node fixtures).');
}
main().catch((error) => {console.error(error);process.exitCode = 1;});
