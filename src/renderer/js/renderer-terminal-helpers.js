/* global window */
(function initAdvanceTerminalRendererTerminalHelpers() {
  const foundation = window.AdvanceTerminalRendererFoundation;

  if (!foundation) {
    throw new Error('Renderer foundation helpers failed to load before terminal helpers.');
  }

  const {
    randomId,
    clampInteger
  } = foundation;

  const TERMINAL_ACTION_ICONS = Object.freeze({
    terminal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3"/><path d="M12 15h5"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16"/><path d="M6 16l8-8 4 4-8 8H6z"/><path d="M13 9l2-2a2 2 0 0 1 3 3l-2 2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>',
    select: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="12" height="12" rx="1"/><path d="M8 20h12V8"/></svg>',
    paste: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l1 2h3v14H5V6h3z"/><path d="M9 4h6v4H9z"/><path d="M9 13h6M9 17h4"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><octagon points="7.5 3 16.5 3 21 7.5 21 16.5 16.5 21 7.5 21 3 16.5 3 7.5"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    lines: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h12M4 17h8"/><path d="M18 17l2 2 2-2"/></svg>',
    logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8V5a2 2 0 0 0-2-2H5v18h7a2 2 0 0 0 2-2v-3"/><path d="M9 12h12"/><path d="m18 9 3 3-3 3"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 10-13h-7z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18v3h3l6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-2-2z"/></svg>',
    folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h7l2 2h9v10H3z"/><path d="M3 7v12"/></svg>'
  });

  const TERMINAL_ACTION_ICON_LABELS = Object.freeze({
    terminal: 'Terminal',
    eraser: 'Clear',
    copy: 'Copy',
    select: 'Select',
    paste: 'Paste',
    stop: 'Stop',
    lines: 'Lines',
    logout: 'Logout',
    close: 'Close',
    bolt: 'Run',
    play: 'Play',
    wrench: 'Tool',
    folder: 'Folder'
  });

  const TERMINAL_ACTION_ICON_KEYS = new Set(Object.keys(TERMINAL_ACTION_ICONS));

  const DEFAULT_COMMAND_CATEGORIES = ['Laravel', 'Git', 'Composer', 'NPM', 'Server', 'Database', 'Custom'];

function getDefaultTerminalActions() {
  return [
    { id: 'term-action-clear', name: 'Clear Screen', action: 'clear', icon: 'eraser', text: '', enabled: true },
    { id: 'term-action-copy-all', name: 'Copy All Screen', action: 'copyAll', icon: 'copy', text: '', enabled: true },
    { id: 'term-action-copy-selection', name: 'Copy Selection', action: 'copySelection', icon: 'select', text: '', enabled: true },
    { id: 'term-action-paste', name: 'Paste', action: 'paste', icon: 'paste', text: '', enabled: true },
    { id: 'term-action-ctrl-c', name: 'Ctrl+C', action: 'ctrlC', icon: 'stop', text: '', enabled: true },
    { id: 'term-action-ctrl-l', name: 'Ctrl+L', action: 'ctrlL', icon: 'lines', text: '', enabled: true },
    { id: 'term-action-ctrl-d', name: 'Ctrl+D', action: 'ctrlD', icon: 'logout', text: '', enabled: true },
    { id: 'term-action-close', name: 'Close Session', action: 'closeSession', icon: 'close', text: '', enabled: true }
  ];
}

function normalizeTerminalToolbarAction(action) {
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

  return {
    id: String(action?.id || randomId('term-action')),
    name: String(action?.name || 'Terminal Action'),
    action: allowedActions.has(String(action?.action || '')) ? String(action.action) : 'sendText',
    icon: TERMINAL_ACTION_ICON_KEYS.has(String(action?.icon || '')) ? String(action.icon) : 'terminal',
    text: String(action?.text || ''),
    enabled: action?.enabled !== false
  };
}

const RISKY_COMMAND_RULES = [
  {
    label: 'Destructive file delete',
    severity: 'high',
    pattern: /(?:^|[;&|]\s*)rm\s+(?=[^\r\n;&|]*-)(?=[^\r\n;&|]*r)(?=[^\r\n;&|]*f)[^\r\n;&|]*/i,
    reason: 'This may permanently delete files or folders.'
  },
  {
    label: 'Laravel database reset',
    severity: 'high',
    pattern: /\bphp\s+artisan\s+(?:migrate:fresh|migrate:reset|db:wipe)\b/i,
    reason: 'This may reset or wipe database data.'
  },
  {
    label: 'Database destructive query',
    severity: 'high',
    pattern: /\b(?:DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i,
    reason: 'This may remove database records, tables, or databases.'
  },
  {
    label: 'Wide-open permissions',
    severity: 'high',
    pattern: /\bchmod\s+-R\s+777\b/i,
    reason: 'This may make files writable by everyone.'
  },
  {
    label: 'Recursive ownership change',
    severity: 'medium',
    pattern: /\bchown\s+-R\b/i,
    reason: 'This may change ownership for many files.'
  },
  {
    label: 'Forced dependency fix',
    severity: 'medium',
    pattern: /\bnpm\s+audit\s+fix\s+--force\b/i,
    reason: 'This may upgrade packages with breaking changes.'
  },
  {
    label: 'Dependency lock changes',
    severity: 'medium',
    pattern: /\b(?:composer|npm|yarn|pnpm)\s+update\b/i,
    reason: 'This may change dependency versions and lock files.'
  },
  {
    label: 'Git hard reset',
    severity: 'high',
    pattern: /\bgit\s+reset\s+--hard\b/i,
    reason: 'This may discard local code changes.'
  },
  {
    label: 'Git clean delete',
    severity: 'high',
    pattern: /\bgit\s+clean\s+-[a-z]*f[a-z]*\b/i,
    reason: 'This may delete untracked files.'
  },
  {
    label: 'Privileged system change',
    severity: 'medium',
    pattern: /(?:^|[;&|]\s*)sudo\s+(?:rm|chmod|chown|dd|mkfs|parted|fdisk)\b/i,
    reason: 'This runs a potentially destructive system command with elevated permissions.'
  },
  {
    label: 'Disk write/format command',
    severity: 'high',
    pattern: /\b(?:dd\s+if=.*\bof=|mkfs|parted|fdisk)\b/i,
    reason: 'This may write to or format disks.'
  }
];

function analyzeCommandRisk(commandText = '') {
  const text = String(commandText || '').replace(/\s+/g, ' ').trim();
  const matches = [];
  const seen = new Set();

  if (!text) {
    return {
      risky: false,
      labels: [],
      reasons: [],
      severity: 'none'
    };
  }

  RISKY_COMMAND_RULES.forEach((rule) => {
    if (!rule.pattern.test(text)) {
      return;
    }

    const key = rule.label.toLowerCase();

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    matches.push(rule);
  });

  return {
    risky: matches.length > 0,
    labels: matches.map((item) => item.label),
    reasons: matches.map((item) => item.reason),
    severity: matches.some((item) => item.severity === 'high') ? 'high' : (matches.length ? 'medium' : 'none')
  };
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

function extractCommandVariables(template) {
  const variables = [];
  const seen = new Set();
  const matches = String(template || '').matchAll(/\{([A-Za-z][A-Za-z0-9_-]{0,60})\}/g);

  for (const match of matches) {
    const name = String(match[1] || '').trim();

    if (!name || seen.has(name)) {
      continue;
    }

    seen.add(name);
    variables.push(name);
  }

  return variables;
}

function classifyTerminalActivity(value) {
  const text = String(value || '').toLowerCase();
  const categories = new Set();

  if (!text.trim()) {
    return ['Other terminal activity'];
  }

  if (/\bphp\s+artisan\b|\bartisan\b|\blaravel\b|\boptimize:clear\b|\bconfig:cache\b|\broute:cache\b|\bmigrate\b|\bqueue:/.test(text)) {
    categories.add('Laravel / Artisan work');
  }

  if (/\bphp\s+artisan\s+(optimize:clear|cache:clear|config:clear|route:clear|view:clear|event:clear|config:cache|route:cache|view:cache)\b|\boptimize:clear\b|\bconfig:(clear|cache)\b|\broute:(clear|cache)\b|\bview:(clear|cache)\b|\bcache:clear\b/.test(text)) {
    categories.add('Laravel cache/config maintenance');
  }

  if (/\bphp\s+artisan\s+(migrate|migrate:fresh|migrate:refresh|db:seed|schema:dump)\b|\bmigrate\b|\bseed\b|\bschema:dump\b/.test(text)) {
    categories.add('Laravel database migration work');
  }

  if (/\bphp\s+artisan\s+(queue:|schedule:|horizon|octane|storage:link)\b|\bqueue:(work|restart|listen|failed|retry)\b|\bschedule:(run|work)\b|\bstorage:link\b/.test(text)) {
    categories.add('Laravel queue/scheduler/runtime work');
  }

  if (/\bgit\b|\bcommit\b|\bpush\b|\bpull\b|\bbranch\b|\bcheckout\b|\bmerge\b/.test(text)) {
    categories.add('Git / version control');
  }

  if (/\bcomposer\b|\bphp\b|\bvendor\b/.test(text)) {
    categories.add('PHP / Composer dependency work');
  }

  if (/\bcomposer\s+(install|update|require|remove|dump-autoload)\b|\bnpm\s+(install|update|ci)\b|\bnpx\b|\bpnpm\s+(install|update)\b|\byarn\s+(install|add|upgrade)\b/.test(text)) {
    categories.add('Dependency install/update work');
  }

  if (/\bnpm\b|\bpnpm\b|\byarn\b|\bnode\b|\bpackage\.json\b|\bwebpack\b|\bvite\b/.test(text)) {
    categories.add('Node / frontend dependency work');
  }

  if (/\bnpm\s+(run\s+)?(build|dev|watch|check|test|lint)\b|\bnpm\.cmd\s+(run\s+)?(build|dev|watch|check|test|lint)\b|\bpnpm\s+(build|dev|test|lint)\b|\byarn\s+(build|dev|test|lint)\b|\bnode\s+--check\b|\bvite\b|\bwebpack\b/.test(text)) {
    categories.add('Frontend build/test/check work');
  }

  if (/\bmysql\b|\bmariadb\b|\bpostgres\b|\bpsql\b|\bsqlite\b|\bredis\b|\bdatabase\b|\bdb:/.test(text)) {
    categories.add('Database-related work');
  }

  if (/\bcd\b|\bpwd\b|\bls\b|\bdir\b|\bfind\b|\bgrep\b|\bcat\b|\btail\b|\bhead\b|\btree\b/.test(text)) {
    categories.add('File navigation / inspection');
  }

  if (/\btail\s+-f\b|\bstorage\/logs\b|\berror_log\b|\blog\b|\bgrep\b|\bjournalctl\b/.test(text)) {
    categories.add('Log/debug inspection');
  }

  if (/\bnano\b|\bvim\b|\bvi\b|\bcode\b|\btouch\b|\bmkdir\b|\bcp\b|\bmv\b|\brm\b|\bunzip\b|\bzip\b|\btar\b/.test(text)) {
    categories.add('File editing / file operations');
  }

  if (/\bpublic_html\b|\bdeploy\b|\brelease\b|\brsync\b|\bscp\b|\bftp\b|\bunzip\b|\bzip\b|\btar\b|\bdist\b|\bbuild\b/.test(text)) {
    categories.add('Deployment / hosting file work');
  }

  if (/\bsystemctl\b|\bservice\b|\bpm2\b|\bsupervisor\b|\bnginx\b|\bapache\b|\bcron\b|\bjournalctl\b/.test(text)) {
    categories.add('Server service maintenance');
  }

  if (/\bchmod\b|\bchown\b|\bsudo\b|\bpermissions?\b|\bownership\b/.test(text)) {
    categories.add('Permissions / ownership changes');
  }

  if (/\bssh\b|\bscp\b|\brsync\b|\bcurl\b|\bwget\b|\bping\b|\bnetstat\b|\bss\b/.test(text)) {
    categories.add('Network / remote access');
  }

  if (/\bclear\b|\bcls\b|\bctrl\+c\b|\bctrl\+d\b|\bcopy\b|\bpaste\b/.test(text)) {
    categories.add('Terminal control / clipboard action');
  }

  return Array.from(categories.size ? categories : ['Other terminal activity']);
}

function classifyIssueText(value) {
  const text = String(value || '').toLowerCase();
  const issues = new Set();

  if (!text.trim()) {
    return [];
  }

  if (/permission denied|eacces|forbidden|operation not permitted/.test(text)) {
    issues.add('Permission denied / access issue');
  }

  if (/authentication failed|permission denied \(publickey|all configured authentication|unauthorized|invalid password/.test(text)) {
    issues.add('SSH authentication issue');
  }

  if (/connection timed out|timeout|etimedout|econnreset|connection refused|network is unreachable/.test(text)) {
    issues.add('Connection / network issue');
  }

  if (/command not found|not recognized as|no such file or directory|could not open input file/.test(text)) {
    issues.add('Missing command or path issue');
  }

  if (/npm err|yarn error|pnpm err|composer.*error|failed to install|dependency/.test(text)) {
    issues.add('Dependency install/build issue');
  }

  if (/fatal:|git.*error|merge conflict|conflict/.test(text)) {
    issues.add('Git issue');
  }

  if (/sqlstate|database error|access denied for user|mysql|postgres/.test(text)) {
    issues.add('Database issue');
  }

  if (/\bwarning\b|\berror\b|\bfailed\b|\bfatal\b|\bexception\b/.test(text)) {
    issues.add('General warning/error output');
  }

  return Array.from(issues);
}

function needsSecret(server) {
  if (!server || server.type !== 'remote') {
    return null;
  }

  // Private-key SSH should not ask for a passphrase before connecting.
  // If a passphrase was saved on the connection, the main process uses it silently.
  // If the key has no passphrase, the connection continues without any popup.
  // If the key is encrypted and no passphrase was saved, the terminal shows a clear error.
  return null;
}

function getTerminalBufferText(term) {
  const buffer = term?.buffer?.active;

  if (!buffer) {
    return '';
  }

  const lines = [];
  let currentLine = '';

  for (let index = 0; index < buffer.length; index += 1) {
    const line = buffer.getLine(index);

    if (!line) {
      continue;
    }

    const text = line.translateToString(true);

    if (line.isWrapped) {
      currentLine += text;
      continue;
    }

    if (currentLine !== '') {
      lines.push(currentLine);
    }

    currentLine = text;
  }

  if (currentLine !== '') {
    lines.push(currentLine);
  }

  return lines.join('\n').trimEnd();
}

function getConnectionReliability(server = {}) {
  return {
    keepAlive: server.keepAlive !== false,
    autoReconnect: Boolean(server.autoReconnect),
    reconnectAttempts: clampInteger(server.reconnectAttempts, 3, 1, 20),
    reconnectDelay: clampInteger(server.reconnectDelay, 5, 1, 300)
  };
}

function markAuthenticationFailure(session, data) {
  const text = String(data || '').toLowerCase();

  if (!session || !text) {
    return;
  }

  if (
    text.includes('permission denied')
    || text.includes('authentication failed')
    || text.includes('all configured authentication methods failed')
    || text.includes('private key needs a passphrase')
    || text.includes('too many authentication failures')
  ) {
    session.authFailed = true;
  }
}


function terminalActionIconSvg(iconName) {
  return TERMINAL_ACTION_ICONS[iconName] || TERMINAL_ACTION_ICONS.terminal;
}

function getTerminalTheme() {
  return {
    background: '#0c0c0c',
    foreground: '#cccccc',
    cursor: '#ffffff',
    selectionBackground: '#264f78'
  };
}

function getTerminalOptions() {
  return {
    cursorBlink: true,
    convertEol: true,
    fontFamily: 'Cascadia Mono, Consolas, Menlo, Monaco, monospace',
    fontSize: 14,
    theme: getTerminalTheme(),
    scrollback: 6000
  };
}

function createTerminalSessionState({
  terminalId,
  server,
  term,
  fitAddon,
  pane,
  startedAt = Date.now(),
  startedLabel = ''
} = {}) {
  return {
    terminalId,
    server,
    term,
    fitAddon,
    pane,
    closed: false,
    manualClose: false,
    hasConnected: false,
    authFailed: false,
    reconnectAttemptsUsed: 0,
    status: 'connecting',
    processBusy: false,
    processLabel: '',
    processBusySince: null,
    processBusyTimer: null,
    toolbarActionBusy: false,
    disposables: [],
    contextMenuHandler: null,
    terminalFocusHandler: null,
    report: {
      startedAt,
      startedLabel,
      inputChunks: [],
      outputChunks: [],
      commands: [],
      events: [],
      currentInput: '',
      outputBytes: 0,
      activeWorkMs: 0,
      lastActiveWorkCheckpointAt: null,
      lastOutputChunk: '',
      connectedAt: null,
      lastUsageCheckpointAt: null,
      registeredDate: null
    }
  };
}

function shouldAutoReconnectSession(session) {
  if (!session || session.manualClose || session.authFailed) {
    return false;
  }

  const reliability = getConnectionReliability(session.server);

  if (!reliability.autoReconnect) {
    return false;
  }

  if ((session.reconnectAttemptsUsed || 0) >= reliability.reconnectAttempts) {
    return false;
  }

  return true;
}

  window.AdvanceTerminalRendererTerminalHelpers = Object.freeze({
    DEFAULT_COMMAND_CATEGORIES,
    TERMINAL_ACTION_ICONS,
    TERMINAL_ACTION_ICON_LABELS,
    terminalActionIconSvg,
    getTerminalTheme,
    getTerminalOptions,
    createTerminalSessionState,
    shouldAutoReconnectSession,
    getDefaultTerminalActions,
    normalizeTerminalToolbarAction,
    analyzeCommandRisk,
    inferCommandCategory,
    normalizeCommandCategory,
    extractCommandVariables,
    classifyTerminalActivity,
    classifyIssueText,
    needsSecret,
    getTerminalBufferText,
    getConnectionReliability,
    markAuthenticationFailure
  });
}());
