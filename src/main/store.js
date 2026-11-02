const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const {
  saveServerSecret,
  hasServerSecret,
  deleteServerSecret,
  pruneSecretsForServerIds
} = require('./secret-store');

const SETTINGS_AUTO_BACKUP_MAX_FILES = 30;
const SETTINGS_AUTO_BACKUP_MIN_INTERVAL_MS = 5 * 60 * 1000;

let lastSettingsAutoBackupAt = 0;
let lastSettingsAutoBackupSignature = '';

function getSettingsFilePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'settings.json');
}

function getSettingsDirectoryPath() {
  return path.dirname(getSettingsFilePath());
}

function getSettingsBackupTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('') + '-' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function normalizeBackupReason(reason) {
  const safeReason = String(reason || 'auto')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return safeReason || 'auto';
}

function getSettingsFileSignature(filePath) {
  const raw = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function isValidSettingsBackupPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }

  if (!Array.isArray(payload.servers) || !payload.servers.length) {
    return false;
  }

  return payload.servers.some((server) => server && typeof server === 'object');
}

function readValidSettingsBackupPayload(filePath) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!isValidSettingsBackupPayload(payload)) {
    return null;
  }

  return payload;
}

function writeSettingsFileAtomic(filePath, settings) {
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;

  try {
    const fd = fs.openSync(tempPath, 'w');
    try {
      fs.writeFileSync(fd, JSON.stringify(settings, null, 2), 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (_) {
      // Ignore cleanup failure.
    }

    throw error;
  }
}

function listSettingsAutoBackupFiles() {
  const dirPath = getSettingsDirectoryPath();

  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath)
    .filter((fileName) => /^settings\.json\.backup-auto-\d{8}-\d{6}(?:-[a-z0-9_-]+)?$/.test(fileName))
    .map((fileName) => path.join(dirPath, fileName))
    .filter((filePath) => {
      try {
        return fs.statSync(filePath).isFile();
      } catch (_) {
        return false;
      }
    });
}

function pruneSettingsAutoBackups(maxFiles = SETTINGS_AUTO_BACKUP_MAX_FILES) {
  const backups = listSettingsAutoBackupFiles()
    .map((filePath) => {
      try {
        return {
          filePath,
          modifiedAt: fs.statSync(filePath).mtimeMs
        };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.modifiedAt - left.modifiedAt);

  backups.slice(maxFiles).forEach((backup) => {
    try {
      fs.unlinkSync(backup.filePath);
    } catch (_) {
      // Ignore old backup cleanup failure.
    }
  });
}

function hasDuplicateLatestAutoBackup(signature) {
  const latest = listSettingsAutoBackupFiles()
    .map((filePath) => {
      try {
        return {
          filePath,
          modifiedAt: fs.statSync(filePath).mtimeMs
        };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.modifiedAt - left.modifiedAt)[0];

  if (!latest) {
    return false;
  }

  try {
    return getSettingsFileSignature(latest.filePath) === signature;
  } catch (_) {
    return false;
  }
}

function createSettingsAutoBackup(reason = 'auto', options = {}) {
  const settingsPath = getSettingsFilePath();

  try {
    if (!fs.existsSync(settingsPath)) {
      return {
        ok: false,
        skipped: true,
        reason: 'settings-file-missing'
      };
    }

    readValidSettingsBackupPayload(settingsPath);

    const now = Date.now();
    const signature = getSettingsFileSignature(settingsPath);
    const force = Boolean(options.force);

    if (!force && signature === lastSettingsAutoBackupSignature && now - lastSettingsAutoBackupAt < SETTINGS_AUTO_BACKUP_MIN_INTERVAL_MS) {
      return {
        ok: false,
        skipped: true,
        reason: 'recent-duplicate'
      };
    }

    if (hasDuplicateLatestAutoBackup(signature)) {
      lastSettingsAutoBackupAt = now;
      lastSettingsAutoBackupSignature = signature;

      return {
        ok: false,
        skipped: true,
        reason: 'latest-backup-already-matches'
      };
    }

    const backupPath = `${settingsPath}.backup-auto-${getSettingsBackupTimestamp()}-${normalizeBackupReason(reason)}`;
    fs.copyFileSync(settingsPath, backupPath);

    lastSettingsAutoBackupAt = now;
    lastSettingsAutoBackupSignature = signature;

    pruneSettingsAutoBackups();

    return {
      ok: true,
      backupPath
    };
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      reason: 'invalid-current-settings',
      error: error.message
    };
  }
}


function createDefaultTerminalActions() {
  return [
    {
      id: 'term-action-clear',
      name: 'Clear Screen',
      action: 'clear',
      icon: 'eraser',
      text: '',
      enabled: true
    },
    {
      id: 'term-action-copy-all',
      name: 'Copy All Screen',
      action: 'copyAll',
      icon: 'copy',
      text: '',
      enabled: true
    },
    {
      id: 'term-action-copy-selection',
      name: 'Copy Selection',
      action: 'copySelection',
      icon: 'select',
      text: '',
      enabled: true
    },
    {
      id: 'term-action-paste',
      name: 'Paste',
      action: 'paste',
      icon: 'paste',
      text: '',
      enabled: true
    },
    {
      id: 'term-action-ctrl-c',
      name: 'Ctrl+C',
      action: 'ctrlC',
      icon: 'stop',
      text: '',
      enabled: true
    },
    {
      id: 'term-action-ctrl-l',
      name: 'Ctrl+L',
      action: 'ctrlL',
      icon: 'lines',
      text: '',
      enabled: true
    },
    {
      id: 'term-action-ctrl-d',
      name: 'Ctrl+D',
      action: 'ctrlD',
      icon: 'logout',
      text: '',
      enabled: true
    },
    {
      id: 'term-action-close',
      name: 'Close Session',
      action: 'closeSession',
      icon: 'close',
      text: '',
      enabled: true
    }
  ];
}

function normalizeTerminalAction(action) {
  const allowedActions = new Set([
    'clear',
    'copyAll',
    'copySelection',
    'paste',
    'ctrlC',
    'ctrlL',
    'ctrlD',
    'closeSession',
    'sendText'
  ]);

  const selectedAction = allowedActions.has(String(action.action || ''))
    ? String(action.action)
    : 'sendText';

  return {
    id: String(action.id || crypto.randomUUID()),
    name: String(action.name || 'Terminal Action'),
    action: selectedAction,
    icon: String(action.icon || 'terminal'),
    text: String(action.text || ''),
    enabled: action.enabled !== false
  };
}



function normalizeNotificationPosition(value) {
  const allowed = new Set([
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right'
  ]);

  const normalized = String(value || '').toLowerCase();

  return allowed.has(normalized) ? normalized : 'bottom-right';
}

function normalizePasteProtection(value = {}) {
  return {
    confirmMultiline: value.confirmMultiline !== false,
    rightClickAutoEnter: value.rightClickAutoEnter === true,
    lockSshToStartFolder: value.lockSshToStartFolder !== false
  };
}

function normalizeActivityFeedSettings(value = {}) {
  const mode = String(value.terminalOutput || '').toLowerCase();

  return {
    terminalOutput: ['off', 'errors', 'full'].includes(mode) ? mode : 'off'
  };
}

function normalizeAiSettings(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};

  const model = String(source.model || 'gpt-5.5')
    .trim()
    .replace(/\s+/g, '')
    .slice(0, 80) || 'gpt-5.5';

  return {
    enabled: source.enabled === true,
    provider: 'openai',
    model,
    includeGitDiff: source.includeGitDiff === true,
    includeRecentCommands: source.includeRecentCommands !== false
  };
}

function normalizeUi(ui = {}) {
  return {
    theme: ui.theme === 'dark' ? 'dark' : 'light',
    notificationPosition: normalizeNotificationPosition(ui.notificationPosition),
    pasteProtection: normalizePasteProtection(ui.pasteProtection || {}),
    activityFeed: normalizeActivityFeedSettings(ui.activityFeed || {})
  };
}



function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultReportDay(dateKey = getTodayDateKey()) {
  return {
    date: dateKey,
    appUptimeMs: 0,
    terminalUptimeMs: 0,
    sshUptimeMs: 0,
    localTerminalUptimeMs: 0,
    activeWorkMs: 0,
    sessionsOpened: 0,
    sshConnections: 0,
    localSessions: 0,
    reconnectCount: 0,
    disconnectCount: 0,
    commandCount: 0,
    inputActivityCount: 0,
    outputBytes: 0,
    activityCounters: {},
    issueCounters: {},
    connectionSummaries: {},
    sessionHistory: [],
    jobs: [],
    activeSessions: {},
    lastCheckpointAt: null,
    updatedAt: null
  };
}

function normalizeCounterMap(value = {}) {
  const result = {};

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.keys(value).slice(0, 120).forEach((key) => {
      const count = Number(value[key] || 0);

      if (Number.isFinite(count) && count > 0) {
        result[String(key).slice(0, 80)] = Math.round(count);
      }
    });
  }

  return result;
}

function normalizeSessionSummary(value = {}) {
  return {
    id: String(value.id || crypto.randomUUID()),
    terminalId: String(value.terminalId || ''),
    name: String(value.name || 'Terminal'),
    type: value.type === 'remote' ? 'remote' : 'local',
    host: String(value.host || ''),
    username: String(value.username || ''),
    startedAt: String(value.startedAt || ''),
    endedAt: String(value.endedAt || ''),
    lastSeenAt: String(value.lastSeenAt || value.endedAt || ''),
    durationMs: Math.max(0, Math.round(Number(value.durationMs || 0))),
    activeWorkMs: Math.max(0, Math.round(Number(value.activeWorkMs || 0))),
    idleMs: Math.max(0, Math.round(Number(value.idleMs || 0))),
    lastActivityAt: value.lastActivityAt ? String(value.lastActivityAt) : '',
    status: String(value.status || 'unknown').slice(0, 80),
    commandCount: Math.max(0, Math.round(Number(value.commandCount || 0))),
    inputActivityCount: Math.max(0, Math.round(Number(value.inputActivityCount || 0))),
    outputBytes: Math.max(0, Math.round(Number(value.outputBytes || 0))),
    activityCounters: normalizeCounterMap(value.activityCounters),
    issueCounters: normalizeCounterMap(value.issueCounters)
  };
}


function sanitizeStoredJobCommand(value = '') {
  return String(value || '')
    .replace(/\b(password|passwd|passphrase|token|secret|api[_-]?key)\s*=\s*[^\s;&|]+/gi, '$1=[REDACTED]')
    .replace(/(--?(?:password|passwd|passphrase|token|secret|api[_-]?key))(?:=|\s+)([^\s;&|]+)/gi, '$1 [REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function normalizeReportJob(value = {}) {
  return {
    id: String(value.id || crypto.randomUUID()).slice(0, 120),
    terminalId: String(value.terminalId || '').slice(0, 160),
    connectionId: String(value.connectionId || '').slice(0, 160),
    connectionName: String(value.connectionName || 'Terminal').slice(0, 160),
    type: value.type === 'remote' ? 'remote' : 'local',
    host: String(value.host || '').slice(0, 220),
    username: String(value.username || '').slice(0, 160),
    workingDirectory: String(value.workingDirectory || '').slice(0, 500),
    startedAt: String(value.startedAt || ''),
    endedAt: String(value.endedAt || ''),
    durationMs: Math.max(0, Math.round(Number(value.durationMs || 0))),
    status: String(value.status || 'running').slice(0, 60),
    workType: String(value.workType || 'Development').slice(0, 100),
    commandLabel: sanitizeStoredJobCommand(value.commandLabel || value.command || ''),
    source: String(value.source || 'typed').slice(0, 40),
    issueCount: Math.max(0, Math.round(Number(value.issueCount || 0))),
    issueCategories: Array.isArray(value.issueCategories)
      ? value.issueCategories.map((item) => String(item || '').slice(0, 100)).filter(Boolean).slice(0, 12)
      : [],
    note: String(value.note || '').slice(0, 240)
  };
}

function normalizeReportDay(value = {}, dateKey = getTodayDateKey()) {
  const fallback = createDefaultReportDay(dateKey);
  const day = {
    ...fallback,
    ...(value && typeof value === 'object' ? value : {})
  };

  day.date = String(day.date || dateKey);
  day.appUptimeMs = Math.max(0, Math.round(Number(day.appUptimeMs || 0)));
  day.terminalUptimeMs = Math.max(0, Math.round(Number(day.terminalUptimeMs || 0)));
  day.sshUptimeMs = Math.max(0, Math.round(Number(day.sshUptimeMs || 0)));
  day.localTerminalUptimeMs = Math.max(0, Math.round(Number(day.localTerminalUptimeMs || 0)));
  day.activeWorkMs = Math.max(0, Math.round(Number(day.activeWorkMs || 0)));
  day.sessionsOpened = Math.max(0, Math.round(Number(day.sessionsOpened || 0)));
  day.sshConnections = Math.max(0, Math.round(Number(day.sshConnections || 0)));
  day.localSessions = Math.max(0, Math.round(Number(day.localSessions || 0)));
  day.reconnectCount = Math.max(0, Math.round(Number(day.reconnectCount || 0)));
  day.disconnectCount = Math.max(0, Math.round(Number(day.disconnectCount || 0)));
  day.commandCount = Math.max(0, Math.round(Number(day.commandCount || 0)));
  day.inputActivityCount = Math.max(0, Math.round(Number(day.inputActivityCount || 0)));
  day.outputBytes = Math.max(0, Math.round(Number(day.outputBytes || 0)));
  day.activityCounters = normalizeCounterMap(day.activityCounters);
  day.issueCounters = normalizeCounterMap(day.issueCounters);

  const connectionSummaries = {};
  if (day.connectionSummaries && typeof day.connectionSummaries === 'object' && !Array.isArray(day.connectionSummaries)) {
    Object.keys(day.connectionSummaries).slice(0, 250).forEach((key) => {
      const item = day.connectionSummaries[key] || {};
      connectionSummaries[String(key).slice(0, 120)] = {
        name: String(item.name || key).slice(0, 160),
        type: item.type === 'remote' ? 'remote' : 'local',
        sessionsOpened: Math.max(0, Math.round(Number(item.sessionsOpened || 0))),
        uptimeMs: Math.max(0, Math.round(Number(item.uptimeMs || 0))),
        activeWorkMs: Math.max(0, Math.round(Number(item.activeWorkMs || 0))),
        lastActivityAt: item.lastActivityAt ? String(item.lastActivityAt) : '',
        commandCount: Math.max(0, Math.round(Number(item.commandCount || 0))),
        inputActivityCount: Math.max(0, Math.round(Number(item.inputActivityCount || 0))),
        outputBytes: Math.max(0, Math.round(Number(item.outputBytes || 0))),
        reconnectCount: Math.max(0, Math.round(Number(item.reconnectCount || 0))),
        disconnectCount: Math.max(0, Math.round(Number(item.disconnectCount || 0))),
        activityCounters: normalizeCounterMap(item.activityCounters),
        issueCounters: normalizeCounterMap(item.issueCounters),
        lastSeenAt: item.lastSeenAt ? String(item.lastSeenAt) : null
      };
    });
  }
  day.connectionSummaries = connectionSummaries;

  day.sessionHistory = Array.isArray(day.sessionHistory)
    ? day.sessionHistory.slice(-300).map(normalizeSessionSummary)
    : [];
  day.jobs = Array.isArray(day.jobs)
    ? day.jobs.slice(-250).map(normalizeReportJob)
    : [];
  day.activeSessions = day.activeSessions && typeof day.activeSessions === 'object' && !Array.isArray(day.activeSessions)
    ? Object.fromEntries(Object.entries(day.activeSessions).slice(-100).map(([key, item]) => [String(key), normalizeSessionSummary(item)]))
    : {};
  day.lastCheckpointAt = day.lastCheckpointAt ? String(day.lastCheckpointAt) : null;
  day.updatedAt = day.updatedAt ? String(day.updatedAt) : null;

  return day;
}

function normalizeReportUsage(value = {}) {
  const today = getTodayDateKey();
  const source = value && typeof value === 'object' ? value : {};
  const days = source.days && typeof source.days === 'object' && !Array.isArray(source.days)
    ? source.days
    : {};
  const normalizedDays = {};
  const keys = Array.from(new Set([...Object.keys(days), today]))
    .sort()
    .slice(-90);

  keys.forEach((key) => {
    normalizedDays[key] = normalizeReportDay(days[key], key);
  });

  return {
    version: 2,
    days: normalizedDays,
    lastOpenedDate: String(source.lastOpenedDate || today)
  };
}


function normalizeReportHistory(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const items = Array.isArray(source.items) ? source.items : [];

  return {
    version: 1,
    items: items.slice(-100).map((item) => ({
      id: String(item.id || crypto.randomUUID()),
      generatedAt: String(item.generatedAt || new Date().toISOString()),
      scope: String(item.scope || 'all').slice(0, 40),
      scopeLabel: String(item.scopeLabel || 'All Terminals').slice(0, 80),
      dateFilter: String(item.dateFilter || 'today').slice(0, 40),
      dateLabel: String(item.dateLabel || 'Today').slice(0, 120),
      title: String(item.title || 'Work Activity Report').slice(0, 160),
      summary: String(item.summary || '').slice(0, 500),
      metrics: item.metrics && typeof item.metrics === 'object' && !Array.isArray(item.metrics)
        ? {
            duration: String(item.metrics.duration || ''),
            commandCount: Math.max(0, Math.round(Number(item.metrics.commandCount || 0))),
            jobCount: Math.max(0, Math.round(Number(item.metrics.jobCount || 0))),
            completedJobCount: Math.max(0, Math.round(Number(item.metrics.completedJobCount || 0))),
            findingCount: Math.max(0, Math.round(Number(item.metrics.findingCount || 0))),
            generatedLabel: String(item.metrics.generatedLabel || '')
          }
        : {},
      text: String(item.text || '').slice(0, 200000)
    }))
  };
}


function createDefaultReportOptions() {
  return {
    showSummary: true,
    showTimeBreakdown: true,
    showRealJobs: true,
    showConnectionBreakdown: true,
    showCommandsAnalyzed: true,
    showActivityAnalysis: true,
    showIssueSummary: true,
    showSuggestedNextActions: true,
    showMetadata: true
  };
}

function normalizeReportOptions(value = {}) {
  const defaults = createDefaultReportOptions();
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};

  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, typeof source[key] === 'boolean' ? source[key] : fallback])
  );
}


function createDefaultSettings() {
  return {
    version: 1,
    selectedServerId: 'local-terminal',
    servers: [
      {
        id: 'local-terminal',
        type: 'local',
        name: 'Advance Terminal',
        description: 'Local Terminal',
        group: 'Local',
        shell: '',
        workingDirectory: ''
      }
    ],
    commands: [
      {
        id: 'cmd-laravel-optimize-clear',
        name: 'Laravel optimize clear',
        category: 'Laravel',
        command: 'php artisan optimize:clear'
      },
      {
        id: 'cmd-laravel-cache-clear',
        name: 'Laravel cache clear',
        category: 'Laravel',
        command: 'php artisan cache:clear'
      },
      {
        id: 'cmd-laravel-config-clear',
        name: 'Laravel config clear',
        category: 'Laravel',
        command: 'php artisan config:clear'
      },
      {
        id: 'cmd-php-version',
        name: 'PHP version',
        category: 'Server',
        command: 'php -v'
      }
    ],
    terminalActions: createDefaultTerminalActions(),
    auditLog: [],
    ui: {
      theme: 'light',
      notificationPosition: 'bottom-right',
      pasteProtection: {
        confirmMultiline: true,
        rightClickAutoEnter: false,
        lockSshToStartFolder: true
      },
      activityFeed: {
        terminalOutput: 'off'
      }
    },
    reportUsage: normalizeReportUsage(),
    reportHistory: normalizeReportHistory(),
    reportOptions: createDefaultReportOptions(),
    ai: normalizeAiSettings()
  };
}

function ensureSettingsFile() {
  const filePath = getSettingsFilePath();
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    writeSettingsFileAtomic(filePath, createDefaultSettings());
  }
}


function normalizeAuthType(server) {
  const requested = String(server.authType || '').trim().toLowerCase();

  if (requested === 'key' || requested === 'private-key' || requested === 'private_key') {
    return 'key';
  }

  return 'password';
}

function hasConfiguredAuthType(server) {
  if (server?.authTypeConfigured === false) {
    return false;
  }

  const requested = String(server?.authType || '').trim().toLowerCase();
  return requested === 'password'
    || requested === 'key'
    || requested === 'private-key'
    || requested === 'private_key';
}

function clampInteger(value, fallback, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeConnectionGroup(value, type = 'remote') {
  const fallback = type === 'local' ? 'Local' : 'Ungrouped';
  const group = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);

  return group || fallback;
}

function normalizeServer(server) {
  const id = String(server.id || crypto.randomUUID());
  const type = server.type === 'remote' ? 'remote' : 'local';

  if (type === 'local') {
    return {
      id,
      type: 'local',
      name: String(server.name || 'Local Terminal'),
      description: String(server.description || 'Local Terminal'),
      group: normalizeConnectionGroup(server.group, 'local'),
      shell: String(server.shell || ''),
      workingDirectory: String(server.workingDirectory || '')
    };
  }

  return {
    id,
    type: 'remote',
    name: String(server.name || server.host || 'Remote SSH'),
    description: String(server.description || 'Remote SSH'),
    group: normalizeConnectionGroup(server.group, 'remote'),
    host: String(server.host || ''),
    port: Number(server.port || 22),
    username: String(server.username || ''),
    authType: normalizeAuthType(server),
    authTypeConfigured: hasConfiguredAuthType(server),
    privateKeyPath: String(server.privateKeyPath || ''),
    workingDirectory: String(server.workingDirectory || ''),
    password: String(server.password || ''),
    savePassword: Boolean(server.savePassword),
    passphrase: String(server.passphrase || ''),
    savePassphrase: Boolean(server.savePassphrase),
    keepAlive: server.keepAlive !== false,
    autoReconnect: Boolean(server.autoReconnect),
    reconnectAttempts: clampInteger(server.reconnectAttempts, 3, 1, 20),
    reconnectDelay: clampInteger(server.reconnectDelay, 5, 1, 300)
  };
}

function persistAndScrubServerSecrets(server) {
  if (!server || server.type !== 'remote') {
    return server;
  }

  const safeServer = { ...server };
  const inlinePassword = String(safeServer.password || '');
  const inlinePassphrase = String(safeServer.passphrase || '');

  if (safeServer.authType === 'password') {
    if (safeServer.savePassword && inlinePassword) {
      const result = saveServerSecret(safeServer.id, 'password', inlinePassword);
      safeServer.savePassword = result.ok || hasServerSecret(safeServer.id, 'password');
    } else if (safeServer.savePassword) {
      safeServer.savePassword = hasServerSecret(safeServer.id, 'password');
    } else {
      deleteServerSecret(safeServer.id, 'password');
    }

    deleteServerSecret(safeServer.id, 'passphrase');
    safeServer.savePassphrase = false;
  } else {
    if (safeServer.savePassphrase && inlinePassphrase) {
      const result = saveServerSecret(safeServer.id, 'passphrase', inlinePassphrase);
      safeServer.savePassphrase = result.ok || hasServerSecret(safeServer.id, 'passphrase');
    } else if (safeServer.savePassphrase) {
      safeServer.savePassphrase = hasServerSecret(safeServer.id, 'passphrase');
    } else {
      deleteServerSecret(safeServer.id, 'passphrase');
    }

    deleteServerSecret(safeServer.id, 'password');
    safeServer.savePassword = false;
  }

  safeServer.password = '';
  safeServer.passphrase = '';

  return safeServer;
}

function normalizeAndSecureServers(servers = []) {
  const normalizedServers = (Array.isArray(servers) ? servers : [])
    .map(normalizeServer)
    .map(persistAndScrubServerSecrets);

  pruneSecretsForServerIds(normalizedServers.map((server) => server.id));

  return normalizedServers;
}

function settingsContainInlineSecrets(settings = {}) {
  return Array.isArray(settings.servers) && settings.servers.some((server) => (
    server
    && typeof server === 'object'
    && (String(server.password || '') || String(server.passphrase || ''))
  ));
}

function inferCommandCategory(commandText = '') {
  const text = String(commandText || '').toLowerCase();

  if (/\bphp\s+artisan\b|\bartisan\b|\blaravel\b/.test(text)) {
    return 'Laravel';
  }

  if (/\bgit\b/.test(text)) {
    return 'Git';
  }

  if (/\bcomposer\b/.test(text)) {
    return 'Composer';
  }

  if (/\b(?:npm|npx|yarn|pnpm)\b/.test(text)) {
    return 'NPM';
  }

  if (/\b(?:mysql|mariadb|psql|sqlite|mongo|redis-cli)\b|\b(?:select|insert|update|delete|drop|alter)\s+/i.test(text)) {
    return 'Database';
  }

  if (/\b(?:systemctl|service|journalctl|tail|grep|chmod|chown|df|du|top|htop|ssh|scp|rsync)\b/.test(text)) {
    return 'Server';
  }

  return 'Custom';
}

function normalizeCommandCategory(value, commandText = '') {
  const category = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 40);

  return category || inferCommandCategory(commandText);
}

function normalizeCommand(command) {
  const commandText = String(command.command || '');

  return {
    id: String(command.id || crypto.randomUUID()),
    name: String(command.name || 'Command Shortcut'),
    category: normalizeCommandCategory(command.category, commandText),
    command: commandText
  };
}

function readSettings() {
  ensureSettingsFile();

  try {
    const data = JSON.parse(fs.readFileSync(getSettingsFilePath(), 'utf8'));
    const defaults = createDefaultSettings();

    const settings = {
      ...defaults,
      ...data,
      servers: Array.isArray(data.servers) && data.servers.length
        ? normalizeAndSecureServers(data.servers)
        : defaults.servers,
      commands: Array.isArray(data.commands)
        ? data.commands.map(normalizeCommand).filter((command) => command.command.trim())
        : defaults.commands,
      terminalActions: Array.isArray(data.terminalActions) && data.terminalActions.length
        ? data.terminalActions.map(normalizeTerminalAction)
        : defaults.terminalActions,
      auditLog: Array.isArray(data.auditLog) ? data.auditLog.slice(-500) : [],
      ui: normalizeUi({
        ...defaults.ui,
        ...(data.ui || {})
      }),
      reportUsage: normalizeReportUsage(data.reportUsage || defaults.reportUsage),
      reportHistory: normalizeReportHistory(data.reportHistory || defaults.reportHistory),
      reportOptions: normalizeReportOptions(data.reportOptions || defaults.reportOptions),
      ai: normalizeAiSettings(data.ai || defaults.ai)
    };

    if (!settings.servers.find((server) => server.id === settings.selectedServerId)) {
      settings.selectedServerId = settings.servers[0]?.id || 'local-terminal';
    }

    if (settingsContainInlineSecrets(data)) {
      writeSettingsFileAtomic(getSettingsFilePath(), settings);
    }

    return settings;
  } catch (error) {
    const backupPath = `${getSettingsFilePath()}.broken-${Date.now()}`;
    try {
      fs.copyFileSync(getSettingsFilePath(), backupPath);
    } catch (_) {
      // Ignore backup failure and recreate settings.
    }

    const defaults = createDefaultSettings();
    writeSettingsFileAtomic(getSettingsFilePath(), defaults);
    return defaults;
  }
}

function saveSettings(settings) {
  createSettingsAutoBackup('before-save');

  const current = readSettings();

  const next = {
    version: 1,
    selectedServerId: String(settings.selectedServerId || current.selectedServerId || 'local-terminal'),
    servers: Array.isArray(settings.servers) && settings.servers.length
      ? normalizeAndSecureServers(settings.servers)
      : current.servers,
    commands: Array.isArray(settings.commands)
      ? settings.commands.map(normalizeCommand).filter((command) => command.command.trim())
      : (Array.isArray(current.commands) ? current.commands.map(normalizeCommand) : createDefaultSettings().commands),
    terminalActions: Array.isArray(settings.terminalActions) && settings.terminalActions.length
      ? settings.terminalActions.map(normalizeTerminalAction)
      : (Array.isArray(current.terminalActions) && current.terminalActions.length
        ? current.terminalActions.map(normalizeTerminalAction)
        : createDefaultTerminalActions()),
    auditLog: Array.isArray(current.auditLog) ? current.auditLog.slice(-500) : [],
    ui: normalizeUi({
      ...(current.ui || {}),
      ...(settings.ui || {})
    }),
    reportUsage: normalizeReportUsage(settings.reportUsage || current.reportUsage),
    reportHistory: normalizeReportHistory(settings.reportHistory || current.reportHistory),
    reportOptions: normalizeReportOptions(settings.reportOptions || current.reportOptions),
    ai: normalizeAiSettings(settings.ai || current.ai)
  };

  if (!next.servers.find((server) => server.id === next.selectedServerId)) {
    next.selectedServerId = next.servers[0]?.id || '';
  }

  writeSettingsFileAtomic(getSettingsFilePath(), next);
  createSettingsAutoBackup('after-save');
  return next;
}

function addAuditLog(entry) {
  const settings = readSettings();

  settings.auditLog.push({
    id: crypto.randomUUID(),
    action: String(entry.action || 'event'),
    message: String(entry.message || ''),
    createdAt: new Date().toISOString()
  });

  settings.auditLog = settings.auditLog.slice(-500);
  writeSettingsFileAtomic(getSettingsFilePath(), settings);

  return settings.auditLog;
}

module.exports = {
  readSettings,
  saveSettings,
  addAuditLog,
  getSettingsFilePath,
  createSettingsAutoBackup
};
