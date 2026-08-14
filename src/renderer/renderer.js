/* global Terminal, FitAddon */
const rendererFoundation = window.AdvanceTerminalRendererFoundation;

if (!rendererFoundation) {
  throw new Error('Renderer foundation helpers failed to load.');
}

const {
  randomId,
  inferToastType,
  normalizeNotificationPosition,
  liveConsoleTime,
  stripTerminalControlText,
  trimLiveConsoleMessage,
  reportTimestamp,
  todayReportDateKey,
  formatReportDuration,
  formatHumanDuration,
  reportByteLength,
  redactSecrets,
  compactReportText,
  formatReportSize,
  normalizeReportOutputText,
  safeCounterLabel,
  incrementCounter,
  mergeCounters,
  topCounterRows,
  clampInteger,
  getPathFileName,
  formatSshKeyDate,
  getSshKeyLabel
} = rendererFoundation;

const rendererTerminalHelpers = window.AdvanceTerminalRendererTerminalHelpers;

if (!rendererTerminalHelpers) {
  throw new Error('Renderer terminal helpers failed to load.');
}

const {
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
} = rendererTerminalHelpers;

const rendererConnectionHelpers = window.AdvanceTerminalRendererConnectionHelpers;

if (!rendererConnectionHelpers) {
  throw new Error('Renderer connection helpers failed to load.');
}

const {
  serverSubtitle,
  normalizeConnectionFilter,
  normalizeConnectionGroupName,
  getServerGroup,
  getConnectionHealthBadgeClass,
  getConnectionHealthLabel,
  sanitizeHealthForSettings,
  getConnectionVisibleHealthBadge,
  getConnectionHoverBadges,
  setConnectionHealthTitle,
  renderConnectionHealthBadges,
  renderConnectionHoverBadges
} = rendererConnectionHelpers;

const rendererReportHelpers = window.AdvanceTerminalRendererReportHelpers;

if (!rendererReportHelpers) {
  throw new Error('Renderer report helpers failed to load.');
}

const {
  REPORT_HISTORY_MAX_ITEMS,
  REPORT_CUSTOM_RANGE_MAX_DAYS,
  REPORT_JOB_MAX_PER_DAY,
  DEFAULT_REPORT_OPTIONS,
  sanitizeReportJobCommand,
  inferReportJobType,
  normalizeReportJob,
  createEmptyReportDay,
  normalizeReportUsageClient,
  normalizeReportHistoryClient,
  normalizeReportOptionsClient,
  sessionConnectionKey,
  getConnectionSummary,
  extractReportFindings,
  getIssueAssistantAdvice,
  buildErrorAssistantRows,
  buildReportSuggestions,
  buildSmartReportSummary,
  getReportScopeLabel,
  getReportDateFilterLabel,
  reportDateKeyFromOffset,
  normalizeReportCustomRangeFilter,
  getReportDateRangeBounds,
  getReportDateKeysForFilter,
  getReportDateRangeLabel,
  reportJobOverlapsRange,
  jobMatchesReportScope,
  getReportJobStatusLabel,
  sessionMatchesReportScope,
  reportDaysIncludeToday,
  mergeConnectionReportItem,
  emptyConnectionReportItem,
  formatSessionSummaryLine,
  safeReportFilename,
  buildSettingsImportPreviewMessage,
  formatRuntimeDuration,
  formatRuntimeMemory
} = rendererReportHelpers;

const state = {
  settings: null,
  appInfo: null,
  updateStatus: null,
  settingsRestorePoints: [],
  settingsRestoreSummary: null,
  aiStatus: null,
  selectedServerId: null,
  activeView: 'terminal',
  activeSettingsTab: 'safety',
  activeReportTab: 'options',
  activeHelpTab: 'about',
  activeLeftTab: 'connections',
  connectionsPanelCollapsed: false,
  connectionFilter: 'all',
  connectionGroupFilter: 'all',
  commandCategoryFilter: 'all',
  activeToolbarPanel: 'terminal',
  editingServerId: null,
  editingCommandId: null,
  draggingServerId: null,
  draggingCommandId: null,
  draggingTerminalId: null,
  terminalTabDrag: null,
  closedTerminalTabs: [],
  editingTerminalTabGroupId: null,
  editingTerminalActionId: null,
  draggingTerminalActionId: null,
  terminalToolbarDropdownMenu: null,
  editingTerminalProfileId: null,
  editingWorkspaceId: null,
  workspaceDraftMode: false,
  workspaceRestoreInFlight: false,
  workspaceStartupRestoreAttempted: false,
  pinnedTabsStartupRestoreAttempted: false,
  activeWorkspaceId: null,
  detectedTerminalShells: [],
  commandPaletteOpen: false,
  commandPaletteEntries: [],
  commandPaletteResults: [],
  commandPaletteSelectedIndex: 0,
  commandPalettePreviousFocus: null,
  terminals: new Map(),
  terminalGroups: new Map(),
  activeTerminalId: null,
  activeTerminalGroupId: null,
  splitResize: null,
  pendingSecret: null,
  pendingSecretMeta: null,
  pendingConfirmResolve: null,
  pendingSafePasteResolve: null,
  liveConsoleOpen: false,
  liveConsoleSize: 'closed',
  liveConsoleHeight: 320,
  liveConsoleResize: null,
  liveConsoleDock: 'right',
  liveConsoleDismissed: false,
  terminalHostResizeObserver: null,
  terminalFitAnimationFrame: null,
  liveConsoleLogs: [],
  liveProcessLogs: [],
  activityFeedReady: false,
  activityFeedLastEvent: null,
  liveConsoleBuffers: new Map(),
  liveConsoleTimers: new Map(),
  liveConsoleRenderTimer: null,
  outputActivityBuffers: new Map(),
  outputActivityTimers: new Map(),
  runtimeStatsTimer: null,
  usageStatsTimer: null,
  usagePersistTimer: null,
  usagePersistInFlight: false,
  usagePersistAgain: false,
  settingsSaveTimer: null,
  settingsSaveInFlight: false,
  settingsSaveAgain: false,
  busyActions: new Set(),
  connectionAttemptInFlight: false,
  connectionHealthCheckInFlight: null,
  terminalActionInFlight: false,
  usageLastCheckpoint: Date.now(),
  currentReportText: '',
  currentReportSnapshot: null,
  currentReportScope: 'all',
  currentReportDateFilter: 'today',
  sshKeys: [],
  sshKeyLocations: [],
  pinnedConnectionIds: new Set(),
  reconnectTimers: new Map()
};

const LIVE_CONSOLE_DEFAULT_HEIGHT = 320;
const LIVE_CONSOLE_MIN_HEIGHT = 180;
const LIVE_CONSOLE_MAX_WINDOW_RATIO = 0.7;
const LIVE_CONSOLE_MAX_ENTRIES = 300;
const LIVE_CONSOLE_RENDER_ENTRIES = 180;
const LIVE_CONSOLE_MAX_MESSAGE_LENGTH = 1600;
const LIVE_CONSOLE_OUTPUT_BUFFER_LIMIT = 12000;
const LIVE_CONSOLE_OUTPUT_FLUSH_MS = 450;
const LIVE_PROCESS_MAX_ENTRIES = 8;
const OUTPUT_ACTIVITY_BUFFER_LIMIT = 24000;
const OUTPUT_ACTIVITY_FLUSH_MS = 250;
const USAGE_SAVE_DEBOUNCE_MS = 2500;
const SETTINGS_SAVE_DEBOUNCE_MS = 800;
const CONNECTIONS_PANEL_COLLAPSED_STORAGE_KEY = 'advanceTerminal.connectionsPanelCollapsed';
const PINNED_CONNECTIONS_STORAGE_KEY = 'advanceTerminal.pinnedConnections';
const COMMAND_PALETTE_RECENTS_STORAGE_KEY = 'advanceTerminal.commandPaletteRecents';
const COMMAND_PALETTE_MAX_RESULTS = 60;
const COMMAND_PALETTE_MAX_RECENTS = 12;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));




function getNotificationPosition() {
  return normalizeNotificationPosition(state.settings?.ui?.notificationPosition);
}

function updateNotificationPositionControls(position = getNotificationPosition()) {
  const select = $('#notification-position-select');

  if (select) {
    select.value = normalizeNotificationPosition(position);
  }
}

function applyNotificationPosition(position = getNotificationPosition()) {
  const toast = $('#toast');
  const normalized = normalizeNotificationPosition(position);

  document.documentElement.dataset.notificationPosition = normalized;

  if (toast) {
    toast.classList.remove(
      'toast-position-top-left',
      'toast-position-top-center',
      'toast-position-top-right',
      'toast-position-bottom-left',
      'toast-position-bottom-center',
      'toast-position-bottom-right'
    );
    toast.classList.add(`toast-position-${normalized}`);
  }

  updateNotificationPositionControls(normalized);
}

async function setNotificationPosition(position, persist = true) {
  const normalized = normalizeNotificationPosition(position);

  if (!state.settings) {
    applyNotificationPosition(normalized);
    return;
  }

  state.settings.ui = {
    ...(state.settings.ui || {}),
    notificationPosition: normalized
  };

  applyNotificationPosition(normalized);

  if (persist) {
    state.settings = await saveSettings({ toastMessage: '', debounce: true, refresh: false });
    applyNotificationPosition(getNotificationPosition());
  }
}

function normalizeActivityFeedTerminalOutputMode(value) {
  const normalized = String(value || '').toLowerCase();

  return ['off', 'errors', 'full'].includes(normalized) ? normalized : 'off';
}

function getActivityFeedTerminalOutputMode() {
  return normalizeActivityFeedTerminalOutputMode(state.settings?.ui?.activityFeed?.terminalOutput);
}

function updateActivityFeedOutputControls(mode = getActivityFeedTerminalOutputMode()) {
  const select = $('#activity-feed-terminal-output-select');

  if (select) {
    select.value = normalizeActivityFeedTerminalOutputMode(mode);
  }
}

async function setActivityFeedTerminalOutputMode(mode) {
  const normalized = normalizeActivityFeedTerminalOutputMode(mode);

  if (!state.settings) {
    updateActivityFeedOutputControls(normalized);
    return;
  }

  state.settings.ui = {
    ...(state.settings.ui || {}),
    activityFeed: {
      ...(state.settings.ui?.activityFeed || {}),
      terminalOutput: normalized
    }
  };

  updateActivityFeedOutputControls(normalized);
  appendActivityFeedEvent(`Activity Feed terminal output: ${normalized === 'off' ? 'Off' : normalized === 'errors' ? 'Errors only' : 'Full output'}.`, 'action', { dedupeMs: 800 });
  await saveSettings({ toastMessage: '', debounce: true, refresh: false });
}

function previewNotification() {
  const label = getNotificationPosition()
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  showToast(`Notification preview: ${label}`, 4500, 'info');
}


function appendActivityFeedEvent(message, level = 'info', options = {}) {
  if (!state.activityFeedReady && !options.allowBeforeReady) {
    return;
  }

  const cleaned = stripTerminalControlText(String(message || ''))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' · ')
    .trim();

  if (!cleaned) {
    return;
  }

  const dedupeMs = Number.isFinite(Number(options.dedupeMs)) ? Number(options.dedupeMs) : 1000;
  const key = `${level}:${cleaned}`;
  const now = Date.now();

  if (
    state.activityFeedLastEvent
    && state.activityFeedLastEvent.key === key
    && now - state.activityFeedLastEvent.time < dedupeMs
  ) {
    return;
  }

  state.activityFeedLastEvent = { key, time: now };
  appendLiveConsole(cleaned, level);
}

function getActivityViewLabel(view) {
  const labels = {
    terminal: 'Terminal',
    view: 'View',
    settings: 'Settings',
    report: 'Report',
    about: 'Help'
  };

  return labels[view] || String(view || 'View');
}

function getActivitySettingsTabLabel(tab) {
  return String(tab || 'settings')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function dismissToast() {
  const toast = $('#toast');

  clearTimeout(showToast.timer);

  if (!toast) {
    return;
  }

  toast.classList.add('hidden');
  toast.classList.remove('toast-replay');
}

function showToast(message, timeout = 3200, type = null) {
  const toast = $('#toast');
  let toastTimeout = timeout;
  let toastTypeOverride = type;

  if (!toast) {
    return;
  }

  if (typeof timeout === 'string' && !type) {
    toastTypeOverride = timeout;
    toastTimeout = 3200;
  }

  const safeTimeout = Number.isFinite(Number(toastTimeout)) && Number(toastTimeout) > 0
    ? Number(toastTimeout)
    : 3200;
  const toastType = inferToastType(message, toastTypeOverride);

  // Replace the single live notification and restart its entrance animation.
  // The forced reflow makes repeated clicks immediately close and visibly reopen it.
  dismissToast();
  applyNotificationPosition(getNotificationPosition());
  toast.textContent = message;
  toast.setAttribute('role', toastType === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', toastType === 'error' ? 'assertive' : 'polite');
  toast.classList.remove('toast-info', 'toast-success', 'toast-warning', 'toast-error');
  toast.classList.add(`toast-${toastType}`);
  void toast.offsetWidth;
  toast.classList.remove('hidden');
  toast.classList.add('toast-replay');

  appendActivityFeedEvent(`Notification: ${message}`, toastType, { dedupeMs: 1800 });

  showToast.timer = setTimeout(dismissToast, safeTimeout);
}


const TERMINAL_PROCESS_SAFETY_TIMEOUT_MS = 60 * 60 * 1000;
const TERMINAL_BUSY_ALLOWED_ACTIONS = new Set(['ctrlC', 'closeSession']);
const TERMINAL_PROCESS_SAFE_ACTIONS = new Set([
  'clear',
  'copyAll',
  'copySelection',
  'paste',
  'ctrlC',
  'closeSession'
]);

const TERMINAL_ACTION_KIND_LABELS = Object.freeze({
  clear: 'Clear Screen',
  copyAll: 'Copy All Screen',
  copySelection: 'Copy Selection',
  paste: 'Paste',
  ctrlA: 'Ctrl+A',
  ctrlC: 'Ctrl+C',
  ctrlD: 'Ctrl+D',
  ctrlE: 'Ctrl+E',
  ctrlK: 'Ctrl+K',
  ctrlL: 'Ctrl+L',
  ctrlR: 'Ctrl+R',
  ctrlU: 'Ctrl+U',
  ctrlW: 'Ctrl+W',
  ctrlZ: 'Ctrl+Z',
  enter: 'Enter',
  tab: 'Tab',
  escape: 'Escape',
  arrowUp: 'Arrow Up',
  arrowDown: 'Arrow Down',
  arrowLeft: 'Arrow Left',
  arrowRight: 'Arrow Right',
  closeSession: 'Close Session',
  sendText: 'Send Command + Enter',
  typeText: 'Type Text Only'
});

const TERMINAL_ACTION_KEY_SEQUENCES = Object.freeze({
  ctrlA: '\x01',
  ctrlC: '\x03',
  ctrlD: '\x04',
  ctrlE: '\x05',
  ctrlK: '\x0b',
  ctrlL: '\x0c',
  ctrlR: '\x12',
  ctrlU: '\x15',
  ctrlW: '\x17',
  ctrlZ: '\x1a',
  enter: '\r',
  tab: '\t',
  escape: '\x1b',
  arrowUp: '\x1b[A',
  arrowDown: '\x1b[B',
  arrowRight: '\x1b[C',
  arrowLeft: '\x1b[D'
});

function terminalActionKindLabel(kind) {
  return TERMINAL_ACTION_KIND_LABELS[String(kind || '')] || String(kind || 'Terminal Action');
}

function terminalActionHexToRgba(hex, alpha = 0.12) {
  const match = String(hex || '').trim().match(/^#([0-9a-f]{6})$/i);

  if (!match) {
    return '';
  }

  const value = match[1];
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function setTerminalActionIconContent(container, action) {
  if (!container) {
    return;
  }

  const normalized = normalizeTerminalToolbarAction(action);
  container.innerHTML = '';
  container.classList.toggle('terminal-action-custom-icon', normalized.icon === 'custom');

  if (normalized.icon === 'custom' && normalized.customIcon) {
    container.textContent = normalized.customIcon;
    return;
  }

  container.innerHTML = terminalActionIconSvg(normalized.icon);
}

function getConnectingTerminalSession(exceptTerminalId = null) {
  return Array.from(state.terminals.values()).find((session) => {
    if (!session || session.closed || session.terminalId === exceptTerminalId) {
      return false;
    }

    return String(session.status || '').toLowerCase() === 'connecting';
  }) || null;
}

function isTerminalSessionProcessing(session) {
  if (!session || session.closed) {
    return false;
  }

  const status = String(session.status || '').toLowerCase();

  return ['connecting', 'reconnecting'].includes(status)
    || session.processBusy === true
    || session.toolbarActionBusy === true;
}

function terminalActionAllowedWhileProcessing(action) {
  return TERMINAL_BUSY_ALLOWED_ACTIONS.has(String(action || ''));
}

function getTerminalSafetySettings() {
  return {
    lockActionsWhileCommandRunning: state.settings?.ui?.terminalSafety?.lockActionsWhileCommandRunning !== false
  };
}

function isTerminalActionBlockedWhileProcessing(session, action) {
  if (!session || session.closed) {
    return false;
  }

  const normalizedAction = String(action || '');
  const status = String(session.status || '').toLowerCase();

  if (['connecting', 'reconnecting'].includes(status) || session.toolbarActionBusy === true) {
    return !terminalActionAllowedWhileProcessing(normalizedAction);
  }

  if (session.processBusy !== true) {
    return false;
  }

  if (!getTerminalSafetySettings().lockActionsWhileCommandRunning) {
    return false;
  }

  return !TERMINAL_PROCESS_SAFE_ACTIONS.has(normalizedAction);
}

function isTerminalActionInteractionBlocked(session, action) {
  const normalizedAction = String(action || '');

  return isTerminalActionBlockedWhileProcessing(session, normalizedAction)
    || (state.terminalActionInFlight && !terminalActionAllowedWhileProcessing(normalizedAction));
}

function getTerminalProcessingLabel(session) {
  const status = String(session?.status || '').toLowerCase();

  if (status === 'connecting') {
    return `Connecting to ${session?.server?.name || 'the server'}`;
  }

  if (status === 'reconnecting') {
    return `Reconnecting ${session?.server?.name || 'the server'}`;
  }

  if (status === 'connected' && !session?.processBusy) {
    return `${session?.server?.name || 'A terminal'} is already connected`;
  }

  return session?.processLabel || 'A terminal command is still running';
}

function showConnectionAttemptBusyNotification(session, requestedServer = null) {
  const activeName = session?.server?.name || session?.server?.host || 'Another server';
  const requestedName = requestedServer?.name || requestedServer?.host || '';
  const suffix = requestedName && requestedName !== activeName
    ? ` Wait before connecting ${requestedName}.`
    : ' Please wait for the connection to finish.';

  showToast(`Connection in progress — ${activeName} is still connecting.${suffix}`, 6500, 'warning');

  if (session?.terminalId) {
    activateTerminalAndFocus(session.terminalId);
  }
}

function updateTerminalInteractionState() {
  const activeSession = state.terminals.get(state.activeTerminalId) || null;
  const connectingSession = getConnectingTerminalSession();
  const connectionOperationBusy = Boolean(connectingSession || state.connectionHealthCheckInFlight || state.connectionAttemptInFlight);

  $$('.terminal-action-button').forEach((button) => {
    const action = button.dataset.terminalAction || '';
    const disabled = isTerminalActionInteractionBlocked(activeSession, action);
    button.disabled = disabled;
    button.classList.toggle('is-busy', disabled);
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');

    if (disabled) {
      button.title = `${button.dataset.defaultTitle || button.title || 'Terminal action'} — unavailable while the terminal is busy`;
    } else if (button.dataset.defaultTitle) {
      button.title = button.dataset.defaultTitle;
    }
  });

  const fixedTerminalActions = [
    ['#tool-copy-all-terminal', 'copyAll'],
    ['#tool-copy-all-terminal-terminal', 'copyAll'],
    ['#tool-copy-selection-terminal', 'copySelection'],
    ['#tool-paste-terminal', 'paste'],
    ['#tool-paste-terminal-terminal', 'paste'],
    ['#tool-send-ctrl-c', 'ctrlC'],
    ['#tool-send-ctrl-l', 'ctrlL'],
    ['#tool-send-ctrl-d', 'ctrlD'],
    ['#tool-close-terminal', 'closeSession']
  ];

  fixedTerminalActions.forEach(([selector, action]) => {
    const button = $(selector);

    if (!button) {
      return;
    }

    const disabled = isTerminalActionInteractionBlocked(activeSession, action);
    button.disabled = disabled;
    button.classList.toggle('is-busy', disabled);
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  });

  $$('.command-run-button').forEach((button) => {
    const disabled = isTerminalActionInteractionBlocked(activeSession, 'sendText');
    button.disabled = disabled;
    button.classList.toggle('is-busy', disabled);
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    button.title = disabled ? 'Wait for the active terminal process to finish.' : 'Run command';
  });

  $$('.connect-card-button').forEach((button) => {
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent.trim();
    }

    const card = button.closest('.server-card');
    const isConnectingServer = Boolean(
      connectingSession
      && card?.dataset?.serverId
      && connectingSession.server?.id === card.dataset.serverId
    );
    const disabled = connectionOperationBusy;

    button.disabled = disabled;
    button.classList.toggle('is-busy', disabled);
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    button.textContent = disabled
      ? (isConnectingServer ? 'Connecting' : 'Wait')
      : button.dataset.defaultLabel;
    button.title = disabled
      ? connectingSession
        ? `${connectingSession.server?.name || 'Another server'} is still connecting. Wait for it to finish.`
        : state.connectionHealthCheckInFlight
          ? `Connection check is running for ${state.connectionHealthCheckInFlight.serverName}.`
          : 'A connection request is being prepared.'
      : '';
  });
}

function setTerminalProcessBusy(session, busy, label = '') {
  if (!session) {
    return;
  }

  clearTimeout(session.processBusyTimer);
  session.processBusyTimer = null;
  session.processBusy = Boolean(busy);
  session.processLabel = busy ? String(label || 'A terminal command is still running').slice(0, 180) : '';
  session.processBusySince = busy ? Date.now() : null;

  if (busy) {
    session.processBusyTimer = setTimeout(() => {
      if (!state.terminals.has(session.terminalId) || session.closed) {
        return;
      }

      session.processBusy = false;
      session.processLabel = '';
      session.processBusySince = null;
      session.processBusyTimer = null;
      updateTerminalInteractionState();
      showToast('Terminal action lock was released after the safety timeout.', 5000, 'warning');
    }, TERMINAL_PROCESS_SAFETY_TIMEOUT_MS);
  }

  updateTerminalInteractionState();
}

function terminalOutputLooksReady(data) {
  const cleaned = stripTerminalControlText(data)
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .pop();

  if (!cleaned || cleaned.length > 260) {
    return false;
  }

  return /^(?:PS\s+)?[A-Za-z]:[\\/].*>\s*$/.test(cleaned)
    || /^(?:\([^)]+\)\s*)?(?:[\w.-]+@[\w.-]+(?::[^$#\r\n]*)?|[~/.][^$#\r\n]*)[$#%❯➜]\s*$/.test(cleaned)
    || /^\[[^\]\r\n]+@[^\]\r\n]+\][#$%]\s*$/.test(cleaned)
    || /^[$#%❯➜]\s*$/.test(cleaned)
    || /^[A-Za-z0-9_.-]{1,80}[$#%❯➜]\s*$/.test(cleaned);
}

function maybeReleaseTerminalProcessBusy(session, data) {
  if (session?.processBusy && terminalOutputLooksReady(data)) {
    setTerminalProcessBusy(session, false);
  }
}

function guardTerminalAction(session, actionName, actionKind = '') {
  if (!session) {
    return false;
  }

  if (isTerminalActionBlockedWhileProcessing(session, actionKind)) {
    showToast(`${actionName} is unavailable — ${getTerminalProcessingLabel(session)}.`, 5000, 'warning');
    focusTerminal(session);
    return false;
  }

  return true;
}

function setTerminalHeaderTitle(value) {
  const titleEl = $('#terminal-title');

  if (!titleEl) {
    return;
  }

  const title = String(value || 'Advance Terminal').trim() || 'Advance Terminal';
  titleEl.textContent = title;
  titleEl.title = title;
}

function setTerminalStatus(status, label = null) {
  const statusPill = $('#terminal-status');

  if (!statusPill) {
    return;
  }

  const normalized = String(status || 'idle').toLowerCase();
  const labels = {
    idle: 'Idle',
    connecting: 'Connecting',
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Error'
  };

  statusPill.textContent = label || labels[normalized] || labels.idle;
  statusPill.classList.remove(
    'status-idle',
    'status-connecting',
    'status-connected',
    'status-disconnected',
    'status-error'
  );
  statusPill.classList.add(`status-${labels[normalized] ? normalized : 'idle'}`);
  updateTerminalInteractionState();
}

function normalizeTerminalLocation(value) {
  return String(value || '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\s+$/g, '')
    .trim();
}

function shortenTerminalLocation(location, maxLength = 110) {
  const normalized = normalizeTerminalLocation(location);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `…${normalized.slice(-(maxLength - 1))}`;
}

function getInitialTerminalLocation(server) {
  const startFolder = normalizeTerminalLocation(server?.workingDirectory);

  if (startFolder) {
    return startFolder;
  }

  if (server?.type === 'remote') {
    return '/';
  }

  return 'C:\\';
}

function updateTerminalLocationHeader(session = state.terminals.get(state.activeTerminalId)) {
  const locationEl = $('#terminal-location');

  if (!locationEl) {
    return;
  }

  const location = normalizeTerminalLocation(session?.currentLocation);

  if (!session) {
    locationEl.textContent = 'No active terminal location';
    locationEl.title = 'No active terminal location';
    locationEl.classList.add('muted');
    return;
  }

  if (!location) {
    locationEl.textContent = 'Location unavailable';
    locationEl.title = 'Location unavailable';
    locationEl.classList.add('muted');
    return;
  }

  locationEl.textContent = shortenTerminalLocation(location);
  locationEl.title = location;
  locationEl.classList.remove('muted');
}

function setSessionCurrentLocation(session, location) {
  const normalized = normalizeTerminalLocation(location);

  if (!session || !normalized || session.currentLocation === normalized) {
    return false;
  }

  session.currentLocation = normalized;

  if (session.terminalId === state.activeTerminalId) {
    updateTerminalLocationHeader(session);
  }

  return true;
}

function decodeTerminalFileUri(uri) {
  const raw = String(uri || '').trim();

  if (!raw) {
    return '';
  }

  if (!raw.toLowerCase().startsWith('file://')) {
    return decodeURIComponent(raw);
  }

  let value = raw.replace(/^file:\/\//i, '');

  // OSC 7 usually sends file://host/path. Windows PowerShell may send file:///C:/path.
  const firstSlash = value.indexOf('/');
  const pathPart = firstSlash >= 0 ? value.slice(firstSlash) : value;

  try {
    value = decodeURIComponent(pathPart || value);
  } catch (_) {
    value = pathPart || value;
  }

  if (/^\/[a-zA-Z]:\//.test(value)) {
    return value.slice(1).replace(/\//g, '\\');
  }

  return value || raw;
}

function stripTerminalControlSequences(text) {
  return String(text || '')
    .replace(/\x1b\]7;[^\x07]*(?:\x07|\x1b\\)?/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\r/g, '\n');
}

function extractPowerShellLocation(text) {
  const cleaned = stripTerminalControlSequences(text);
  const matches = Array.from(cleaned.matchAll(/(?:^|\n)PS\s+(.+?)>\s*$/gm));

  if (!matches.length) {
    return '';
  }

  return matches[matches.length - 1][1];
}

function extractPosixPromptLocation(text) {
  const cleaned = stripTerminalControlSequences(text);
  const matches = Array.from(cleaned.matchAll(/(?:^|\n)(?:[A-Za-z0-9._-]+@[\w.-]+:)?((?:~|\/)[^\n\r$#>]*)\s*[$#]\s*$/gm));

  if (!matches.length) {
    return '';
  }

  return matches[matches.length - 1][1];
}

function updateSessionLocationFromTerminalData(session, data) {
  if (!session || typeof data !== 'string' || !data) {
    return;
  }

  session.locationOutputBuffer = `${session.locationOutputBuffer || ''}${data}`.slice(-5000);

  const oscMatches = Array.from(String(data).matchAll(/\x1b\]7;([^\x07\x1b]*)(?:\x07|\x1b\\)/g));

  if (oscMatches.length) {
    const latest = decodeTerminalFileUri(oscMatches[oscMatches.length - 1][1]);

    if (setSessionCurrentLocation(session, latest)) {
      return;
    }
  }

  const powerShellLocation = extractPowerShellLocation(session.locationOutputBuffer);

  if (powerShellLocation) {
    setSessionCurrentLocation(session, powerShellLocation);
    return;
  }

  const posixLocation = extractPosixPromptLocation(session.locationOutputBuffer);

  if (posixLocation) {
    setSessionCurrentLocation(session, posixLocation);
  }
}


function normalizeSshLockPath(value) {
  const raw = normalizeTerminalLocation(value).replace(/\\/g, '/');

  if (!raw || raw === '~') {
    return '';
  }

  if (!raw.startsWith('/')) {
    return '';
  }

  const parts = [];

  raw.split('/').forEach((part) => {
    if (!part || part === '.') {
      return;
    }

    if (part === '..') {
      parts.pop();
      return;
    }

    parts.push(part);
  });

  return `/${parts.join('/')}`.replace(/\/+$/g, '') || '/';
}

function getSshLockBaseLocation(session) {
  if (!session || session.server?.type !== 'remote' || getPasteProtectionSettings().lockSshToStartFolder === false) {
    return '';
  }

  const base = normalizeSshLockPath(session.server?.workingDirectory);

  if (!base || base === '/') {
    return '';
  }

  return base;
}

function isPathInsideSshLockBase(base, target) {
  const normalizedBase = normalizeSshLockPath(base);
  const normalizedTarget = normalizeSshLockPath(target);

  return Boolean(
    normalizedBase
    && normalizedTarget
    && (
      normalizedTarget === normalizedBase
      || normalizedTarget.startsWith(`${normalizedBase}/`)
    )
  );
}

function stripShellComment(command) {
  const text = String(command || '');
  let quote = '';

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quote) {
      if (char === quote && text[index - 1] !== '\\') {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '#') {
      return text.slice(0, index);
    }
  }

  return text;
}

function splitShellCommandSegments(command) {
  return stripShellComment(command)
    .split(/\s*(?:&&|\|\||;)\s*/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function stripSimpleShellQuotes(value) {
  const text = String(value || '').trim();

  if (!text) {
    return '';
  }

  const quoted = text.match(/^(['"])(.*)\1$/s);

  if (quoted) {
    return quoted[2];
  }

  const firstQuoted = text.match(/^(['"])(.*?)\1(?:\s|$)/s);

  if (firstQuoted) {
    return firstQuoted[2];
  }

  return text.split(/\s+/)[0] || '';
}

function resolveSshCdTarget(session, target) {
  const base = getSshLockBaseLocation(session);
  const current = normalizeSshLockPath(session?.currentLocation) || base;
  const rawTarget = String(target || '').trim();

  if (!base) {
    return { ok: true, path: '' };
  }

  if (!rawTarget || rawTarget === '~' || rawTarget.startsWith('~/') || rawTarget === '$HOME' || rawTarget.startsWith('$HOME/')) {
    return {
      ok: false,
      reason: `SSH folder lock blocked cd to the home folder. Stay inside ${base}.`
    };
  }

  if (rawTarget === '-') {
    return {
      ok: false,
      reason: `SSH folder lock blocked cd - because the previous folder cannot be verified. Stay inside ${base}.`
    };
  }

  if (/[$`]/.test(rawTarget)) {
    return {
      ok: false,
      reason: `SSH folder lock blocked dynamic cd target. Use a direct folder inside ${base}.`
    };
  }

  const unquotedTarget = stripSimpleShellQuotes(rawTarget);

  if (!unquotedTarget) {
    return {
      ok: false,
      reason: `SSH folder lock blocked empty cd target. Stay inside ${base}.`
    };
  }

  const resolved = normalizeSshLockPath(
    unquotedTarget.startsWith('/')
      ? unquotedTarget
      : `${current}/${unquotedTarget}`
  );

  if (!isPathInsideSshLockBase(base, resolved)) {
    return {
      ok: false,
      reason: `SSH folder lock blocked navigation outside ${base}.`
    };
  }

  return {
    ok: true,
    path: resolved
  };
}

function inspectSshLockedCommandLine(session, commandLine) {
  const base = getSshLockBaseLocation(session);

  if (!base) {
    return { blocked: false, nextLocation: '' };
  }

  const segments = splitShellCommandSegments(commandLine);
  let nextLocation = '';

  for (const segment of segments) {
    if (/^(?:ssh|sftp|telnet)\b/i.test(segment)) {
      return {
        blocked: true,
        reason: `SSH folder lock blocked opening another remote shell from this session. Use the saved server list instead.`
      };
    }

    if (/^(?:scp|rsync)\b/i.test(segment) && /:/.test(segment)) {
      return {
        blocked: true,
        reason: `SSH folder lock blocked remote transfer/jump syntax. Stay inside this saved SSH server.`
      };
    }

    if (/\b(?:bash|sh|zsh|dash)\s+-c\s+(['"])[\s\S]*?\bcd\s+[\s\S]*?\1/i.test(segment)) {
      return {
        blocked: true,
        reason: `SSH folder lock blocked shell -c directory changes because the final folder cannot be verified.`
      };
    }

    const popdMatch = segment.match(/^(?:builtin\s+|command\s+)?popd\b/i);

    if (popdMatch) {
      return {
        blocked: true,
        reason: `SSH folder lock blocked popd because the target folder cannot be verified.`
      };
    }

    const cdMatch = segment.match(/^(?:builtin\s+|command\s+)?(cd|pushd)\b(?:\s+([\s\S]*))?$/i);

    if (cdMatch) {
      const target = cdMatch[2] || '';
      const resolved = resolveSshCdTarget(
        nextLocation ? { ...session, currentLocation: nextLocation } : session,
        target
      );

      if (!resolved.ok) {
        return {
          blocked: true,
          reason: resolved.reason
        };
      }

      if (resolved.path) {
        nextLocation = resolved.path;
      }
    }
  }

  return {
    blocked: false,
    nextLocation
  };
}

function getCompleteCommandLinesFromTerminalData(session, data) {
  const combined = `${session?.sshTypedCommandBuffer || ''}${String(data || '')}`;
  const normalized = combined.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parts = normalized.split('\n');
  const ended = /[\r\n]$/.test(String(data || ''));

  return {
    lines: ended ? parts : parts.slice(0, -1),
    trailing: ended ? '' : (parts[parts.length - 1] || '')
  };
}

function showSshPathLockBlocked(session, reason) {
  const message = reason || 'SSH folder lock blocked this command.';

  if (session?.term) {
    session.term.write(`\r\n[Advance Terminal] ${message}\r\n`);
  }

  appendLiveConsole(`SSH folder lock: ${message}`, 'warning');
  recordSessionEvent(session, message, 'warning');
  showToast(message, 6000, 'warning');
  focusTerminal(session);
}

function applySshLockedLocationResult(session, result) {
  if (result?.nextLocation) {
    setSessionCurrentLocation(session, result.nextLocation);
  }
}

function inspectSshLockedTerminalData(session, data) {
  if (!getSshLockBaseLocation(session)) {
    return { blocked: false, nextLocation: '' };
  }

  const { lines, trailing } = getCompleteCommandLinesFromTerminalData(session, data);
  let nextLocation = '';

  for (const line of lines) {
    const result = inspectSshLockedCommandLine(
      nextLocation ? { ...session, currentLocation: nextLocation } : session,
      line
    );

    if (result.blocked) {
      return result;
    }

    if (result.nextLocation) {
      nextLocation = result.nextLocation;
    }
  }

  return {
    blocked: false,
    nextLocation,
    trailing
  };
}

function updateSshTypedCommandBuffer(session, data) {
  if (!session) {
    return;
  }

  const text = String(data || '');

  if (text === '\x03' || text === '\x15') {
    session.sshTypedCommandBuffer = '';
    return;
  }

  if (text === '\x7f') {
    session.sshTypedCommandBuffer = String(session.sshTypedCommandBuffer || '').slice(0, -1);
    return;
  }

  if (/^\x1b/.test(text)) {
    return;
  }

  if (/[\r\n]/.test(text)) {
    const { trailing } = getCompleteCommandLinesFromTerminalData(session, text);
    session.sshTypedCommandBuffer = trailing || '';
    return;
  }

  if (/^[\x20-\x7e]+$/.test(text)) {
    session.sshTypedCommandBuffer = `${session.sshTypedCommandBuffer || ''}${text}`.slice(-4000);
  }
}

function handleSshLockedInteractiveInput(session, data) {
  if (!getSshLockBaseLocation(session)) {
    return false;
  }

  const text = String(data || '');

  if (!text) {
    return false;
  }

  if (/^[\r\n]+$/.test(text)) {
    const result = inspectSshLockedCommandLine(session, session.sshTypedCommandBuffer || '');

    if (result.blocked) {
      window.advanceTerminal.writeTerminal({
        terminalId: session.terminalId,
        data: '\x15'
      });
      session.sshTypedCommandBuffer = '';
      showSshPathLockBlocked(session, result.reason);
      return true;
    }

    applySshLockedLocationResult(session, result);
    session.sshTypedCommandBuffer = '';
    return false;
  }

  if (/[\r\n]/.test(text)) {
    const result = inspectSshLockedTerminalData(session, text);

    if (result.blocked) {
      if (session.sshTypedCommandBuffer) {
        window.advanceTerminal.writeTerminal({
          terminalId: session.terminalId,
          data: '\x15'
        });
      }

      session.sshTypedCommandBuffer = '';
      showSshPathLockBlocked(session, result.reason);
      return true;
    }

    applySshLockedLocationResult(session, result);
    session.sshTypedCommandBuffer = result.trailing || '';
    return false;
  }

  updateSshTypedCommandBuffer(session, text);
  return false;
}




function isRemoteTerminalSession(session) {
  return session?.server?.type === 'remote';
}

function showTerminalConnectingOverlay(session, message = '') {
  const overlay = session?.connectOverlay;

  if (!overlay) {
    return;
  }

  const title = overlay.querySelector('strong');
  const detail = overlay.querySelector('p');

  if (title) {
    title.textContent = 'Connecting...';
  }

  if (detail) {
    detail.textContent = message || `Opening ${session.server?.name || 'SSH'} session`;
  }

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function hideTerminalConnectingOverlay(session) {
  const overlay = session?.connectOverlay;

  if (!overlay) {
    return;
  }

  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function cleanTerminalStartupBuffer(buffer) {
  return stripTerminalControlSequences(buffer)
    .replace(/\r/g, '\n')
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)?/g, '');
}

function getCleanSshStartupTargetBasename(session) {
  const target = normalizeTerminalLocation(session?.server?.workingDirectory);

  if (!target || target === '/' || target === '~') {
    return '';
  }

  const parts = target
    .replace(/[\\\/]+$/g, '')
    .split(/[\\\/]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts[parts.length - 1] || '';
}

function isCleanSshStartupPromptReady(line, session, buffer) {
  const expectedBase = getCleanSshStartupTargetBasename(session);

  if (!expectedBase) {
    return true;
  }

  const escapedBase = expectedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (new RegExp(`(?:^|[\\s:~/])${escapedBase}(?:\\]|\\s*[$#]|\\s|$)`, 'i').test(line)) {
    return true;
  }

  const cleaned = cleanTerminalStartupBuffer(buffer || '');
  const changedFolder = new RegExp(`\\bcd\\s+['"]?[^\\n\\r]*${escapedBase}[^\\n\\r]*['"]?`, 'i').test(cleaned);
  const waitedLongEnough = Number.isFinite(Number(session?.cleanSshStartupStartedAt))
    && Date.now() - Number(session.cleanSshStartupStartedAt) > 10000;

  return changedFolder && waitedLongEnough;
}

function extractCleanSshStartupPrompt(buffer, session = null) {
  const lines = cleanTerminalStartupBuffer(buffer)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (
      /^Connecting to\b/i.test(line)
      || /^SSH connected\.?$/i.test(line)
      || /^Last failed login:/i.test(line)
      || /^There (?:were|was) \d+ failed login/i.test(line)
      || /^Start Folder\b/i.test(line)
      || /^\[[^\]\r\n]+\]\s*[$#]\s*cd\s+/i.test(line)
      || /^[A-Za-z0-9._-]+@[\w.-]+:[^\r\n$#>]*\s*[$#]\s*cd\s+/i.test(line)
    ) {
      continue;
    }

    const bracketPrompt = line.match(/(\[[^\]\r\n]+\]\s*[$#])\s*$/);
    if (bracketPrompt && isCleanSshStartupPromptReady(line, session, buffer)) {
      return bracketPrompt[1];
    }

    const pathPrompt = line.match(/([A-Za-z0-9._-]+@[\w.-]+:[^\r\n$#>]*\s*[$#])\s*$/);
    if (pathPrompt && isCleanSshStartupPromptReady(line, session, buffer)) {
      return pathPrompt[1];
    }
  }

  return '';
}

function hasSshStartupFailure(buffer) {
  return /(?:Connection failed|SSH shell error|All configured authentication methods failed|Timed out while waiting for handshake|Host key verification failed|ECONNREFUSED|ENOTFOUND|Authentication failed)/i
    .test(cleanTerminalStartupBuffer(buffer));
}


function quoteWorkspacePosixPath(value) {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function restoreWorkspaceRemoteLocation(session) {
  const target = normalizeTerminalLocation(session?.workspaceRestoreWorkingDirectory);
  session.workspaceRestoreWorkingDirectory = '';

  if (!target || !session || session.closed || session.server?.type !== 'remote') {
    return false;
  }

  const current = normalizeTerminalLocation(session.currentLocation);
  if (current && current === target) {
    return true;
  }

  const payload = `cd ${quoteWorkspacePosixPath(target)}\r`;
  const lockResult = inspectSshLockedTerminalData(session, payload);

  if (lockResult.blocked) {
    recordSessionEvent(session, `Workspace folder restore skipped: ${lockResult.reason}`, 'warning');
    appendActivityFeedEvent(
      `${session.server?.name || 'SSH'} workspace folder restore skipped: ${lockResult.reason}`,
      'warning',
      { dedupeMs: 1500 }
    );
    return false;
  }

  applySshLockedLocationResult(session, lockResult);
  session.sshTypedCommandBuffer = lockResult.trailing || '';

  window.advanceTerminal.writeTerminal({
    terminalId: session.terminalId,
    data: payload
  });

  recordSessionEvent(session, `Workspace folder restored: ${target}`, 'system');
  return true;
}

function finishCleanSshStartup(session, prompt) {
  session.cleanSshStartupActive = false;
  session.cleanSshStartupBuffer = '';
  session.cleanSshStartupStartedAt = null;
  hideTerminalConnectingOverlay(session);
  session.status = 'connected';
  updateConnectionHealthFromSession(session.server, 'ready', 'SSH prompt is ready.');
  recordSessionEvent(session, `Connected: ${session.server?.name || session.server?.host || session.terminalId}`, 'success');

  if (state.activeTerminalId === session.terminalId) {
    setTerminalStatus('connected');
  } else {
    updateTerminalInteractionState();
  }

  if (!session.connectionReadyNotified) {
    session.connectionReadyNotified = true;
    showToast(`${session.server?.name || session.server?.host || 'SSH terminal'} is connected.`, 4000, 'success');
  }

  try {
    session.term.clear();
    session.term.write(`${String(prompt || '').trim()} `);
  } catch (_) {
    // Ignore terminal cleanup failure if the tab was closed during connect.
  }

  restoreWorkspaceRemoteLocation(session);
  focusTerminal(session);
}

function handleCleanSshStartupData(session, data) {
  if (!isRemoteTerminalSession(session) || session.cleanSshStartupActive !== true) {
    return false;
  }

  session.cleanSshStartupBuffer = `${session.cleanSshStartupBuffer || ''}${data}`.slice(-12000);

  if (hasSshStartupFailure(session.cleanSshStartupBuffer)) {
    session.cleanSshStartupActive = false;
    session.cleanSshStartupBuffer = '';
    session.cleanSshStartupStartedAt = null;
    hideTerminalConnectingOverlay(session);
    return false;
  }

  const prompt = extractCleanSshStartupPrompt(session.cleanSshStartupBuffer, session);

  if (prompt) {
    finishCleanSshStartup(session, prompt);
  } else {
    showTerminalConnectingOverlay(session, `Waiting for ${session.server?.name || 'SSH'} prompt...`);
  }

  return true;
}



function getLiveConsoleSessionName(terminalId) {
  const session = state.terminals.get(terminalId);

  if (session?.server?.name) {
    return session.server.name;
  }

  return terminalId || 'Terminal';
}

function scheduleLiveConsoleRender() {
  if (state.liveConsoleRenderTimer) {
    return;
  }

  state.liveConsoleRenderTimer = setTimeout(() => {
    state.liveConsoleRenderTimer = null;

    if (state.liveConsoleOpen) {
      renderLiveConsole();
    }
  }, 100);
}

function renderLiveProcessBox() {
  const text = $('#live-process-text');
  const box = $('#live-process-box');

  if (!text || !box) {
    return;
  }

  const latestEntries = state.liveProcessLogs.slice(-LIVE_PROCESS_MAX_ENTRIES);

  if (!latestEntries.length) {
    text.textContent = 'No activity yet.';
    box.title = 'No activity yet.';
    box.dataset.level = 'info';
    return;
  }

  const latest = latestEntries[latestEntries.length - 1];
  const oneLine = String(latest.message || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' · ')
    .slice(0, 180);

  text.textContent = `[${latest.time}] ${oneLine}`;
  box.title = latestEntries
    .map((entry) => `[${entry.time}] ${entry.message}`)
    .join('\n');
  box.dataset.level = latest.level || 'info';
}

function appendLiveConsole(message, level = 'info') {
  const cleaned = stripTerminalControlText(message)
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();

  if (!cleaned.trim()) {
    return;
  }

  const entry = {
    time: liveConsoleTime(),
    level,
    message: trimLiveConsoleMessage(cleaned)
  };

  state.liveConsoleLogs.push(entry);
  state.liveProcessLogs.push(entry);

  while (state.liveConsoleLogs.length > LIVE_CONSOLE_MAX_ENTRIES) {
    state.liveConsoleLogs.shift();
  }

  while (state.liveProcessLogs.length > LIVE_PROCESS_MAX_ENTRIES) {
    state.liveProcessLogs.shift();
  }

  renderLiveProcessBox();
  scheduleLiveConsoleRender();
}

function renderLiveConsole() {
  const output = $('#live-console-output');

  if (!output) {
    return;
  }

  output.innerHTML = '';

  if (!state.liveConsoleLogs.length) {
    const empty = document.createElement('div');
    empty.className = 'live-console-empty';
    empty.textContent = 'No activity yet.';
    output.appendChild(empty);
    return;
  }

  const visibleEntries = state.liveConsoleLogs.slice(-LIVE_CONSOLE_RENDER_ENTRIES);

  visibleEntries.forEach((entry) => {
    const row = document.createElement('div');
    row.className = `live-console-entry live-console-entry-${entry.level || 'info'}`;

    const meta = document.createElement('span');
    meta.className = 'live-console-entry-time';
    meta.textContent = `[${entry.time}]`;

    const body = document.createElement('span');
    body.className = 'live-console-entry-message';
    body.textContent = entry.message;

    row.appendChild(meta);
    row.appendChild(body);
    output.appendChild(row);
  });

  output.scrollTop = output.scrollHeight;
}

function normalizeLiveConsoleSize(size) {
  return size === 'closed' ? 'closed' : 'medium';
}

function getLiveConsoleMaxHeight() {
  const windowHeight = Math.max(window.innerHeight || 720, 420);
  return Math.max(LIVE_CONSOLE_MIN_HEIGHT, Math.floor(windowHeight * LIVE_CONSOLE_MAX_WINDOW_RATIO));
}

function clampLiveConsoleHeight(height) {
  const value = Number.parseInt(height, 10);

  if (!Number.isFinite(value)) {
    return Math.min(LIVE_CONSOLE_DEFAULT_HEIGHT, getLiveConsoleMaxHeight());
  }

  return Math.min(Math.max(value, LIVE_CONSOLE_MIN_HEIGHT), getLiveConsoleMaxHeight());
}

function applyLiveConsoleHeight(height = state.liveConsoleHeight) {
  const consoleBox = $('#live-console');
  const nextHeight = clampLiveConsoleHeight(height);
  state.liveConsoleHeight = nextHeight;

  if (consoleBox) {
    consoleBox.style.setProperty('--live-console-height', `${nextHeight}px`);
  }

  return nextHeight;
}

function liveConsoleSizeLabel(size = state.liveConsoleSize) {
  return size === 'closed' ? 'Closed' : 'Open';
}

function updateLiveConsoleFooterControls() {
  const toggleButton = $('#footer-console-cycle');

  if (toggleButton) {
    toggleButton.textContent = state.liveConsoleOpen ? 'Hide Feed' : 'Activity Feed';
    toggleButton.title = 'Click to open or close Activity Feed. Drag the top edge to resize.';
    toggleButton.classList.toggle('active', state.liveConsoleOpen);
  }
}

function setLiveConsoleDock(dock) {
  const allowed = ['left', 'center', 'right'];
  state.liveConsoleDock = allowed.includes(dock) ? dock : 'right';

  const consoleBox = $('#live-console');

  if (consoleBox) {
    consoleBox.classList.remove('dock-left', 'dock-center', 'dock-right');
    consoleBox.classList.add(`dock-${state.liveConsoleDock}`);
  }

  updateLiveConsoleFooterControls();
}

function setLiveConsoleSize(size) {
  state.liveConsoleSize = normalizeLiveConsoleSize(size);
  state.liveConsoleOpen = state.liveConsoleSize !== 'closed';

  const consoleBox = $('#live-console');
  const tab = $('#live-console-tab');

  if (!consoleBox || !tab) {
    return;
  }

  if (state.liveConsoleOpen) {
    state.liveConsoleDismissed = false;
    consoleBox.classList.remove('is-dismissed');
  }

  consoleBox.classList.remove('is-large');
  consoleBox.classList.toggle('is-medium', state.liveConsoleOpen);
  consoleBox.classList.toggle('is-open', state.liveConsoleOpen);
  consoleBox.classList.toggle('is-collapsed', !state.liveConsoleOpen);

  if (state.liveConsoleOpen) {
    applyLiveConsoleHeight(state.liveConsoleHeight || LIVE_CONSOLE_DEFAULT_HEIGHT);
  }

  tab.setAttribute('aria-expanded', state.liveConsoleOpen ? 'true' : 'false');
  tab.querySelector('.live-console-tab-text').textContent = state.liveConsoleOpen
    ? 'Activity Feed: Open'
    : 'Activity Feed';
  tab.querySelector('.live-console-tab-arrow').textContent = state.liveConsoleOpen ? '▼' : '▲';
  updateLiveConsoleFooterControls();

  if (state.liveConsoleOpen) {
    renderLiveConsole();
  }
}

function setLiveConsoleOpen(open) {
  setLiveConsoleSize(open ? 'medium' : 'closed');
}

function dismissLiveConsole() {
  setLiveConsoleSize('closed');
  state.liveConsoleDismissed = true;

  const consoleBox = $('#live-console');
  consoleBox?.classList.add('is-dismissed');

  showToast('Activity Feed hidden. Use View → Activity Feed to reopen it.', 4200, 'success');
}

function toggleLiveConsole() {
  setLiveConsoleOpen(!state.liveConsoleOpen);
}

function cycleLiveConsole() {
  toggleLiveConsole();
}

function beginLiveConsoleResize(event) {
  if (event.button !== 0) {
    return;
  }

  const consoleBox = $('#live-console');

  if (!consoleBox) {
    return;
  }

  if (!state.liveConsoleOpen) {
    setLiveConsoleOpen(true);
  }

  state.liveConsoleResize = {
    startY: event.clientY,
    startHeight: clampLiveConsoleHeight(state.liveConsoleHeight || LIVE_CONSOLE_DEFAULT_HEIGHT)
  };

  consoleBox.classList.add('is-resizing');

  if (event.currentTarget?.setPointerCapture) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture is optional. Document listeners still handle dragging.
    }
  }

  event.preventDefault();
}

function moveLiveConsoleResize(event) {
  if (!state.liveConsoleResize) {
    return;
  }

  const deltaY = state.liveConsoleResize.startY - event.clientY;
  applyLiveConsoleHeight(state.liveConsoleResize.startHeight + deltaY);
  renderLiveConsole();
  event.preventDefault();
}

function endLiveConsoleResize() {
  if (!state.liveConsoleResize) {
    return;
  }

  state.liveConsoleResize = null;
  $('#live-console')?.classList.remove('is-resizing');
}

function setupLiveConsoleResize() {
  $('#live-console-resize-handle')?.addEventListener('pointerdown', beginLiveConsoleResize);
  window.addEventListener('pointermove', moveLiveConsoleResize);
  window.addEventListener('pointerup', endLiveConsoleResize);
  window.addEventListener('pointercancel', endLiveConsoleResize);
  window.addEventListener('resize', () => {
    applyLiveConsoleHeight(state.liveConsoleHeight || LIVE_CONSOLE_DEFAULT_HEIGHT);
  });
}

function clearLiveConsole() {
  state.liveConsoleLogs = [];
  state.liveProcessLogs = [];

  if (state.liveConsoleRenderTimer) {
    clearTimeout(state.liveConsoleRenderTimer);
    state.liveConsoleRenderTimer = null;
  }

  renderLiveProcessBox();
  renderLiveConsole();
  showToast('Activity feed cleared.');
}

async function copyLiveConsole() {
  if (!state.liveConsoleLogs.length) {
    showToast('Activity feed is empty.');
    return;
  }

  const text = state.liveConsoleLogs
    .map((entry) => `[${entry.time}] ${entry.message}`)
    .join('\n');

  await navigator.clipboard.writeText(text);
  showToast('Copied activity feed.');
}

function clearTerminalOutputBuffers(terminalId) {
  const liveTimer = state.liveConsoleTimers.get(terminalId);

  if (liveTimer) {
    clearTimeout(liveTimer);
    state.liveConsoleTimers.delete(terminalId);
  }

  const activityTimer = state.outputActivityTimers.get(terminalId);

  if (activityTimer) {
    clearTimeout(activityTimer);
    state.outputActivityTimers.delete(terminalId);
  }

  state.liveConsoleBuffers.delete(terminalId);
  state.outputActivityBuffers.delete(terminalId);
}

function isRoutineSshStartupActivityText(text) {
  const lines = cleanTerminalStartupBuffer(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return true;
  }

  return lines.every((line) => (
    /^Connecting to\b/i.test(line)
    || /^SSH connected\.?$/i.test(line)
    || /^Last failed login:/i.test(line)
    || /^There (?:were|was) \d+ failed login/i.test(line)
    || /^Start Folder\b/i.test(line)
    || /^Update:/i.test(line)
    || /^\[[^\]\r\n]+\]\s*[$#]\s*cd\s+/i.test(line)
    || /^\[[^\]\r\n]+\]\s*[$#]\s*$/i.test(line)
    || /^[A-Za-z0-9._-]+@[\w.-]+:[^\r\n$#>]*\s*[$#]\s*cd\s+/i.test(line)
    || /^[A-Za-z0-9._-]+@[\w.-]+:[^\r\n$#>]*\s*[$#]\s*$/i.test(line)
  ));
}

function maybeQueueLiveConsoleTerminalOutput(payload, session = null) {
  if (getActivityFeedTerminalOutputMode() === 'off') {
    return;
  }

  if (session?.cleanSshStartupActive === true) {
    return;
  }

  queueLiveConsoleTerminalOutput(payload);
}

function flushLiveConsoleTerminalOutput(terminalId) {
  const raw = state.liveConsoleBuffers.get(terminalId) || '';
  const timer = state.liveConsoleTimers.get(terminalId);

  if (timer) {
    clearTimeout(timer);
    state.liveConsoleTimers.delete(terminalId);
  }

  state.liveConsoleBuffers.delete(terminalId);

  const mode = getActivityFeedTerminalOutputMode();

  if (mode === 'off') {
    return;
  }

  let text = stripTerminalControlText(raw)
    .replace(/\n{4,}/g, '\n\n')
    .trimEnd();

  if (!text.trim()) {
    return;
  }

  if (isRoutineSshStartupActivityText(text)) {
    return;
  }

  if (mode === 'errors') {
    const issues = classifyIssueText(text);

    if (!issues.length) {
      return;
    }

    text = redactSecrets(text);
  } else {
    text = redactSecrets(text);
  }

  if (text.length > LIVE_CONSOLE_MAX_MESSAGE_LENGTH) {
    text = `${text.slice(0, LIVE_CONSOLE_MAX_MESSAGE_LENGTH)}\n… output shortened to keep the app responsive`;
  }

  const label = mode === 'errors' ? 'warning/error output' : 'output';
  appendLiveConsole(`${getLiveConsoleSessionName(terminalId)} ${label}:\n${text}`, mode === 'errors' ? 'warning' : 'terminal');
}

function queueLiveConsoleTerminalOutput(payload) {
  if (!payload?.terminalId || !payload.data) {
    return;
  }

  const cleaned = stripTerminalControlText(payload.data);

  if (!cleaned.trim()) {
    return;
  }

  const current = state.liveConsoleBuffers.get(payload.terminalId) || '';
  let next = `${current}${cleaned}`;

  if (next.length > LIVE_CONSOLE_OUTPUT_BUFFER_LIMIT) {
    next = next.slice(-LIVE_CONSOLE_OUTPUT_BUFFER_LIMIT);
  }

  state.liveConsoleBuffers.set(payload.terminalId, next);

  if (state.liveConsoleTimers.get(payload.terminalId)) {
    return;
  }

  const timer = setTimeout(() => {
    flushLiveConsoleTerminalOutput(payload.terminalId);
  }, LIVE_CONSOLE_OUTPUT_FLUSH_MS);

  state.liveConsoleTimers.set(payload.terminalId, timer);
}

function flushTerminalOutputActivity(terminalId) {
  const buffered = state.outputActivityBuffers.get(terminalId) || '';
  const timer = state.outputActivityTimers.get(terminalId);

  if (timer) {
    clearTimeout(timer);
    state.outputActivityTimers.delete(terminalId);
  }

  state.outputActivityBuffers.delete(terminalId);

  if (!buffered) {
    return;
  }

  const session = state.terminals.get(terminalId);

  if (!session || session.closed) {
    return;
  }

  recordTerminalOutput(session, buffered);
}

function queueTerminalOutputActivity(payload) {
  if (!payload?.terminalId || !payload.data) {
    return;
  }

  const current = state.outputActivityBuffers.get(payload.terminalId) || '';
  let next = `${current}${payload.data}`;

  if (next.length > OUTPUT_ACTIVITY_BUFFER_LIMIT) {
    next = next.slice(-OUTPUT_ACTIVITY_BUFFER_LIMIT);
  }

  state.outputActivityBuffers.set(payload.terminalId, next);

  if (state.outputActivityTimers.get(payload.terminalId)) {
    return;
  }

  const timer = setTimeout(() => {
    flushTerminalOutputActivity(payload.terminalId);
  }, OUTPUT_ACTIVITY_FLUSH_MS);

  state.outputActivityTimers.set(payload.terminalId, timer);
}


function getReportHistory() {
  if (!state.settings) {
    return normalizeReportHistoryClient();
  }

  state.settings.reportHistory = normalizeReportHistoryClient(state.settings.reportHistory);
  return state.settings.reportHistory;
}


function getReportOptions() {
  if (!state.settings) {
    return normalizeReportOptionsClient();
  }

  state.settings.reportOptions = normalizeReportOptionsClient(state.settings.reportOptions);
  return state.settings.reportOptions;
}

function renderReportOptionsSettings() {
  const options = getReportOptions();

  $$('[data-report-option]').forEach((input) => {
    const key = input.dataset.reportOption;
    input.checked = options[key] !== false;
  });

  updateActivityFeedOutputControls();
}

async function updateReportOptionFromInput(event) {
  const input = event?.currentTarget || event?.target;
  const key = input?.dataset?.reportOption;

  if (!key || !Object.prototype.hasOwnProperty.call(DEFAULT_REPORT_OPTIONS, key)) {
    return;
  }

  const options = getReportOptions();
  options[key] = Boolean(input.checked);
  state.settings.reportOptions = normalizeReportOptionsClient(options);
  appendActivityFeedEvent(`Report option updated: ${input.closest('label')?.querySelector('strong')?.textContent || key}.`, 'action', { dedupeMs: 800 });
  await saveSettings({ toastMessage: '', debounce: true, refresh: false });
}

function getAiSettingsClient() {
  const source = state.settings?.ai && typeof state.settings.ai === 'object'
    ? state.settings.ai
    : {};

  return {
    enabled: source.enabled === true,
    provider: 'openai',
    model: String(source.model || 'gpt-5.5').trim().replace(/\s+/g, '') || 'gpt-5.5',
    includeGitDiff: source.includeGitDiff === true,
    includeRecentCommands: source.includeRecentCommands !== false
  };
}

function updateAiSettingsControls() {
  const settings = getAiSettingsClient();
  const enabledToggle = $('#ai-reports-enabled-toggle');
  const modelInput = $('#ai-openai-model');
  const commandsToggle = $('#ai-include-commands-toggle');
  const diffToggle = $('#ai-include-git-diff-toggle');
  const statusEl = $('#ai-openai-key-status');

  if (enabledToggle) {
    enabledToggle.checked = settings.enabled;
  }

  if (modelInput) {
    modelInput.value = settings.model;
  }

  if (commandsToggle) {
    commandsToggle.checked = settings.includeRecentCommands;
  }

  if (diffToggle) {
    diffToggle.checked = settings.includeGitDiff;
  }

  if (statusEl) {
    const hasKey = state.aiStatus?.hasApiKey === true;
    const secure = state.aiStatus?.secretStorage?.available === true;
    statusEl.textContent = hasKey
      ? `API key saved locally${secure ? ' with secure storage' : ''}.`
      : 'No OpenAI API key saved.';
    statusEl.classList.toggle('ok', hasKey);
    statusEl.classList.toggle('warning', !hasKey);
  }

  const aiButtonsDisabled = !settings.enabled || state.aiStatus?.hasApiKey !== true;
  $('#tool-generate-ai-report')?.toggleAttribute('disabled', aiButtonsDisabled);
  $('#session-report-ai-generate')?.toggleAttribute('disabled', aiButtonsDisabled);
}

async function refreshAiStatus({ silent = false } = {}) {
  if (!window.advanceTerminal?.getAiStatus) {
    state.aiStatus = {
      ok: false,
      hasApiKey: false,
      error: 'AI bridge is not available in this build.'
    };
    updateAiSettingsControls();

    if (!silent) {
      showToast(state.aiStatus.error, 5000, 'warning');
    }

    return state.aiStatus;
  }

  try {
    state.aiStatus = await window.advanceTerminal.getAiStatus();
    updateAiSettingsControls();

    if (!silent) {
      showToast(state.aiStatus.hasApiKey ? 'AI status ready. API key is saved.' : 'AI status ready. Add an OpenAI API key.', 4000, state.aiStatus.hasApiKey ? 'success' : 'warning');
    }

    return state.aiStatus;
  } catch (error) {
    state.aiStatus = {
      ok: false,
      hasApiKey: false,
      error: error.message
    };
    updateAiSettingsControls();

    if (!silent) {
      showToast(`AI status failed: ${error.message}`, 6000, 'error');
    }

    return state.aiStatus;
  }
}

async function saveAiSettingsFromControls() {
  if (!state.settings) {
    return;
  }

  const apiKey = $('#ai-openai-api-key')?.value.trim() || '';
  const model = ($('#ai-openai-model')?.value || 'gpt-5.5').trim().replace(/\s+/g, '') || 'gpt-5.5';

  state.settings.ai = {
    enabled: $('#ai-reports-enabled-toggle')?.checked === true,
    provider: 'openai',
    model,
    includeRecentCommands: $('#ai-include-commands-toggle')?.checked !== false,
    includeGitDiff: $('#ai-include-git-diff-toggle')?.checked === true
  };

  state.settings = await saveSettings({ toastMessage: '', refresh: false });

  if (apiKey) {
    if (!window.advanceTerminal?.saveAiApiKey) {
      showToast('AI key save is not available in this build.', 6000, 'error');
      return;
    }

    const result = await window.advanceTerminal.saveAiApiKey({ apiKey });

    if (!result?.ok) {
      showToast(result?.error || 'OpenAI API key was not saved.', 7000, 'error');
      return;
    }

    $('#ai-openai-api-key').value = '';
    state.aiStatus = result;
  } else {
    await refreshAiStatus({ silent: true });
  }

  updateAiSettingsControls();
  appendActivityFeedEvent('AI settings saved.', 'action', { dedupeMs: 1200 });
  showToast('AI settings saved.', 3500, 'success');
}

async function clearAiApiKey() {
  if (!window.advanceTerminal?.clearAiApiKey) {
    showToast('AI key clear is not available in this build.', 6000, 'error');
    return;
  }

  const confirmed = await showConfirmDialog({
    title: 'Clear OpenAI API Key?',
    message: 'Remove the saved OpenAI API key from this computer? AI reports will stop working until a new key is saved.',
    confirmText: 'Clear Key',
    danger: true
  });

  if (!confirmed) {
    return;
  }

  state.aiStatus = await window.advanceTerminal.clearAiApiKey();
  updateAiSettingsControls();
  showToast('OpenAI API key cleared.', 3500, 'success');
}

function getActiveAiReportSession() {
  return state.terminals.get(state.activeTerminalId) || null;
}

function collectRecentAiCommands(session) {
  if (!session) {
    return [];
  }

  const report = ensureSessionReport(session);
  return (report.commands || [])
    .slice(-80)
    .map((item) => ({
      time: item.time || '',
      source: item.source || 'terminal',
      command: item.command || ''
    }));
}

function collectAiProjectReportPayload() {
  const session = getActiveAiReportSession();
  const aiSettings = getAiSettingsClient();
  const scope = getReportScope();
  const dateFilter = getReportDateFilter();
  const baseReport = buildScopedReport(scope, dateFilter);

  return {
    terminalName: session?.server?.name || session?.terminalId || 'Active Terminal',
    workingDirectory: session?.currentLocation || session?.server?.workingDirectory || '',
    currentLocation: session?.currentLocation || '',
    scope,
    dateFilter,
    baseReport: baseReport.text,
    recentCommands: aiSettings.includeRecentCommands ? collectRecentAiCommands(session) : []
  };
}

async function generateAiProjectReport() {
  return withBusyAction('aiReport', 'AI Generating...', async () => {
    const aiSettings = getAiSettingsClient();

    if (!aiSettings.enabled) {
      showToast('Enable AI reports first in Settings → AI.', 6000, 'warning');
      setActiveView('settings', 'settings');
      setSettingsTab('ai');
      return;
    }

    await refreshAiStatus({ silent: true });

    if (state.aiStatus?.hasApiKey !== true) {
      showToast('Add your OpenAI API key in Settings → AI first.', 7000, 'warning');
      setActiveView('settings', 'settings');
      setSettingsTab('ai');
      return;
    }

    const session = getActiveAiReportSession();

    if (!session) {
      showToast('Open or select a terminal tab first.', 5000, 'warning');
      setActiveView('terminal', 'terminal');
      return;
    }

    try {
      syncOpenTerminalUsage({ persist: false });
      const payload = collectAiProjectReportPayload();
      const result = await window.advanceTerminal.generateAiProjectReport(payload);

      if (!result?.ok) {
        showToast(result?.error || 'AI report generation failed.', 9000, 'error');
        appendLiveConsole(`AI report failed: ${result?.error || 'Unknown error'}`, 'error');
        return;
      }

      const generatedLabel = new Date(result.generatedAt || Date.now()).toLocaleString();
      const header = [
        `Generated by OpenAI (${result.model || aiSettings.model})`,
        result.localProjectReadable ? `Project root: ${result.projectRoot || 'Detected project'}` : 'Project files were not readable locally; terminal activity was used.',
        result.gitAvailable ? `Git snapshot included${result.diffIncluded ? ' with redacted diff details' : ' without diff details'}.` : 'Git snapshot was not available.',
        ''
      ].join('\n');

      state.currentReportText = `${header}${result.text}`;
      state.currentReportScope = 'active';
      state.currentReportDateFilter = getReportDateFilter();
      state.currentReportSnapshot = createReportHistoryItem({
        text: state.currentReportText,
        meta: {
          tabName: 'AI Project',
          scopeLabel: 'AI Project',
          dateLabel: getReportDateRangeLabel(state.currentReportDateFilter),
          duration: 'AI',
          commandCount: payload.recentCommands.length,
          findingCount: 0,
          summary: `AI Project Report • ${payload.terminalName} • ${generatedLabel}`
        }
      }, 'active', state.currentReportDateFilter);

      $('#session-report-title').textContent = 'AI Project Work Report';
      $('#report-tab-name').textContent = 'AI Project';
      $('#report-duration').textContent = 'AI';
      $('#report-job-count').textContent = '—';
      $('#report-command-count').textContent = String(payload.recentCommands.length);
      $('#report-finding-count').textContent = '—';
      $('#session-report-output').value = state.currentReportText;
      $('#session-report-modal').classList.remove('hidden');
      $('#session-report-output').focus();

      await saveCurrentReportToHistory({ silent: true });
      appendLiveConsole('AI project report generated.', 'action');
      showToast('AI project report generated.', 4000, 'success');
    } catch (error) {
      appendLiveConsole(`AI report failed: ${error.message}`, 'error');
      showToast(`AI report failed: ${error.message}`, 9000, 'error');
    }
  });
}

function getTodayUsageDay() {
  if (!state.settings) {
    return createEmptyReportDay();
  }

  state.settings.reportUsage = normalizeReportUsageClient(state.settings.reportUsage);
  const today = todayReportDateKey();

  if (!state.settings.reportUsage.days[today]) {
    state.settings.reportUsage.days[today] = createEmptyReportDay(today);
  }

  return state.settings.reportUsage.days[today];
}


function summarizeSessionForUsage(session, status = null) {
  const report = ensureSessionReport(session);
  const server = session?.server || {};
  const now = Date.now();
  const startedAt = Number(report.connectedAt || report.startedAt || now);
  const durationMs = Math.max(0, now - startedAt);
  const activeWorkMs = Math.max(0, Math.min(durationMs, Number(report.activeWorkMs || 0)));

  return {
    id: report.summaryId || session.terminalId || randomId('session-summary'),
    terminalId: String(session.terminalId || ''),
    name: String(server.name || session.terminalId || 'Terminal'),
    type: server.type === 'remote' ? 'remote' : 'local',
    host: server.type === 'remote' ? String(server.host || '') : '',
    username: server.type === 'remote' ? String(server.username || '') : '',
    startedAt: new Date(startedAt).toISOString(),
    endedAt: status && status !== 'Active' ? new Date(now).toISOString() : '',
    lastSeenAt: new Date(now).toISOString(),
    durationMs,
    activeWorkMs,
    idleMs: Math.max(0, durationMs - activeWorkMs),
    lastActivityAt: report.lastActivityAt ? new Date(Number(report.lastActivityAt)).toISOString() : '',
    status: status || (session.closed ? 'Closed' : 'Active'),
    commandCount: Number(report.commandCount || 0),
    inputActivityCount: Number(report.inputActivityCount || 0),
    outputBytes: Number(report.outputBytes || 0),
    activityCounters: { ...(report.activityCounters || {}) },
    issueCounters: { ...(report.issueCounters || {}) }
  };
}

function clearStaleActiveSessionsForNewRun() {
  const usage = normalizeReportUsageClient(state.settings?.reportUsage);
  state.settings.reportUsage = usage;
  markStaleReportJobsInterrupted();

  Object.values(usage.days || {}).forEach((day) => {
    const active = day.activeSessions || {};
    Object.values(active).forEach((summary) => {
      day.sessionHistory = Array.isArray(day.sessionHistory) ? day.sessionHistory : [];
      day.sessionHistory.push({
        ...summary,
        status: 'Closed when app exited',
        endedAt: summary.lastSeenAt || summary.endedAt || new Date().toISOString()
      });
    });
    day.sessionHistory = day.sessionHistory.slice(-300);
    day.activeSessions = {};
  });
  state.settings.reportUsage = usage;
}

function markUsageDirty(persistSoon = true) {
  const day = getTodayUsageDay();
  day.updatedAt = new Date().toISOString();

  if (!persistSoon) {
    return;
  }

  clearTimeout(state.usagePersistTimer);
  state.usagePersistTimer = setTimeout(() => {
    persistReportUsage().catch(() => {});
  }, USAGE_SAVE_DEBOUNCE_MS);
}

async function persistReportUsage() {
  if (!state.settings || !window.advanceTerminal?.saveSettings) {
    return;
  }

  if (state.usagePersistTimer) {
    clearTimeout(state.usagePersistTimer);
    state.usagePersistTimer = null;
  }

  if (state.usagePersistInFlight) {
    state.usagePersistAgain = true;
    return;
  }

  state.usagePersistInFlight = true;

  try {
    state.settings.reportUsage = normalizeReportUsageClient(state.settings.reportUsage);

    if (window.advanceTerminal.saveReportUsage) {
      state.settings.reportUsage = await window.advanceTerminal.saveReportUsage(state.settings.reportUsage);
    } else {
      state.settings = await window.advanceTerminal.saveSettings(state.settings);
    }
  } finally {
    state.usagePersistInFlight = false;

    if (state.usagePersistAgain) {
      state.usagePersistAgain = false;
      markUsageDirty(true);
    }
  }
}

function getBusyButtons(action) {
  const selectors = {
    report: ['#tool-generate-report'],
    aiReport: ['#tool-generate-ai-report', '#session-report-ai-generate'],
    exportSettings: ['#tool-save-settings', '#settings-save-main'],
    importSettings: ['#tool-import-settings', '#settings-import-main'],
    repairSettings: ['#tool-repair-settings', '#settings-repair-main'],
    saveReport: ['#tool-save-last-report', '#session-report-download'],
    saveReportHistory: ['#session-report-save-history'],
    reportHistory: ['#tool-report-history'],
    copyReport: ['#tool-copy-last-report', '#session-report-copy']
  }[action] || [];

  return selectors
    .map((selector) => $(selector))
    .filter(Boolean);
}

function setBusyAction(action, busy, label = 'Processing...') {
  const buttons = getBusyButtons(action);

  if (busy) {
    state.busyActions.add(action);
  } else {
    state.busyActions.delete(action);
  }

  buttons.forEach((button) => {
    if (busy) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent.trim();
      }

      button.disabled = true;
      button.classList.add('is-busy');
      const labelNode = button.querySelector('span:last-child');
      if (labelNode) {
        labelNode.textContent = label;
      } else {
        button.textContent = label;
      }
      return;
    }

    button.disabled = false;
    button.classList.remove('is-busy');

    if (button.dataset.originalText) {
      const labelNode = button.querySelector('span:last-child');
      if (labelNode) {
        labelNode.textContent = button.dataset.originalText;
      } else {
        button.textContent = button.dataset.originalText;
      }
      delete button.dataset.originalText;
    }
  });
}

async function withBusyAction(action, label, task) {
  if (state.busyActions.has(action)) {
    showToast('Please wait for the current action to finish.', 3500, 'warning');
    return null;
  }

  setBusyAction(action, true, label);

  try {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return await task();
  } finally {
    setBusyAction(action, false);
  }
}

async function saveSettingsNow({ toastMessage = '', refresh = true } = {}) {
  if (!state.settings || !window.advanceTerminal?.saveSettings) {
    return state.settings;
  }

  if (state.settingsSaveTimer) {
    clearTimeout(state.settingsSaveTimer);
    state.settingsSaveTimer = null;
  }

  if (state.settingsSaveInFlight) {
    state.settingsSaveAgain = true;
    return state.settings;
  }

  state.settingsSaveInFlight = true;

  try {
    state.settings.selectedServerId = state.selectedServerId;
    state.settings.reportOptions = normalizeReportOptionsClient(state.settings.reportOptions);
    state.settings = await window.advanceTerminal.saveSettings(state.settings);

    if (refresh) {
      updateConnectionGroupDatalist();
      renderServerList();
      renderCommandList();
      renderTerminalToolbarActions();
      renderTerminalProfileQuickMenu();
      populateLocalProfileDropdown();
      renderAuditLog();

      if (state.activeSettingsTab === 'terminal-profiles') {
        renderTerminalProfilesSettings();
      }

      if (state.activeSettingsTab === 'terminal-actions') {
        renderTerminalActionList();
      }

      renderWorkspaceQuickMenu();

      if (state.activeSettingsTab === 'workspaces') {
        renderWorkspaceSettings();
      }
    }

    if (toastMessage) {
      showToast(toastMessage);
    }

    appendActivityFeedEvent('Settings saved.', 'system', { dedupeMs: 3500 });

    return state.settings;
  } finally {
    state.settingsSaveInFlight = false;

    if (state.settingsSaveAgain) {
      state.settingsSaveAgain = false;
      scheduleSettingsSave({ refresh: false });
    }
  }
}

function scheduleSettingsSave({ toastMessage = '', refresh = false, delay = SETTINGS_SAVE_DEBOUNCE_MS } = {}) {
  if (!state.settings || !window.advanceTerminal?.saveSettings) {
    return Promise.resolve(state.settings);
  }

  if (state.settingsSaveTimer) {
    clearTimeout(state.settingsSaveTimer);
  }

  return new Promise((resolve) => {
    state.settingsSaveTimer = setTimeout(() => {
      state.settingsSaveTimer = null;
      saveSettingsNow({ toastMessage, refresh })
        .then(resolve)
        .catch((error) => {
          showToast(`Settings save failed: ${error.message}`, 7000, 'error');
          resolve(state.settings);
        });
    }, delay);
  });
}


function checkpointDailyUsage({ persist = true } = {}) {
  if (!state.settings) {
    return;
  }

  const now = Date.now();
  const elapsed = Math.max(0, Math.min(now - Number(state.usageLastCheckpoint || now), 5 * 60 * 1000));
  state.usageLastCheckpoint = now;

  const day = getTodayUsageDay();

  if (elapsed) {
    day.appUptimeMs += elapsed;
  }

  day.lastCheckpointAt = new Date(now).toISOString();

  state.terminals.forEach((session) => {
    if (!session || session.closed) {
      return;
    }

    ensureDailySessionRegistered(session, { mark: false });

    const report = ensureSessionReport(session);
    const type = session.server?.type === 'remote' ? 'remote' : 'local';
    const summary = getConnectionSummary(day, session);
    const sessionElapsed = Math.max(0, Math.min(now - Number(report.lastUsageCheckpointAt || now), 5 * 60 * 1000));

    report.lastUsageCheckpointAt = now;

    if (sessionElapsed) {
      day.terminalUptimeMs += sessionElapsed;
      summary.uptimeMs += sessionElapsed;

      if (type === 'remote') {
        day.sshUptimeMs += sessionElapsed;
      } else {
        day.localTerminalUptimeMs += sessionElapsed;
      }

      if (report.lastActivityAt && now - report.lastActivityAt <= 5 * 60 * 1000) {
        const creditedActiveWork = creditSessionActiveWork(session, now);
        day.activeWorkMs += creditedActiveWork;
        summary.activeWorkMs = Math.max(Number(summary.activeWorkMs || 0), Number(report.activeWorkMs || 0));
      }
    }

    syncActiveSessionUsage(session, 'Active', { mark: false });
  });

  markUsageDirty(persist);
}

function startDailyUsageTracking() {
  state.usageLastCheckpoint = Date.now();

  if (state.usageStatsTimer) {
    clearInterval(state.usageStatsTimer);
  }

  state.usageStatsTimer = setInterval(() => {
    checkpointDailyUsage({ persist: true });
  }, 15000);

  window.addEventListener('beforeunload', () => {
    checkpointDailyUsage({ persist: false });
  });
}

function syncActiveSessionUsage(session, status = 'Active', { mark = true } = {}) {
  if (!session?.terminalId || !state.settings) {
    return null;
  }

  const day = getTodayUsageDay();
  const summary = getConnectionSummary(day, session);
  const snapshot = summarizeSessionForUsage(session, status);
  const nowIso = new Date().toISOString();

  summary.name = snapshot.name;
  summary.type = snapshot.type;
  summary.commandCount = Math.max(Number(summary.commandCount || 0), Number(snapshot.commandCount || 0));
  summary.inputActivityCount = Math.max(Number(summary.inputActivityCount || 0), Number(snapshot.inputActivityCount || 0));
  summary.outputBytes = Math.max(Number(summary.outputBytes || 0), Number(snapshot.outputBytes || 0));
  summary.activeWorkMs = Math.max(Number(summary.activeWorkMs || 0), Number(snapshot.activeWorkMs || 0));
  summary.lastActivityAt = snapshot.lastActivityAt || summary.lastActivityAt || '';
  summary.lastSeenAt = nowIso;
  mergeCounters(summary.activityCounters, snapshot.activityCounters);
  mergeCounters(summary.issueCounters, snapshot.issueCounters);

  if (!session.closed && status === 'Active') {
    day.activeSessions[session.terminalId] = snapshot;
  }

  if (mark) {
    markUsageDirty(true);
  }

  return snapshot;
}

function ensureDailySessionRegistered(session, { mark = true } = {}) {
  if (!session?.terminalId || !state.settings) {
    return false;
  }

  const report = ensureSessionReport(session);
  const today = todayReportDateKey();

  report.summaryId = report.summaryId || randomId('session-summary');
  report.connectedAt = report.connectedAt || Date.now();
  report.lastUsageCheckpointAt = report.lastUsageCheckpointAt || Date.now();

  if (report.registeredDate === today) {
    syncActiveSessionUsage(session, 'Active', { mark: false });
    return false;
  }

  const day = getTodayUsageDay();

  report.registeredDate = today;
  day.sessionsOpened += 1;

  if (session.server?.type === 'remote') {
    day.sshConnections += 1;
  } else {
    day.localSessions += 1;
  }

  const summary = getConnectionSummary(day, session);
  summary.sessionsOpened += 1;
  syncActiveSessionUsage(session, 'Active', { mark: false });

  if (mark) {
    markUsageDirty(true);
  }

  return true;
}

function syncOpenTerminalUsage({ persist = false } = {}) {
  checkpointDailyUsage({ persist: false });

  state.terminals.forEach((session) => {
    if (!session || session.closed) {
      return;
    }

    ensureDailySessionRegistered(session, { mark: false });
    syncActiveSessionUsage(session, 'Active', { mark: false });
  });

  if (persist) {
    markUsageDirty(true);
  }
}

function recordDailySessionStarted(session) {
  ensureDailySessionRegistered(session, { mark: true });
}

function recordDailyReconnect(session) {
  ensureDailySessionRegistered(session, { mark: false });
  const day = getTodayUsageDay();
  day.reconnectCount += 1;
  getConnectionSummary(day, session).reconnectCount += 1;
  syncActiveSessionUsage(session, 'Active', { mark: false });
  markUsageDirty(true);
}

function recordDailyDisconnect(session) {
  ensureDailySessionRegistered(session, { mark: false });
  const day = getTodayUsageDay();
  day.disconnectCount += 1;
  getConnectionSummary(day, session).disconnectCount += 1;
  syncActiveSessionUsage(session, 'Active', { mark: false });
  markUsageDirty(true);
}

function moveActiveSessionToHistory(session, status = 'Closed') {
  checkpointDailyUsage({ persist: false });
  ensureDailySessionRegistered(session, { mark: false });
  syncActiveSessionUsage(session, status, { mark: false });

  const day = getTodayUsageDay();
  const summary = summarizeSessionForUsage(session, status);
  day.sessionHistory = Array.isArray(day.sessionHistory) ? day.sessionHistory : [];
  day.sessionHistory.push(summary);
  day.sessionHistory = day.sessionHistory.slice(-300);

  if (session?.terminalId) {
    delete day.activeSessions[session.terminalId];
  }

  markUsageDirty(true);
}

function recordActivityAnalysis(session, value, source = 'typed') {
  const report = ensureSessionReport(session);

  if (!report) {
    return;
  }

  const categories = classifyTerminalActivity(value);
  const day = getTodayUsageDay();
  const summary = getConnectionSummary(day, session);

  const countsAsCommand = source === 'typed' || source === 'shortcut';
  report.commandCount = Number(report.commandCount || 0) + (countsAsCommand ? 1 : 0);
  report.lastActivityAt = Date.now();
  creditSessionActiveWork(session, report.lastActivityAt, { forceMinimum: false });
  report.activityCounters = report.activityCounters || {};
  categories.forEach((category) => {
    incrementCounter(report.activityCounters, category);
    incrementCounter(day.activityCounters, category);
    incrementCounter(summary.activityCounters, category);
  });

  if (countsAsCommand) {
    day.commandCount += 1;
    summary.commandCount += 1;
  }

  syncActiveSessionUsage(session, 'Active', { mark: false });
  markUsageDirty(true);
}

function recordIssueAnalysis(session, value) {
  const issues = classifyIssueText(value);

  if (!issues.length) {
    return;
  }

  const report = ensureSessionReport(session);
  const day = getTodayUsageDay();
  const summary = getConnectionSummary(day, session);

  report.issueCounters = report.issueCounters || {};
  issues.forEach((issue) => {
    incrementCounter(report.issueCounters, issue);
    incrementCounter(day.issueCounters, issue);
    incrementCounter(summary.issueCounters, issue);
    maybeNotifyIssueAssistant(session, issue);
  });

  syncActiveSessionUsage(session, 'Active', { mark: false });
  markUsageDirty(true);
}

function ensureSessionReport(session) {
  if (!session) {
    return null;
  }

  if (!session.report) {
    session.report = {
      startedAt: Date.now(),
      startedLabel: reportTimestamp(),
      inputChunks: [],
      outputChunks: [],
      commands: [],
      events: [],
      currentInput: '',
      outputBytes: 0,
      activeWorkMs: 0,
      lastActiveWorkCheckpointAt: null,
      lastOutputChunk: '',
      commandCount: 0,
      inputActivityCount: 0,
      activityCounters: {},
      issueCounters: {},
      lastActivityAt: null,
      connectedAt: null,
      lastUsageCheckpointAt: null,
      registeredDate: null,
      summaryId: randomId('session-summary'),
      activeJobId: null,
      activeJobStartedAt: null,
      activeJobIssueBaseline: null
    };
  }

  session.report.activityCounters = session.report.activityCounters || {};
  session.report.issueCounters = session.report.issueCounters || {};
  session.report.commandCount = Number(session.report.commandCount || session.report.commands?.length || 0);
  session.report.inputActivityCount = Number(session.report.inputActivityCount || 0);
  session.report.outputBytes = Number(session.report.outputBytes || 0);
  session.report.activeWorkMs = Number(session.report.activeWorkMs || 0);
  session.report.lastActiveWorkCheckpointAt = session.report.lastActiveWorkCheckpointAt || null;
  session.report.connectedAt = session.report.connectedAt || null;
  session.report.lastUsageCheckpointAt = session.report.lastUsageCheckpointAt || null;
  session.report.registeredDate = session.report.registeredDate || null;
  session.report.summaryId = session.report.summaryId || randomId('session-summary');
  session.report.activeJobId = session.report.activeJobId || null;
  session.report.activeJobStartedAt = session.report.activeJobStartedAt || null;
  session.report.activeJobIssueBaseline = session.report.activeJobIssueBaseline || null;

  return session.report;
}


function findPersistedReportJob(jobId) {
  if (!jobId || !state.settings?.reportUsage?.days) {
    return null;
  }

  for (const day of Object.values(state.settings.reportUsage.days)) {
    const job = Array.isArray(day?.jobs)
      ? day.jobs.find((item) => item?.id === jobId)
      : null;

    if (job) {
      return { day, job };
    }
  }

  return null;
}

function startReportJob(session, command, source = 'typed') {
  const report = ensureSessionReport(session);
  const safeCommand = sanitizeReportJobCommand(command);
  const now = Date.now();

  if (!report || !safeCommand || !state.settings) {
    return null;
  }

  if (report.activeJobId) {
    finishActiveReportJob(session, 'unknown', {
      note: 'Another command was submitted before the previous command returned to a prompt.'
    });
  }

  const categories = classifyTerminalActivity(safeCommand);
  const server = session.server || {};
  const job = normalizeReportJob({
    id: randomId('report-job'),
    terminalId: session.terminalId,
    connectionId: server.id || '',
    connectionName: server.name || session.terminalId || 'Terminal',
    type: server.type === 'remote' ? 'remote' : 'local',
    host: server.type === 'remote' ? server.host || '' : '',
    username: server.type === 'remote' ? server.username || '' : '',
    workingDirectory: session.currentLocation || server.workingDirectory || '',
    startedAt: new Date(now).toISOString(),
    endedAt: '',
    durationMs: 0,
    status: 'running',
    workType: inferReportJobType(safeCommand, categories),
    commandLabel: safeCommand,
    source,
    issueCount: 0,
    issueCategories: []
  });

  const day = getTodayUsageDay();
  day.jobs = Array.isArray(day.jobs) ? day.jobs : [];
  day.jobs.push(job);
  day.jobs = day.jobs.slice(-REPORT_JOB_MAX_PER_DAY);

  report.activeJobId = job.id;
  report.activeJobStartedAt = now;
  report.activeJobIssueBaseline = { ...(report.issueCounters || {}) };
  markUsageDirty(true);

  return job;
}

function finishActiveReportJob(session, requestedStatus = 'completed', { note = '' } = {}) {
  const report = ensureSessionReport(session);

  if (!report?.activeJobId) {
    return null;
  }

  const located = findPersistedReportJob(report.activeJobId);
  const now = Date.now();

  if (!located) {
    report.activeJobId = null;
    report.activeJobStartedAt = null;
    report.activeJobIssueBaseline = null;
    return null;
  }

  const { job } = located;
  const baseline = report.activeJobIssueBaseline || {};
  const currentIssues = report.issueCounters || {};
  const issueCategories = Object.keys(currentIssues)
    .filter((key) => Number(currentIssues[key] || 0) > Number(baseline[key] || 0))
    .slice(0, 12);
  const issueCount = issueCategories.reduce(
    (sum, key) => sum + Math.max(0, Number(currentIssues[key] || 0) - Number(baseline[key] || 0)),
    0
  );

  let status = String(requestedStatus || 'completed');

  if (status === 'completed' && issueCount > 0) {
    status = 'completed_with_issues';
  }

  job.endedAt = new Date(now).toISOString();
  job.durationMs = Math.max(0, now - new Date(job.startedAt || now).getTime());
  job.status = status;
  job.issueCount = Math.round(issueCount);
  job.issueCategories = issueCategories;
  job.note = String(note || '').slice(0, 240);

  report.activeJobId = null;
  report.activeJobStartedAt = null;
  report.activeJobIssueBaseline = null;
  markUsageDirty(true);

  return job;
}

function markStaleReportJobsInterrupted() {
  if (!state.settings?.reportUsage?.days) {
    return;
  }

  const now = new Date().toISOString();

  Object.values(state.settings.reportUsage.days).forEach((day) => {
    day.jobs = Array.isArray(day.jobs) ? day.jobs : [];

    day.jobs.forEach((job) => {
      if (String(job?.status || '').toLowerCase() !== 'running') {
        return;
      }

      job.status = 'interrupted';
      job.endedAt = job.endedAt || job.startedAt || now;
      job.durationMs = Math.max(
        0,
        new Date(job.endedAt).getTime() - new Date(job.startedAt || job.endedAt).getTime()
      );
      job.note = job.note || 'The app closed before the command returned to a prompt.';
    });
  });
}

function creditSessionActiveWork(session, now = Date.now(), { forceMinimum = false } = {}) {
  const report = ensureSessionReport(session);

  if (!report) {
    return 0;
  }

  const startedAt = Number(report.connectedAt || report.startedAt || now);
  const lastCheckpoint = Number(report.lastActiveWorkCheckpointAt || report.lastUsageCheckpointAt || startedAt || now);
  const maxDuration = Math.max(0, now - startedAt);
  let credited = Math.max(0, Math.min(now - lastCheckpoint, 5 * 60 * 1000, maxDuration));

  if (!credited && forceMinimum && maxDuration > 0) {
    credited = Math.min(1000, maxDuration);
  }

  if (credited > 0) {
    report.activeWorkMs = Math.max(0, Number(report.activeWorkMs || 0) + credited);
  }

  report.lastActiveWorkCheckpointAt = now;

  return credited;
}

function appendLimitedChunk(list, value, maxItems = 900) {
  const cleaned = redactSecrets(String(value || ''));

  if (!cleaned) {
    return;
  }

  list.push(cleaned);

  while (list.length > maxItems) {
    list.shift();
  }
}

function recordSessionEvent(session, message, level = 'info') {
  const report = ensureSessionReport(session);

  if (!report) {
    return;
  }

  report.events.push({
    time: reportTimestamp(),
    level,
    message: redactSecrets(message)
  });

  while (report.events.length > 500) {
    report.events.shift();
  }

  if (!session.closed) {
    syncActiveSessionUsage(session, 'Active', { mark: false });
  }
}

function commitReportCommand(session, value, source = 'typed') {
  const report = ensureSessionReport(session);
  const command = sanitizeReportJobCommand(String(value || '').trim());

  if (!report || !command) {
    return;
  }

  report.commands.push({
    time: reportTimestamp(),
    source,
    command
  });

  while (report.commands.length > 300) {
    report.commands.shift();
  }

  recordActivityAnalysis(session, command, source);

  if (source === 'typed' || source === 'shortcut') {
    startReportJob(session, command, source);
  }
}

function recordTerminalInput(session, data) {
  const report = ensureSessionReport(session);

  if (!report) {
    return;
  }

  ensureDailySessionRegistered(session, { mark: false });

  const text = String(data || '');
  appendLimitedChunk(report.inputChunks, text, 1200);
  report.inputActivityCount += text.length;
  report.lastActivityAt = Date.now();
  creditSessionActiveWork(session, report.lastActivityAt, { forceMinimum: true });

  const day = getTodayUsageDay();
  day.inputActivityCount += text.length;
  syncActiveSessionUsage(session, 'Active', { mark: false });
  markUsageDirty(true);

  for (const char of text) {
    if (char === '\r' || char === '\n') {
      const submittedInput = report.currentInput.trim();
      commitReportCommand(session, report.currentInput, 'typed');
      report.currentInput = '';

      if (submittedInput) {
        setTerminalProcessBusy(session, true, 'Terminal command is running');
      }

      continue;
    }

    if (char === '\u007f' || char === '\b') {
      report.currentInput = report.currentInput.slice(0, -1);
      continue;
    }

    if (char === '\u0003') {
      recordSessionEvent(session, 'Ctrl+C sent.', 'action');
      recordActivityAnalysis(session, 'Ctrl+C', 'action');
      finishActiveReportJob(session, 'cancelled', { note: 'Cancelled with Ctrl+C.' });
      continue;
    }

    if (char === '\u0004') {
      recordSessionEvent(session, 'Ctrl+D sent.', 'action');
      recordActivityAnalysis(session, 'Ctrl+D', 'action');
      continue;
    }

    if (char >= ' ' && char !== '\u001b') {
      report.currentInput += char;
    }
  }

  if (report.currentInput.length > 5000) {
    report.currentInput = report.currentInput.slice(-5000);
  }

  syncActiveSessionUsage(session, 'Active', { mark: false });
}

function recordTerminalOutput(session, data) {
  const report = ensureSessionReport(session);

  if (!report) {
    return;
  }

  ensureDailySessionRegistered(session, { mark: false });

  let cleaned = stripTerminalControlText(data);

  if (!cleaned) {
    return;
  }

  if (!cleaned.trim() && cleaned.length > 120) {
    cleaned = '\n';
  }

  if (cleaned === report.lastOutputChunk) {
    return;
  }

  report.lastOutputChunk = cleaned;
  report.outputBytes += reportByteLength(cleaned);
  getTodayUsageDay().outputBytes += reportByteLength(cleaned);
  appendLimitedChunk(report.outputChunks, cleaned, 1600);
  recordIssueAnalysis(session, cleaned);

  if (terminalOutputLooksReady(cleaned)) {
    finishActiveReportJob(session, 'completed');
  }

  syncActiveSessionUsage(session, 'Active', { mark: false });
  markUsageDirty(true);
}


function maybeNotifyIssueAssistant(session, issue) {
  if (!session || !issue) {
    return;
  }

  if (getActivityFeedTerminalOutputMode() !== 'errors') {
    return;
  }

  if (session.cleanSshStartupActive === true) {
    return;
  }

  session.issueAssistantNotified = session.issueAssistantNotified || {};
  const key = String(issue);
  const now = Date.now();
  const previous = Number(session.issueAssistantNotified[key] || 0);

  if (now - previous < 60000) {
    return;
  }

  session.issueAssistantNotified[key] = now;
  appendLiveConsole(`Error Assistant: ${issue}. ${getIssueAssistantAdvice(issue)}`, 'warning');
}


function getReportScope() {
  const select = $('#report-scope-select');
  const value = select?.value || state.currentReportScope || 'all';
  const allowed = new Set(['all', 'active', 'ssh', 'local']);

  return allowed.has(value) ? value : 'all';
}


function toReportDateTimeLocalValue(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (part) => String(part).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ensureReportCustomRangeValues(filter = state.currentReportDateFilter) {
  const fromInput = $('#report-range-from');
  const toInput = $('#report-range-to');

  if (!fromInput || !toInput) {
    return;
  }

  const parsed = normalizeReportCustomRangeFilter(filter);

  if (parsed) {
    fromInput.value = toReportDateTimeLocalValue(parsed.startMs);
    toInput.value = toReportDateTimeLocalValue(parsed.endMs);
    return;
  }

  if (!fromInput.value || !toInput.value) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    fromInput.value = toReportDateTimeLocalValue(start);
    toInput.value = toReportDateTimeLocalValue(end);
  }
}

function syncReportCustomRangeControls() {
  const select = $('#report-date-filter-select');
  const range = $('#report-custom-range');
  const custom = select?.value === 'custom';

  range?.classList.toggle('hidden', !custom);

  if (custom) {
    ensureReportCustomRangeValues(state.currentReportDateFilter);
  }
}

function getReportCustomRangeFilter({ showError = false } = {}) {
  const fromValue = $('#report-range-from')?.value || '';
  const toValue = $('#report-range-to')?.value || '';
  const startMs = new Date(fromValue).getTime();
  const endMs = new Date(toValue).getTime();

  if (!fromValue || !toValue || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    if (showError) {
      showToast('Choose valid From and To date/time values.', 5000, 'warning');
    }
    return null;
  }

  if (endMs < startMs) {
    if (showError) {
      showToast('The report To date/time must be after the From date/time.', 5000, 'warning');
    }
    return null;
  }

  const maxRangeMs = REPORT_CUSTOM_RANGE_MAX_DAYS * 24 * 60 * 60 * 1000;

  if (endMs - startMs > maxRangeMs) {
    if (showError) {
      showToast(`Custom reports are limited to ${REPORT_CUSTOM_RANGE_MAX_DAYS} days to keep the app responsive.`, 6500, 'warning');
    }
    return null;
  }

  return `range-ms:${Math.round(startMs)}:${Math.round(endMs)}`;
}

function getReportDateFilter() {
  const select = $('#report-date-filter-select');
  const selected = select?.value || 'today';
  const allowed = new Set(['today', 'yesterday', 'last7', 'last30']);

  if (selected === 'custom') {
    return getReportCustomRangeFilter()
      || (normalizeReportCustomRangeFilter(state.currentReportDateFilter) ? state.currentReportDateFilter : 'today');
  }

  return allowed.has(selected) ? selected : 'today';
}


function getReportDaysForDateFilter(filter = getReportDateFilter()) {
  if (!state.settings) {
    return [createEmptyReportDay(reportDateKeyFromOffset(0))];
  }

  state.settings.reportUsage = normalizeReportUsageClient(state.settings.reportUsage);
  const days = state.settings.reportUsage.days || {};

  return getReportDateKeysForFilter(filter).map((key) => days[key] || createEmptyReportDay(key));
}


function getSessionSummariesForScope(scope, days = getReportDaysForDateFilter(), dateFilter = getReportDateFilter()) {
  const includeToday = reportDaysIncludeToday(days);
  const byId = new Map();

  days.forEach((day) => {
    const persisted = [
      ...(Array.isArray(day.sessionHistory) ? day.sessionHistory : []),
      ...Object.values(day.activeSessions || {})
    ];

    persisted.forEach((summary) => {
      if (!summary) {
        return;
      }

      const reportDate = String(day.date || todayReportDateKey());
      const key = `${reportDate}-${summary.id || summary.terminalId || randomId('summary')}`;

      byId.set(key, {
        ...summary,
        reportDate
      });
    });
  });

  if (includeToday) {
    Array.from(state.terminals.values()).forEach((session) => {
      const summary = summarizeSessionForUsage(session, session.closed ? 'Closed' : 'Active');

      if (!summary) {
        return;
      }

      const reportDate = todayReportDateKey();
      const key = `${reportDate}-${summary.id || summary.terminalId || randomId('summary')}`;

      byId.set(key, {
        ...summary,
        reportDate
      });
    });
  }

  const range = getReportDateRangeBounds(dateFilter);

  return Array.from(byId.values())
    .filter((summary) => {
      if (scope === 'active' && (!summary.terminalId || summary.terminalId !== state.activeTerminalId)) {
        return false;
      }

      if (scope !== 'active' && !sessionMatchesReportScope(summary, scope)) {
        return false;
      }

      const startedMs = new Date(summary.startedAt || '').getTime();
      const endedMs = new Date(summary.endedAt || summary.lastSeenAt || '').getTime();

      if (!Number.isFinite(startedMs)) {
        return getReportDateKeysForFilter(dateFilter).includes(String(summary.reportDate || ''));
      }

      const safeEndMs = Number.isFinite(endedMs)
        ? endedMs
        : (String(summary.status || '').toLowerCase() === 'active' ? Date.now() : startedMs);

      return startedMs <= range.endMs && safeEndMs >= range.startMs;
    })
    .map((summary) => {
      const startedMs = new Date(summary.startedAt || '').getTime();
      const endedMs = new Date(summary.endedAt || summary.lastSeenAt || '').getTime();

      if (!Number.isFinite(startedMs)) {
        return summary;
      }

      const safeEndMs = Number.isFinite(endedMs)
        ? endedMs
        : (String(summary.status || '').toLowerCase() === 'active' ? Date.now() : startedMs);
      const originalDurationMs = Math.max(0, Number(summary.durationMs || (safeEndMs - startedMs) || 0));
      const clippedStartMs = Math.max(startedMs, range.startMs);
      const clippedEndMs = Math.min(safeEndMs, range.endMs);
      const clippedDurationMs = Math.max(0, clippedEndMs - clippedStartMs);
      const ratio = originalDurationMs > 0 ? Math.min(1, clippedDurationMs / originalDurationMs) : 1;

      return {
        ...summary,
        durationMs: clippedDurationMs,
        activeWorkMs: Math.min(
          clippedDurationMs,
          Math.round(Math.max(0, Number(summary.activeWorkMs || 0)) * ratio)
        ),
        idleMs: Math.max(
          0,
          clippedDurationMs - Math.round(Math.max(0, Number(summary.activeWorkMs || 0)) * ratio)
        ),
        rangeEstimated: clippedDurationMs !== originalDurationMs
      };
    })
    .sort((a, b) => {
      const dateCompare = String(a.reportDate || '').localeCompare(String(b.reportDate || ''));

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return String(a.startedAt || '').localeCompare(String(b.startedAt || ''));
    });
}

function getReportJobsForScope(scope, dateFilter, days = getReportDaysForDateFilter(dateFilter)) {
  const byId = new Map();

  days.forEach((day) => {
    (Array.isArray(day?.jobs) ? day.jobs : []).forEach((job) => {
      if (!job?.id) {
        return;
      }

      byId.set(job.id, normalizeReportJob(job));
    });
  });

  return Array.from(byId.values())
    .filter((job) => jobMatchesReportScope(job, scope, state.activeTerminalId))
    .filter((job) => reportJobOverlapsRange(job, dateFilter))
    .sort((a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')));
}

function getReportJobDurationInRange(job, dateFilter) {
  const range = getReportDateRangeBounds(dateFilter);
  const startedMs = new Date(job?.startedAt || '').getTime();
  const endedMs = new Date(job?.endedAt || '').getTime();
  const safeStartMs = Number.isFinite(startedMs) ? startedMs : range.startMs;
  const safeEndMs = Number.isFinite(endedMs)
    ? endedMs
    : (String(job?.status || '').toLowerCase() === 'running' ? Date.now() : safeStartMs);

  return Math.max(0, Math.min(safeEndMs, range.endMs) - Math.max(safeStartMs, range.startMs));
}


function aggregateScopedReport(scope, dateFilter = getReportDateFilter()) {
  syncOpenTerminalUsage({ persist: false });

  const days = getReportDaysForDateFilter(dateFilter);
  const summaries = getSessionSummariesForScope(scope, days, dateFilter);
  const jobs = getReportJobsForScope(scope, dateFilter, days);
  const preciseRange = Boolean(normalizeReportCustomRangeFilter(dateFilter));
  const aggregate = {
    dateFilter,
    dateLabel: getReportDateRangeLabel(dateFilter),
    appUptimeMs: 0,
    terminalUptimeMs: 0,
    sshUptimeMs: 0,
    localTerminalUptimeMs: 0,
    activeWorkMs: 0,
    idleMs: 0,
    sessionsOpened: summaries.length,
    reconnectCount: 0,
    disconnectCount: 0,
    commandCount: 0,
    inputActivityCount: 0,
    outputBytes: 0,
    activityCounters: {},
    issueCounters: {},
    connectionSummaries: {},
    jobs,
    jobCount: jobs.length,
    completedJobCount: 0,
    failedJobCount: 0,
    cancelledJobCount: 0,
    runningJobCount: 0,
    realJobDurationMs: 0
  };

  summaries.forEach((summary) => {
    const summaryDurationMs = Number(summary.durationMs || 0);
    const summaryActiveWorkMs = Math.min(summaryDurationMs, Number(summary.activeWorkMs || 0));

    aggregate.terminalUptimeMs += summaryDurationMs;
    aggregate.activeWorkMs += summaryActiveWorkMs;
    aggregate.idleMs += Math.max(0, Number(summary.idleMs || (summaryDurationMs - summaryActiveWorkMs) || 0));

    if (summary.type === 'remote') {
      aggregate.sshUptimeMs += Number(summary.durationMs || 0);
    } else {
      aggregate.localTerminalUptimeMs += Number(summary.durationMs || 0);
    }

    aggregate.commandCount += Number(summary.commandCount || 0);
    aggregate.inputActivityCount += Number(summary.inputActivityCount || 0);
    aggregate.outputBytes += Number(summary.outputBytes || 0);
    mergeCounters(aggregate.activityCounters, summary.activityCounters);
    mergeCounters(aggregate.issueCounters, summary.issueCounters);
  });

  jobs.forEach((job) => {
    const status = String(job.status || '').toLowerCase();
    aggregate.realJobDurationMs += getReportJobDurationInRange(job, dateFilter);

    if (status === 'completed' || status === 'completed_with_issues') {
      aggregate.completedJobCount += 1;
    } else if (status === 'failed' || status === 'interrupted') {
      aggregate.failedJobCount += 1;
    } else if (status === 'cancelled') {
      aggregate.cancelledJobCount += 1;
    } else if (status === 'running') {
      aggregate.runningJobCount += 1;
    }
  });

  if (aggregate.activeWorkMs <= 0 && aggregate.commandCount > 0 && aggregate.terminalUptimeMs > 0) {
    aggregate.activeWorkMs = Math.min(
      aggregate.terminalUptimeMs,
      Math.max(1000, Math.min(aggregate.terminalUptimeMs, aggregate.commandCount * 30000))
    );
  }

  const matchedConnectionNames = new Set(summaries.map((summary) => String(summary.name || 'Terminal')));

  days.forEach((day) => {
    if (!preciseRange) {
      aggregate.appUptimeMs += Number(day.appUptimeMs || 0);
    }

    if (scope === 'all') {
      aggregate.sessionsOpened += 0;
      aggregate.reconnectCount += Number(day.reconnectCount || 0);
      aggregate.disconnectCount += Number(day.disconnectCount || 0);

      if (!Object.keys(aggregate.activityCounters).length) {
        mergeCounters(aggregate.activityCounters, day.activityCounters);
      }

      if (!Object.keys(aggregate.issueCounters).length) {
        mergeCounters(aggregate.issueCounters, day.issueCounters);
      }
    }

    Object.values(day.connectionSummaries || {}).forEach((item) => {
      const typeMatches = scope === 'all'
        || (scope === 'ssh' && item.type === 'remote')
        || (scope === 'local' && item.type !== 'remote')
        || (scope === 'active' && matchedConnectionNames.has(String(item.name || 'Terminal')));

      if (!typeMatches) {
        return;
      }

      const key = `${item.type === 'remote' ? 'ssh' : 'local'}:${String(item.name || 'Terminal')}`;

      if (!aggregate.connectionSummaries[key]) {
        aggregate.connectionSummaries[key] = emptyConnectionReportItem(item);
      }

      mergeConnectionReportItem(aggregate.connectionSummaries[key], item);

      if (scope !== 'all') {
        aggregate.reconnectCount += Number(item.reconnectCount || 0);
        aggregate.disconnectCount += Number(item.disconnectCount || 0);
      }
    });

    if (scope === 'all' && !preciseRange) {
      aggregate.sessionsOpened = Math.max(aggregate.sessionsOpened, Number(day.sessionsOpened || 0));
      aggregate.terminalUptimeMs = Math.max(aggregate.terminalUptimeMs, Number(day.terminalUptimeMs || 0));
      aggregate.sshUptimeMs = Math.max(aggregate.sshUptimeMs, Number(day.sshUptimeMs || 0));
      aggregate.localTerminalUptimeMs = Math.max(aggregate.localTerminalUptimeMs, Number(day.localTerminalUptimeMs || 0));
      aggregate.activeWorkMs = Math.max(aggregate.activeWorkMs, Number(day.activeWorkMs || 0));
      aggregate.idleMs = Math.max(aggregate.idleMs, Math.max(0, Number(day.terminalUptimeMs || 0) - Number(day.activeWorkMs || 0)));
      aggregate.commandCount = Math.max(aggregate.commandCount, Number(day.commandCount || 0));
      aggregate.inputActivityCount = Math.max(aggregate.inputActivityCount, Number(day.inputActivityCount || 0));
      aggregate.outputBytes = Math.max(aggregate.outputBytes, Number(day.outputBytes || 0));
    }
  });

  if (scope === 'all' && days.length > 1 && !preciseRange) {
    aggregate.sessionsOpened = Math.max(
      summaries.length,
      days.reduce((sum, day) => sum + Number(day.sessionsOpened || 0), 0)
    );
    aggregate.terminalUptimeMs = Math.max(
      aggregate.terminalUptimeMs,
      days.reduce((sum, day) => sum + Number(day.terminalUptimeMs || 0), 0)
    );
    aggregate.sshUptimeMs = Math.max(
      aggregate.sshUptimeMs,
      days.reduce((sum, day) => sum + Number(day.sshUptimeMs || 0), 0)
    );
    aggregate.localTerminalUptimeMs = Math.max(
      aggregate.localTerminalUptimeMs,
      days.reduce((sum, day) => sum + Number(day.localTerminalUptimeMs || 0), 0)
    );
    aggregate.activeWorkMs = Math.max(
      aggregate.activeWorkMs,
      days.reduce((sum, day) => sum + Number(day.activeWorkMs || 0), 0)
    );
    aggregate.idleMs = Math.max(
      aggregate.idleMs,
      Math.max(0, aggregate.terminalUptimeMs - aggregate.activeWorkMs)
    );
    aggregate.commandCount = Math.max(
      aggregate.commandCount,
      days.reduce((sum, day) => sum + Number(day.commandCount || 0), 0)
    );
    aggregate.inputActivityCount = Math.max(
      aggregate.inputActivityCount,
      days.reduce((sum, day) => sum + Number(day.inputActivityCount || 0), 0)
    );
    aggregate.outputBytes = Math.max(
      aggregate.outputBytes,
      days.reduce((sum, day) => sum + Number(day.outputBytes || 0), 0)
    );
  }

  aggregate.terminalUptimeMs = Math.max(aggregate.terminalUptimeMs, aggregate.realJobDurationMs);

  if (preciseRange) {
    aggregate.appUptimeMs = aggregate.terminalUptimeMs;
  }

  aggregate.activeWorkMs = Math.max(aggregate.activeWorkMs, aggregate.realJobDurationMs);
  aggregate.activeWorkMs = Math.min(aggregate.terminalUptimeMs, Math.max(0, aggregate.activeWorkMs));
  aggregate.idleMs = Math.max(0, aggregate.terminalUptimeMs - aggregate.activeWorkMs);

  return { days, summaries, jobs, aggregate };
}


function buildScopedReport(scope = getReportScope(), dateFilter = getReportDateFilter()) {
  const { summaries, aggregate } = aggregateScopedReport(scope, dateFilter);
  const scopeLabel = getReportScopeLabel(scope);
  const dateLabel = getReportDateRangeLabel(dateFilter);
  const options = getReportOptions();
  const issueCount = Object.values(aggregate.issueCounters || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const activityCount = Object.values(aggregate.activityCounters || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const suggestions = buildReportSuggestions(aggregate.issueCounters, aggregate.activityCounters);
  const smartSummaryRows = buildSmartReportSummary(aggregate, summaries);
  const jobRows = (aggregate.jobs || [])
    .slice()
    .sort((a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')))
    .slice(-100)
    .map((job) => {
      const started = new Date(job.startedAt || '');
      const ended = new Date(job.endedAt || '');
      const startedLabel = Number.isNaN(started.getTime())
        ? 'Unknown time'
        : started.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const endedLabel = Number.isNaN(ended.getTime())
        ? (String(job.status || '').toLowerCase() === 'running' ? 'Running' : 'Unknown')
        : ended.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const durationMs = getReportJobDurationInRange(job, dateFilter);
      const location = String(job.workingDirectory || '').trim() || 'Location unavailable';
      const connection = String(job.connectionName || 'Terminal');
      const type = job.type === 'remote' ? 'SSH' : 'Local';
      const issues = Number(job.issueCount || 0) > 0
        ? `; issues ${Number(job.issueCount || 0)}${job.issueCategories?.length ? ` (${job.issueCategories.join(', ')})` : ''}`
        : '';
      const note = job.note ? `; note ${job.note}` : '';

      return [
        `- ${startedLabel}–${endedLabel} | ${connection} (${type}) | ${job.workType || 'Development'} | ${getReportJobStatusLabel(job.status)}`,
        `  Folder: ${location}`,
        `  Work: ${job.commandLabel || 'Command details unavailable'} | elapsed ${formatHumanDuration(durationMs)}${issues}${note}`
      ].join('\n');
    });
  const idleMs = Math.max(0, Number(aggregate.idleMs || (aggregate.terminalUptimeMs - aggregate.activeWorkMs) || 0));
  const activeWorkPercent = aggregate.terminalUptimeMs > 0
    ? Math.round((Math.min(aggregate.terminalUptimeMs, aggregate.activeWorkMs) / aggregate.terminalUptimeMs) * 100)
    : 0;
  const idlePercent = aggregate.terminalUptimeMs > 0
    ? Math.max(0, 100 - activeWorkPercent)
    : 0;
  const connectionRows = Object.values(aggregate.connectionSummaries || {})
    .sort((a, b) => Number(b.uptimeMs || 0) - Number(a.uptimeMs || 0))
    .slice(0, 20)
    .map((item) => {
      const itemUptimeMs = Number(item.uptimeMs || 0);
      const itemActiveWorkMs = Math.min(itemUptimeMs, Number(item.activeWorkMs || 0));
      const itemIdleMs = Math.max(0, itemUptimeMs - itemActiveWorkMs);

      return `- ${item.name} (${item.type === 'remote' ? 'SSH' : 'Local'}): uptime ${formatHumanDuration(itemUptimeMs)}, active work ${formatHumanDuration(itemActiveWorkMs)}, idle ${formatHumanDuration(itemIdleMs)}, sessions ${item.sessionsOpened || 0}, commands analyzed ${item.commandCount || 0}, reconnects ${item.reconnectCount || 0}, disconnects ${item.disconnectCount || 0}`;
    });

  const summaryRows = [
    `- Report Date: ${dateLabel}`,
    `- Scope: ${scopeLabel}`,
    `- Sessions matched: ${summaries.length}`,
    `- Sessions opened in range: ${aggregate.sessionsOpened}`,
    `- Real jobs recorded: ${aggregate.jobCount}`,
    `- Job outcomes: ${aggregate.completedJobCount} finished, ${aggregate.failedJobCount} failed/interrupted, ${aggregate.cancelledJobCount} cancelled, ${aggregate.runningJobCount} running`,
    `- Reconnects: ${aggregate.reconnectCount}`,
    `- Disconnects: ${aggregate.disconnectCount}`
  ];

  const timeRows = [
    `- App uptime in range: ${formatHumanDuration(aggregate.appUptimeMs)} (${formatReportDuration(aggregate.appUptimeMs)})`,
    `- Total terminal uptime: ${formatHumanDuration(aggregate.terminalUptimeMs)} (${formatReportDuration(aggregate.terminalUptimeMs)})`,
    `- Measured working time: ${formatHumanDuration(aggregate.activeWorkMs)} (${activeWorkPercent}% of terminal uptime)`,
    `- Idle time: ${formatHumanDuration(idleMs)} (${idlePercent}% of terminal uptime)`,
    `- SSH uptime: ${formatHumanDuration(aggregate.sshUptimeMs)} (${formatReportDuration(aggregate.sshUptimeMs)})`,
    `- Local terminal uptime: ${formatHumanDuration(aggregate.localTerminalUptimeMs)} (${formatReportDuration(aggregate.localTerminalUptimeMs)})`
  ];

  const commandRows = [
    `- Terminal commands analyzed: ${aggregate.commandCount}`,
    `- Terminal input activity observed: ${Math.round(aggregate.inputActivityCount)} characters`,
    `- Output volume observed: ${formatReportSize(aggregate.outputBytes)}`,
    '- Real Job rows include only redacted, shortened command summaries. Raw terminal output and secrets are excluded.'
  ];

  const sections = ['# Advance Terminal Work Activity Report', ''];

  if (options.showSummary) {
    sections.push('## Work Summary', ...summaryRows, '');
  }

  if (options.showTimeBreakdown) {
    sections.push('## Time Breakdown', ...timeRows, '');
  }

  if (options.showRealJobs) {
    sections.push(
      '## Real Job Timeline',
      '- Outcome note: Finished means the shell prompt returned. Exact command exit codes are not available unless the shell output reports them.',
      ...(jobRows.length
        ? jobRows
        : ['- No per-command job records exist in this range. New jobs are recorded after this update is installed.']),
      aggregate.jobs?.length > 100 ? `- Showing the latest 100 of ${aggregate.jobs.length} jobs.` : '',
      ''
    );
  }

  if (options.showCommandsAnalyzed) {
    sections.push('## Commands Analyzed', ...commandRows, '');
  }

  if (options.showActivityAnalysis) {
    sections.push(
      '## Smart Work Summary',
      ...smartSummaryRows,
      '',
      '## Work Summary / Activity Analysis',
      ...topCounterRows(aggregate.activityCounters, 'No classified terminal activity detected yet.'),
      ''
    );
  }

  if (options.showIssueSummary) {
    sections.push(
      '## Warning / Error Summary',
      ...topCounterRows(aggregate.issueCounters, 'No warning/error category detected yet.'),
      '',
      '## Error Assistant',
      ...buildErrorAssistantRows(aggregate.issueCounters),
      ''
    );
  }

  if (options.showConnectionBreakdown) {
    sections.push(
      '## Per-Connection Summary',
      ...(connectionRows.length ? connectionRows : ['- No connection summary available for this scope yet.']),
      ''
    );
  }

  if (options.showSuggestedNextActions) {
    sections.push('## Suggested Next Actions', ...suggestions.map((item, index) => `${index + 1}. ${item}`), '');
  }

  if (options.showMetadata) {
    const enabledSections = Object.entries(options)
      .filter(([, enabled]) => enabled !== false)
      .map(([key]) => key)
      .join(', ');

    sections.push(
      '## Report Metadata',
      `- Generated: ${reportTimestamp()}`,
      `- Report scope: ${scopeLabel}`,
      `- Report date filter: ${dateLabel}`,
      `- Enabled sections: ${enabledSections || 'None'}`,
      `- Real jobs counted: ${aggregate.jobCount}`,
      `- Analysis categories counted: ${Math.round(activityCount)}`,
      `- Warning/error categories counted: ${Math.round(issueCount)}`,
      ''
    );
  }

  return {
    text: sections.join('\n'),
    meta: {
      tabName: scopeLabel,
      duration: formatReportDuration(aggregate.terminalUptimeMs),
      commandCount: aggregate.commandCount,
      jobCount: aggregate.jobCount,
      completedJobCount: aggregate.completedJobCount,
      findingCount: Math.round(issueCount),
      activeWorkDuration: formatReportDuration(aggregate.activeWorkMs),
      activeWorkMs: aggregate.activeWorkMs,
      idleMs,
      scope,
      scopeLabel,
      dateFilter,
      dateLabel,
      summary: `${scopeLabel} • ${dateLabel} • ${aggregate.jobCount} real jobs • ${formatHumanDuration(aggregate.activeWorkMs)} measured work • ${aggregate.completedJobCount} finished • ${aggregate.failedJobCount} failed/interrupted • ${aggregate.commandCount} commands • ${Math.round(issueCount)} findings`
    }
  };
}

async function openSessionReportModal() {
  return withBusyAction('report', 'Generating...', async () => {
    try {
      const scope = getReportScope();
      const customRequested = $('#report-date-filter-select')?.value === 'custom';
      const customFilter = customRequested ? getReportCustomRangeFilter({ showError: true }) : null;

      if (customRequested && !customFilter) {
        return;
      }

      const dateFilter = customFilter || getReportDateFilter();

      if (scope === 'active' && !state.activeTerminalId) {
        showToast('Open or connect a terminal first before generating an Active Terminal report.', 5000, 'warning');
        setActiveView('terminal', 'terminal');
        return;
      }

      syncOpenTerminalUsage({ persist: false });
      const report = buildScopedReport(scope, dateFilter);
      state.currentReportText = report.text;
      state.currentReportSnapshot = createReportHistoryItem(report, scope, dateFilter);
      state.currentReportScope = scope;
      state.currentReportDateFilter = dateFilter;
      await saveCurrentReportToHistory({ silent: true });

      $('#session-report-title').textContent = 'Work Activity Report';
      $('#report-tab-name').textContent = report.meta.tabName;
      $('#report-duration').textContent = report.meta.activeWorkDuration || report.meta.duration;
      $('#report-job-count').textContent = String(report.meta.jobCount || 0);
      $('#report-command-count').textContent = String(report.meta.commandCount);
      $('#report-finding-count').textContent = String(report.meta.findingCount);
      $('#session-report-output').value = report.text;

      $('#session-report-modal').classList.remove('hidden');
      $('#session-report-output').focus();

      appendLiveConsole(`Generated ${report.meta.tabName} activity report.`, 'action');
      persistReportUsage().catch(() => {});
    } catch (error) {
      appendLiveConsole(`Report generation failed: ${error.message}`, 'error');
      showToast(`Report generation failed: ${error.message}`, 8000, 'error');
    }
  });
}

function closeSessionReportModal() {
  $('#session-report-modal').classList.add('hidden');
}

async function copySessionReport() {
  return withBusyAction('copyReport', 'Copying...', async () => {
    if (!state.currentReportText) {
      showToast('Generate a report first.');
      return;
    }

    try {
      await navigator.clipboard.writeText(state.currentReportText);
      showToast('Report copied.');
    } catch (error) {
      showToast(`Copy failed: ${error.message}`, 7000, 'error');
    }
  });
}


function createReportHistoryItem(report, scope = getReportScope(), dateFilter = getReportDateFilter()) {
  const generatedAt = new Date();
  const meta = report?.meta || {};
  const scopeLabel = meta.scopeLabel || getReportScopeLabel(scope);
  const dateLabel = meta.dateLabel || getReportDateRangeLabel(dateFilter);

  return {
    id: randomId('report-history'),
    generatedAt: generatedAt.toISOString(),
    scope,
    scopeLabel,
    dateFilter,
    dateLabel,
    title: `${scopeLabel} Report`,
    summary: meta.summary || `${scopeLabel} • ${dateLabel}`,
    metrics: {
      duration: meta.duration || '',
      commandCount: Number(meta.commandCount || 0),
      jobCount: Number(meta.jobCount || 0),
      completedJobCount: Number(meta.completedJobCount || 0),
      findingCount: Number(meta.findingCount || 0),
      generatedLabel: generatedAt.toLocaleString()
    },
    text: String(report?.text || state.currentReportText || '')
  };
}

async function saveCurrentReportToHistory({ silent = false } = {}) {
  return withBusyAction('saveReportHistory', 'Saving...', async () => {
    if (!state.currentReportText) {
      if (!silent) {
        showToast('Generate a report first.', 4000, 'warning');
      }
      return null;
    }

    state.settings.reportHistory = normalizeReportHistoryClient(state.settings.reportHistory);
    const history = getReportHistory();
    const snapshot = {
      ...(state.currentReportSnapshot || createReportHistoryItem({ text: state.currentReportText, meta: {} })),
      text: state.currentReportText
    };

    const duplicateIndex = history.items.findIndex((item) => item.text === snapshot.text);

    if (duplicateIndex >= 0) {
      history.items.splice(duplicateIndex, 1);
    }

    history.items.push(snapshot);
    history.items = history.items.slice(-REPORT_HISTORY_MAX_ITEMS);
    state.currentReportSnapshot = snapshot;

    try {
      state.settings = await saveSettings({ toastMessage: '', debounce: true, refresh: false });
      state.settings.reportHistory = normalizeReportHistoryClient(state.settings.reportHistory);

      if (!silent) {
        showToast('Report saved to history.', 3500, 'success');
      }

      return snapshot;
    } catch (error) {
      if (!silent) {
        showToast(`Could not save report history: ${error.message}`, 7000, 'error');
      }
      return null;
    }
  });
}

function renderReportHistoryList() {
  const list = $('#report-history-list');

  if (!list) {
    return;
  }

  const history = getReportHistory();
  const items = history.items.slice().reverse();

  list.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'report-history-empty';
    empty.textContent = 'No saved reports yet. Generate a report first.';
    list.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'report-history-row';

    const info = document.createElement('div');
    info.className = 'report-history-info';

    const title = document.createElement('strong');
    title.textContent = item.title || 'Work Activity Report';

    const meta = document.createElement('span');
    meta.textContent = `${item.metrics?.generatedLabel || new Date(item.generatedAt).toLocaleString()} · ${item.dateLabel || item.dateFilter || 'Today'}`;

    const summary = document.createElement('p');
    summary.textContent = item.summary || 'Report snapshot';

    info.appendChild(title);
    info.appendChild(meta);
    info.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'report-history-actions';

    const openButton = document.createElement('button');
    openButton.className = 'mini-action-button';
    openButton.type = 'button';
    openButton.textContent = 'Open';
    openButton.addEventListener('click', () => openReportHistoryItem(item.id));

    const copyButton = document.createElement('button');
    copyButton.className = 'mini-action-button';
    copyButton.type = 'button';
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', () => copyReportHistoryItem(item.id));

    const saveButton = document.createElement('button');
    saveButton.className = 'mini-action-button';
    saveButton.type = 'button';
    saveButton.textContent = 'Save';
    saveButton.addEventListener('click', () => saveReportHistoryItem(item.id));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'mini-action-button danger-mini';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteReportHistoryItem(item.id));

    actions.appendChild(openButton);
    actions.appendChild(copyButton);
    actions.appendChild(saveButton);
    actions.appendChild(deleteButton);

    row.appendChild(info);
    row.appendChild(actions);
    list.appendChild(row);
  });
}

function openReportHistoryModal() {
  renderReportHistoryList();
  $('#report-history-modal')?.classList.remove('hidden');
}

function closeReportHistoryModal() {
  $('#report-history-modal')?.classList.add('hidden');
}

function findReportHistoryItem(id) {
  const history = getReportHistory();
  return history.items.find((item) => item.id === id) || null;
}

function openReportHistoryItem(id) {
  const item = findReportHistoryItem(id);

  if (!item) {
    showToast('Report history item was not found.', 5000, 'warning');
    return;
  }

  state.currentReportText = item.text;
  state.currentReportSnapshot = item;
  state.currentReportScope = item.scope || 'all';
  state.currentReportDateFilter = item.dateFilter || 'today';

  const scopeSelect = $('#report-scope-select');
  const dateSelect = $('#report-date-filter-select');

  if (scopeSelect) {
    scopeSelect.value = state.currentReportScope;
  }

  if (dateSelect) {
    dateSelect.value = normalizeReportCustomRangeFilter(state.currentReportDateFilter)
      ? 'custom'
      : state.currentReportDateFilter;
  }

  syncReportCustomRangeControls();
  ensureReportCustomRangeValues(state.currentReportDateFilter);

  $('#report-tab-name').textContent = item.scopeLabel || getReportScopeLabel(state.currentReportScope);
  $('#report-duration').textContent = item.metrics?.duration || '00:00:00';
  $('#report-job-count').textContent = String(item.metrics?.jobCount || 0);
  $('#report-command-count').textContent = String(item.metrics?.commandCount || 0);
  $('#report-finding-count').textContent = String(item.metrics?.findingCount || 0);
  $('#session-report-output').value = item.text || '';

  closeReportHistoryModal();
  $('#session-report-modal')?.classList.remove('hidden');
  $('#session-report-output')?.focus();
}

async function copyReportHistoryItem(id) {
  const item = findReportHistoryItem(id);

  if (!item) {
    showToast('Report history item was not found.', 5000, 'warning');
    return;
  }

  await navigator.clipboard.writeText(item.text || '');
  showToast('Saved report copied.', 3000, 'success');
}

function saveTextAsDownload(text, filename, mime = 'text/markdown;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const link = document.createElement('a');

  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 1000);
}

function saveReportHistoryItem(id) {
  const item = findReportHistoryItem(id);

  if (!item) {
    showToast('Report history item was not found.', 5000, 'warning');
    return;
  }

  const filename = safeReportFilename(`advance-terminal-${String(item.scopeLabel || 'report').toLowerCase()}-${String(item.dateFilter || 'history').toLowerCase()}-history`);
  saveTextAsDownload(item.text || '', filename);
  showToast(`Saved report as ${filename}.`, 4000, 'success');
}

async function deleteReportHistoryItem(id) {
  const item = findReportHistoryItem(id);

  if (!item) {
    return;
  }

  const confirmed = await showConfirm({
    title: 'Delete Saved Report',
    message: `Delete this saved report?\n\n${item.summary || item.title || 'Work Activity Report'}`,
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel'
  });

  if (!confirmed) {
    return;
  }

  const history = getReportHistory();
  history.items = history.items.filter((row) => row.id !== id);
  state.settings = await saveSettings({ toastMessage: '', debounce: true, refresh: false });
  renderReportHistoryList();
  showToast('Saved report deleted.', 3500, 'success');
}

async function clearReportHistory() {
  const history = getReportHistory();

  if (!history.items.length) {
    showToast('Report history is already empty.', 3500, 'warning');
    return;
  }

  const confirmed = await showConfirm({
    title: 'Clear Report History',
    message: 'Delete all saved report snapshots?\n\nThis does not delete daily usage counters.',
    confirmLabel: 'Clear History',
    cancelLabel: 'Cancel'
  });

  if (!confirmed) {
    return;
  }

  state.settings.reportHistory = normalizeReportHistoryClient();
  state.settings = await saveSettings({ toastMessage: '', debounce: true, refresh: false });
  renderReportHistoryList();
  showToast('Report history cleared.', 3500, 'success');
}

async function downloadSessionReport() {
  return withBusyAction('saveReport', 'Saving...', async () => {
    if (!state.currentReportText) {
      showToast('Generate a report first.');
      return;
    }

    try {
      const filename = safeReportFilename(`advance-terminal-${getReportScopeLabel(state.currentReportScope).toLowerCase()}-${getReportDateFilterLabel(state.currentReportDateFilter).toLowerCase()}-report`);
      saveTextAsDownload(state.currentReportText, filename);
      showToast(`Report saved as ${filename}.`);
    } catch (error) {
      showToast(`Save report failed: ${error.message}`, 7000, 'error');
    }
  });
}


function getUiTheme() {
  return state.settings?.ui?.theme === 'dark' ? 'dark' : 'light';
}

function toolbarIconSvg(name) {
  const icons = {
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 14.6A8.2 8.2 0 0 1 9.4 3a7 7 0 1 0 11.6 11.6z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>',
  };

  return icons[name] || '';
}

function setToolbarIcon(element, name) {
  if (!element) {
    return;
  }

  element.innerHTML = toolbarIconSvg(name);
}

function updateThemeControls(theme) {
  const label = $('#theme-label');
  const icon = $('#theme-icon');
  const select = $('#appearance-theme-select');

  if (label) {
    label.textContent = theme === 'dark' ? 'Light' : 'Dark';
  }

  setToolbarIcon(icon, theme === 'dark' ? 'sun' : 'moon');

  if (select) {
    select.value = theme;
  }
}

function applyTheme(theme) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';

  document.documentElement.dataset.theme = normalizedTheme;
  updateThemeControls(normalizedTheme);

  state.terminals.forEach((session) => {
    if (session.term) {
      session.term.options.theme = getTerminalTheme();
    }
  });
}

async function setTheme(theme, persist = true) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';

  if (!state.settings) {
    applyTheme(normalizedTheme);
    return;
  }

  state.settings.ui = {
    ...(state.settings.ui || {}),
    theme: normalizedTheme
  };

  applyTheme(normalizedTheme);

  if (persist) {
    state.settings = await saveSettings({ toastMessage: '', debounce: true, refresh: false });
  }
}

async function toggleTheme() {
  const nextTheme = getUiTheme() === 'dark' ? 'light' : 'dark';
  await setTheme(nextTheme);
  showToast(`${nextTheme === 'dark' ? 'Dark' : 'Light'} mode enabled.`);
}

function getSelectedServer() {
  return state.settings.servers.find((server) => server.id === state.selectedServerId) || null;
}

function normalizeToolbarPanel(panel) {
  const allowedPanels = ['terminal', 'view', 'settings', 'report', 'help'];
  return allowedPanels.includes(panel) ? panel : 'terminal';
}

function setActiveToolbarPanel(panel) {
  const normalizedPanel = normalizeToolbarPanel(panel);
  state.activeToolbarPanel = normalizedPanel;

  $$('.toolbar-panel').forEach((item) => {
    item.classList.toggle('active', item.dataset.toolbarPanel === normalizedPanel);
  });

  $$('.menu-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.menuAction === normalizedPanel);
  });
}

function getToolbarPanelForView(view) {
  if (view === 'about') {
    return 'help';
  }

  if (view === 'settings') {
    return 'settings';
  }

  if (view === 'view') {
    return 'view';
  }

  if (view === 'report') {
    return 'report';
  }

  return 'terminal';
}


function syncWorkspaceForView(view) {
  const workspace = $('.workspace');
  const serversPanel = $('#servers-panel');
  const hideConnections = view !== 'terminal';

  workspace?.classList.toggle('connections-hidden', hideConnections);

  if (!serversPanel) {
    return;
  }

  serversPanel.setAttribute('aria-hidden', hideConnections ? 'true' : 'false');

  if (hideConnections) {
    serversPanel.setAttribute('inert', '');
  } else {
    serversPanel.removeAttribute('inert');
  }
}

function setActiveView(view, toolbarPanel = null) {
  const previousView = state.activeView;
  state.activeView = view;

  $$('.view').forEach((item) => item.classList.remove('active'));
  $(`#${view}-view`)?.classList.add('active');

  setActiveToolbarPanel(toolbarPanel || getToolbarPanelForView(view));
  syncWorkspaceForView(view);

  const terminalShortcut = $('#tool-open-terminal');
  const terminalViewActive = view === 'terminal';

  if (terminalShortcut) {
    terminalShortcut.classList.toggle('active', terminalViewActive);

    if (terminalViewActive) {
      terminalShortcut.setAttribute('aria-current', 'page');
    } else {
      terminalShortcut.removeAttribute('aria-current');
    }
  }

  if (view === 'settings') {
    renderSettings();
  }

  if (view === 'view') {
    updateNotificationPositionControls(getNotificationPosition());
  }

  if (view === 'report') {
    setReportTab(state.activeReportTab || 'options');
  }

  if (view === 'about') {
    setHelpTab(state.activeHelpTab || 'about');
  }

  if (view === 'terminal') {
    fitActiveTerminal();
  }

  if (previousView && previousView !== view) {
    appendActivityFeedEvent(`View changed to ${getActivityViewLabel(view)}.`, 'action', { dedupeMs: 800 });
  }
}


function setHelpTab(tab) {
  const allowedTabs = new Set([
    'about',
    'quick-start',
    'features',
    'terminal',
    'connections',
    'commands',
    'ssh-keys',
    'safety',
    'restore',
    'ai',
    'reports',
    'live-console',
    'view',
    'updates',
    'backup',
    'troubleshooting'
  ]);
  const normalizedTab = allowedTabs.has(tab) ? tab : 'about';

  state.activeHelpTab = normalizedTab;

  $$('.help-tab').forEach((item) => {
    item.classList.toggle('active', item.dataset.helpTab === normalizedTab);
  });

  $$('[data-help-toolbar]').forEach((item) => {
    item.classList.toggle('active', item.dataset.helpToolbar === normalizedTab);
  });

  $$('.help-section').forEach((item) => {
    item.classList.toggle('active', item.id === `help-tab-${normalizedTab}`);
  });

  updateAboutInfo();
}


function setSettingsTab(tab) {
  const previousTab = state.activeSettingsTab;

  if (tab === 'appearance') {
    setActiveView('view', 'view');
    return;
  }

  if (tab === 'reports' || tab === 'audit') {
    setActiveView('report', 'report');
    setReportTab(tab === 'audit' ? 'audit' : 'options');
    return;
  }

  if (tab === 'about') {
    setActiveView('about', 'help');
    setHelpTab('about');
    return;
  }

  const allowedTabs = new Set(['safety', 'restore', 'workspaces', 'terminal-profiles', 'terminal-actions', 'ai', 'keys', 'updates']);
  const normalizedTab = allowedTabs.has(tab) ? tab : 'safety';

  state.activeSettingsTab = normalizedTab;
  $$('.settings-tab').forEach((item) => {
    item.classList.toggle('active', item.dataset.settingsTab === normalizedTab);
  });

  $$('.settings-section').forEach((item) => item.classList.remove('active'));
  $(`#settings-tab-${normalizedTab}`)?.classList.add('active');

  if (normalizedTab === 'safety') {
    updatePasteProtectionControls();
  }

  if (normalizedTab === 'restore') {
    renderSettingsRestorePoints();
  }

  if (normalizedTab === 'workspaces') {
    renderWorkspaceSettings();
  }

  if (normalizedTab === 'terminal-profiles') {
    renderTerminalProfilesSettings();
  }

  if (normalizedTab === 'terminal-actions') {
    renderTerminalActionsSettings();
  }

  if (normalizedTab === 'ai') {
    updateAiSettingsControls();
    refreshAiStatus({ silent: true }).catch(() => {});
  }

  if (normalizedTab === 'keys') {
    refreshSshKeys({ silent: true });
  }

  if (normalizedTab === 'updates') {
    updateAboutInfo();
    refreshUpdateStatus();
  }

  if (previousTab && previousTab !== normalizedTab) {
    appendActivityFeedEvent(`Settings tab opened: ${getActivitySettingsTabLabel(normalizedTab)}.`, 'action', { dedupeMs: 800 });
  }
}


function setReportTab(tab) {
  const previousTab = state.activeReportTab;
  const normalizedTab = tab === 'audit' ? 'audit' : 'options';

  state.activeReportTab = normalizedTab;

  $$('.report-tab').forEach((item) => {
    item.classList.toggle('active', item.dataset.reportTab === normalizedTab);
  });

  $$('.report-page-section').forEach((item) => {
    item.classList.toggle('active', item.id === `report-tab-${normalizedTab}`);
  });

  if (normalizedTab === 'options') {
    renderReportOptionsSettings();
  }

  if (normalizedTab === 'audit') {
    renderAuditLog();
  }

  if (previousTab && previousTab !== normalizedTab) {
    appendActivityFeedEvent(`Report page opened: ${getActivitySettingsTabLabel(normalizedTab)}.`, 'action', { dedupeMs: 800 });
  }
}


function navigateFromHelpLink(button) {
  if (!button) {
    return;
  }

  const action = button.dataset.helpAction || '';
  const target = button.dataset.helpNav || 'terminal';

  if (action === 'open-connections') {
    setActiveView('terminal', 'terminal');
    setLeftTab('connections');
    openAddConnectionModal('remote', true);
    return;
  }

  if (action === 'open-commands') {
    setActiveView('terminal', 'terminal');
    setLeftTab('commands');
    openCommandManagerModal();
    return;
  }

  if (action === 'toggle-activity-feed') {
    setActiveView('view', 'view');
    toggleLiveConsole();
    return;
  }

  if (action === 'repair-settings') {
    setActiveView('settings', 'settings');
    setSettingsTab('restore');
    repairSettingsFromLocalBackup();
    return;
  }

  if (action === 'export-settings') {
    setActiveView('settings', 'settings');
    exportSettingsBackup();
    return;
  }

  if (action === 'import-settings') {
    setActiveView('settings', 'settings');
    importSettingsBackup();
    return;
  }

  if (target === 'settings') {
    setActiveView('settings', 'settings');
    setSettingsTab(button.dataset.settingsTab || 'safety');
    return;
  }

  if (target === 'report') {
    setActiveView('report', 'report');
    setReportTab(button.dataset.reportTab || 'options');
    return;
  }

  if (target === 'view') {
    setActiveView('view', 'view');
    return;
  }

  if (target === 'help') {
    setActiveView('about', 'help');
    setHelpTab(button.dataset.helpTabTarget || button.dataset.helpTab || 'about');
    return;
  }

  setActiveView('terminal', 'terminal');

  if (button.dataset.leftTab) {
    setLeftTab(button.dataset.leftTab);
  }
}


function setLeftTab(tab) {
  const previousTab = state.activeLeftTab;
  const normalizedTab = tab === 'commands' ? 'commands' : 'connections';
  state.activeLeftTab = normalizedTab;

  $$('.left-tab').forEach((item) => {
    item.classList.toggle('active', item.dataset.leftTab === normalizedTab);
  });

  $$('.collapsed-left-tab').forEach((item) => {
    item.classList.toggle('active', item.dataset.leftTab === normalizedTab);
  });

  $$('.left-tab-panel').forEach((item) => {
    item.classList.toggle('active', item.id === `left-tab-${normalizedTab}`);
  });

  if (normalizedTab === 'commands') {
    renderCommandList();
  } else {
    renderServerList();
  }

  if (previousTab && previousTab !== normalizedTab) {
    appendActivityFeedEvent(`Left panel switched to ${normalizedTab === 'commands' ? 'Commands' : 'Connection Server'}.`, 'action', { dedupeMs: 800 });
  }
}


function getTerminalToolbarActions() {
  if (!state.settings) {
    return [];
  }

  if (!Array.isArray(state.settings.terminalActions) || !state.settings.terminalActions.length) {
    state.settings.terminalActions = getDefaultTerminalActions();
  }

  state.settings.terminalActions = state.settings.terminalActions.map(normalizeTerminalToolbarAction);
  return state.settings.terminalActions;
}

function getSelectedTerminalAction() {
  return getTerminalToolbarActions().find((item) => item.id === state.editingTerminalActionId) || null;
}

function normalizeTerminalToolbarShortcut(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  const aliases = new Map([
    ['control', 'Ctrl'],
    ['ctrl', 'Ctrl'],
    ['alt', 'Alt'],
    ['option', 'Alt'],
    ['shift', 'Shift'],
    ['meta', 'Meta'],
    ['cmd', 'Meta'],
    ['command', 'Meta'],
    ['esc', 'Escape'],
    ['escape', 'Escape'],
    ['space', 'Space'],
    ['spacebar', 'Space'],
    ['return', 'Enter'],
    ['enter', 'Enter'],
    ['del', 'Delete'],
    ['delete', 'Delete'],
    ['backspace', 'Backspace'],
    ['tab', 'Tab'],
    ['up', 'ArrowUp'],
    ['down', 'ArrowDown'],
    ['left', 'ArrowLeft'],
    ['right', 'ArrowRight']
  ]);
  const modifiers = new Set();
  let key = '';

  raw.split('+').map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const lower = part.toLowerCase();
    const alias = aliases.get(lower);

    if (['Ctrl', 'Alt', 'Shift', 'Meta'].includes(alias)) {
      modifiers.add(alias);
      return;
    }

    if (!key) {
      if (alias) {
        key = alias;
      } else if (/^f(?:[1-9]|1[0-2])$/i.test(part)) {
        key = part.toUpperCase();
      } else if (part.length === 1) {
        key = part.toUpperCase();
      } else {
        key = part.charAt(0).toUpperCase() + part.slice(1);
      }
    }
  });

  if (!key || !modifiers.size) {
    return '';
  }

  return ['Ctrl', 'Alt', 'Shift', 'Meta']
    .filter((modifier) => modifiers.has(modifier))
    .concat(key)
    .join('+');
}

function terminalToolbarShortcutFromEvent(event) {
  if (!event || ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
    return '';
  }

  const parts = [];

  if (event.ctrlKey) {
    parts.push('Ctrl');
  }

  if (event.altKey) {
    parts.push('Alt');
  }

  if (event.shiftKey) {
    parts.push('Shift');
  }

  if (event.metaKey) {
    parts.push('Meta');
  }

  if (!parts.length) {
    return '';
  }

  let key = String(event.key || '');

  if (key === ' ') {
    key = 'Space';
  } else if (key.length === 1) {
    key = key.toUpperCase();
  } else {
    const keyAliases = {
      Esc: 'Escape',
      Up: 'ArrowUp',
      Down: 'ArrowDown',
      Left: 'ArrowLeft',
      Right: 'ArrowRight'
    };
    key = keyAliases[key] || key;
  }

  return parts.concat(key).join('+');
}

function getReservedTerminalToolbarShortcuts() {
  return new Set([
    'Ctrl+Shift+P',
    'Ctrl+C',
    'Ctrl+V',
    'Ctrl+Shift+C',
    'Ctrl+Shift+V',
    'Ctrl+F'
  ]);
}

function getTerminalToolbarShortcutConflict(shortcut, exceptActionId = '') {
  const normalized = normalizeTerminalToolbarShortcut(shortcut);

  if (!normalized) {
    return null;
  }

  if (getReservedTerminalToolbarShortcuts().has(normalized)) {
    return { reserved: true, label: normalized };
  }

  const duplicate = getTerminalToolbarActions().find((item) => (
    item.itemType !== 'separator'
    && item.id !== exceptActionId
    && normalizeTerminalToolbarShortcut(item.shortcut) === normalized
  ));

  return duplicate ? { reserved: false, action: duplicate, label: normalized } : null;
}

function getActiveTerminalToolbarProfileId(session = state.terminals.get(state.activeTerminalId) || null) {
  if (!session || session.closed) {
    return '';
  }

  const server = session.server || {};
  const explicitProfileId = String(server.profileId || '').trim();

  if (explicitProfileId) {
    return explicitProfileId;
  }

  if (String(server.id || '').startsWith('terminal-profile:')) {
    return String(server.id).slice('terminal-profile:'.length);
  }

  if (server.type === 'local') {
    const savedServer = state.settings?.servers?.find((candidate) => candidate.id === server.id);
    return String(savedServer?.profileId || '').trim();
  }

  return '';
}

function terminalToolbarItemMatchesContext(action, session = state.terminals.get(state.activeTerminalId) || null) {
  const normalized = normalizeTerminalToolbarAction(action);
  const visibility = normalized.visibility || 'all';

  if (visibility === 'all') {
    return true;
  }

  if (visibility === 'admin') {
    return state.appInfo?.isElevated === true;
  }

  if (!session || session.closed) {
    return false;
  }

  if (visibility === 'ssh') {
    return session.server?.type === 'remote';
  }

  if (visibility === 'local') {
    return session.server?.type !== 'remote';
  }

  if (visibility === 'profile') {
    return Boolean(normalized.profileId)
      && Boolean(getTerminalProfileById(normalized.profileId))
      && normalized.profileId === getActiveTerminalToolbarProfileId(session);
  }

  return true;
}

function applyTerminalActionButtonColor(button, action) {
  if (!button || !action?.color) {
    return;
  }

  button.classList.add('has-custom-color');
  button.style.setProperty('--tool-accent', action.color);
  button.style.setProperty('--tool-tint', terminalActionHexToRgba(action.color, 0.14));
  button.style.setProperty('--tool-border-accent', terminalActionHexToRgba(action.color, 0.42));
}

function createTerminalToolbarActionButton(actionValue, { dropdownItem = false } = {}) {
  const action = normalizeTerminalToolbarAction(actionValue);
  const button = document.createElement('button');
  const icon = document.createElement('span');
  const label = document.createElement('span');
  const shortcut = normalizeTerminalToolbarShortcut(action.shortcut);

  button.className = dropdownItem
    ? `terminal-toolbar-dropdown-item terminal-action-button dynamic-terminal-action terminal-action-kind-${action.action}`
    : `tool-button terminal-action-button dynamic-terminal-action terminal-action-kind-${action.action}`;
  button.type = 'button';
  button.title = ['sendText', 'typeText'].includes(action.action)
    ? `${terminalActionKindLabel(action.action)}: ${action.text || action.name}`
    : action.name;

  if (shortcut) {
    button.title += ` · ${shortcut}`;
  }

  button.dataset.terminalAction = action.action;
  button.dataset.terminalActionId = action.id;
  button.dataset.defaultTitle = button.title;

  icon.className = dropdownItem ? 'terminal-toolbar-dropdown-item-icon' : 'tool-icon';
  setTerminalActionIconContent(icon, action);
  label.className = dropdownItem ? 'terminal-toolbar-dropdown-item-label' : '';
  label.textContent = action.name;
  button.append(icon, label);

  if (dropdownItem && shortcut) {
    const hint = document.createElement('kbd');
    hint.textContent = shortcut;
    button.appendChild(hint);
  }

  applyTerminalActionButtonColor(button, action);

  button.addEventListener('click', () => {
    closeTerminalToolbarDropdown();
    executeTerminalToolbarAction(action).catch((error) => {
      showToast(`${action.name} failed: ${error.message}`, 7000);
    });
  });

  return button;
}

function closeTerminalToolbarDropdown() {
  const menu = state.terminalToolbarDropdownMenu;

  if (menu?.remove) {
    menu.remove();
  }

  state.terminalToolbarDropdownMenu = null;
  $$('.terminal-toolbar-dropdown-toggle.active').forEach((button) => {
    button.classList.remove('active');
    button.setAttribute('aria-expanded', 'false');
  });
}

function openTerminalToolbarDropdown(toggleButton, label, actionValues) {
  if (!toggleButton || !Array.isArray(actionValues) || !actionValues.length) {
    return;
  }

  const wasOpen = toggleButton.classList.contains('active');
  closeTerminalToolbarDropdown();

  if (wasOpen) {
    return;
  }

  const menu = document.createElement('div');
  const heading = document.createElement('div');

  menu.className = 'terminal-toolbar-dropdown-menu';
  menu.setAttribute('role', 'menu');
  heading.className = 'terminal-toolbar-dropdown-heading';
  heading.textContent = label;
  menu.appendChild(heading);

  actionValues.forEach((action) => {
    menu.appendChild(createTerminalToolbarActionButton(action, { dropdownItem: true }));
  });

  document.body.appendChild(menu);
  state.terminalToolbarDropdownMenu = menu;
  toggleButton.classList.add('active');
  toggleButton.setAttribute('aria-expanded', 'true');

  const rect = toggleButton.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuRect.width - 8));
  const top = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - menuRect.height - 8));

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  updateTerminalInteractionState();
  menu.querySelector('button')?.focus();
}

function createTerminalToolbarDropdown(label, actions) {
  const wrapper = document.createElement('div');
  const toggle = document.createElement('button');
  const icon = document.createElement('span');
  const text = document.createElement('span');
  const first = normalizeTerminalToolbarAction(actions[0]);

  wrapper.className = 'terminal-toolbar-dropdown';
  toggle.type = 'button';
  toggle.className = 'tool-button terminal-toolbar-dropdown-toggle';
  toggle.title = `${label} menu`;
  toggle.setAttribute('aria-haspopup', 'menu');
  toggle.setAttribute('aria-expanded', 'false');

  icon.className = 'tool-icon';
  setTerminalActionIconContent(icon, first);
  text.textContent = `${label} ▾`;
  toggle.append(icon, text);
  applyTerminalActionButtonColor(toggle, first);

  toggle.addEventListener('click', () => {
    openTerminalToolbarDropdown(toggle, label, actions);
  });

  wrapper.appendChild(toggle);
  return wrapper;
}

function renderTerminalToolbarActions() {
  const container = $('#terminal-toolbar-actions');

  if (!container) {
    return;
  }

  closeTerminalToolbarDropdown();

  const activeSession = state.terminals.get(state.activeTerminalId) || null;
  const actions = getTerminalToolbarActions()
    .filter((action) => action.enabled !== false)
    .filter((action) => terminalToolbarItemMatchesContext(action, activeSession));

  container.innerHTML = '';

  if (!actions.length) {
    const empty = document.createElement('div');
    empty.className = 'terminal-toolbar-empty';
    empty.textContent = 'No toolbar items match this terminal. Open Settings → Terminal Actions.';
    container.appendChild(empty);
    return;
  }

  for (let index = 0; index < actions.length; index += 1) {
    const action = normalizeTerminalToolbarAction(actions[index]);

    if (action.itemType === 'separator') {
      const separator = document.createElement('span');
      separator.className = 'toolbar-separator dynamic-terminal-separator';
      separator.setAttribute('aria-hidden', 'true');
      container.appendChild(separator);
      continue;
    }

    if (action.dropdown) {
      const dropdownItems = [action];
      let cursor = index + 1;

      while (cursor < actions.length) {
        const next = normalizeTerminalToolbarAction(actions[cursor]);

        if (next.itemType !== 'action' || next.dropdown !== action.dropdown) {
          break;
        }

        dropdownItems.push(next);
        cursor += 1;
      }

      container.appendChild(createTerminalToolbarDropdown(action.dropdown, dropdownItems));
      index = cursor - 1;
      continue;
    }

    if (action.group) {
      const group = document.createElement('div');
      const groupedItems = [action];
      let cursor = index + 1;

      group.className = 'terminal-toolbar-button-group';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', action.group);
      group.title = action.group;

      while (cursor < actions.length) {
        const next = normalizeTerminalToolbarAction(actions[cursor]);

        if (next.itemType !== 'action' || next.dropdown || next.group !== action.group) {
          break;
        }

        groupedItems.push(next);
        cursor += 1;
      }

      groupedItems.forEach((item) => {
        group.appendChild(createTerminalToolbarActionButton(item));
      });

      container.appendChild(group);
      index = cursor - 1;
      continue;
    }

    container.appendChild(createTerminalToolbarActionButton(action));
  }

  updateTerminalInteractionState();
}

async function executeTerminalToolbarAction(action) {
  const normalized = normalizeTerminalToolbarAction(action);

  if (normalized.itemType === 'separator') {
    return;
  }

  const session = state.terminals.get(state.activeTerminalId) || null;

  if (!terminalToolbarItemMatchesContext(normalized, session)) {
    showToast('This toolbar action is not available for the active terminal.', 4000, 'warning');
    renderTerminalToolbarActions();
    return;
  }

  const allowedWhileBusy = terminalActionAllowedWhileProcessing(normalized.action);

  if (!allowedWhileBusy && session && !guardTerminalAction(session, normalized.name || 'Terminal action', normalized.action)) {
    return;
  }

  if (!allowedWhileBusy && state.terminalActionInFlight) {
    showToast('Please wait for the current terminal action to finish.', 4000, 'warning');
    return;
  }

  const runAction = async () => {
    switch (normalized.action) {
      case 'clear':
        clearActiveTerminal();
        return;
      case 'copyAll':
        await copyAllActiveTerminal();
        return;
      case 'copySelection':
        await copySelectedTerminalText();
        return;
      case 'paste':
        await pasteClipboardToTerminal();
        return;
      case 'closeSession':
        closeTerminalSession();
        return;
      case 'sendText':
        await sendCommandToActiveTerminal({
          name: normalized.name || 'Terminal Action',
          category: 'Custom',
          command: normalized.text || ''
        });
        return;
      case 'typeText':
        await typeTextToActiveTerminal(normalized.text || '', normalized.name || 'Type Text');
        return;
      default: {
        const sequence = TERMINAL_ACTION_KEY_SEQUENCES[normalized.action];

        if (sequence) {
          sendControlToActiveTerminal(
            sequence,
            normalized.name || terminalActionKindLabel(normalized.action),
            normalized.action
          );
          return;
        }

        showToast(`Unknown terminal action: ${normalized.action}`);
      }
    }
  };

  if (allowedWhileBusy) {
    await runAction();
    return;
  }

  state.terminalActionInFlight = true;
  updateTerminalInteractionState();

  try {
    await runAction();
  } finally {
    state.terminalActionInFlight = false;
    updateTerminalInteractionState();
  }
}

function handleTerminalToolbarShortcut(event) {
  if (!event || event.defaultPrevented || state.activeView !== 'terminal') {
    return;
  }

  if (
    !$('#confirm-modal')?.classList.contains('hidden')
    || !$('#safe-paste-modal')?.classList.contains('hidden')
    || state.commandPaletteOpen
  ) {
    return;
  }

  const shortcut = terminalToolbarShortcutFromEvent(event);

  if (!shortcut || getReservedTerminalToolbarShortcuts().has(shortcut)) {
    return;
  }

  const session = state.terminals.get(state.activeTerminalId) || null;
  const action = getTerminalToolbarActions().find((item) => (
    item.itemType !== 'separator'
    && item.enabled !== false
    && normalizeTerminalToolbarShortcut(item.shortcut) === shortcut
    && terminalToolbarItemMatchesContext(item, session)
  ));

  if (!action) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  executeTerminalToolbarAction(action).catch((error) => {
    showToast(`${action.name} failed: ${error.message}`, 7000, 'error');
  });
}

function renderTerminalActionIconPicker(selectedIcon = null) {
  const picker = $('#terminal-action-icon-picker');

  if (!picker) {
    return;
  }

  const selected = selectedIcon || $('#terminal-action-selected-icon')?.value || getSelectedTerminalAction()?.icon || 'terminal';
  picker.innerHTML = '';

  Object.entries(TERMINAL_ACTION_ICONS).forEach(([icon, svg]) => {
    const button = document.createElement('button');
    const preview = document.createElement('span');
    const label = document.createElement('small');

    button.type = 'button';
    button.className = `terminal-action-icon-option ${icon === selected ? 'active' : ''}`;
    button.dataset.icon = icon;
    button.title = TERMINAL_ACTION_ICON_LABELS[icon] || icon;
    preview.innerHTML = svg;
    label.textContent = TERMINAL_ACTION_ICON_LABELS[icon] || icon;
    button.append(preview, label);

    button.addEventListener('click', () => {
      const hiddenIcon = $('#terminal-action-selected-icon');

      if (hiddenIcon) {
        hiddenIcon.value = icon;
      }

      renderTerminalActionIconPicker(icon);
      updateTerminalActionCustomizationControls();

      if (icon === 'custom') {
        $('#terminal-action-custom-icon')?.focus();
      }
    });

    picker.appendChild(button);
  });
}


const TERMINAL_PROFILE_KIND_LABELS = Object.freeze({
  powershell: 'PowerShell',
  cmd: 'Command Prompt',
  'git-bash': 'Git Bash',
  wsl: 'WSL',
  custom: 'Custom'
});

function normalizeTerminalProfileClient(profile = {}) {
  const allowedKinds = new Set(Object.keys(TERMINAL_PROFILE_KIND_LABELS));
  const kind = allowedKinds.has(String(profile.kind || '').toLowerCase())
    ? String(profile.kind).toLowerCase()
    : 'custom';
  const color = /^#[0-9a-f]{6}$/i.test(String(profile.color || '').trim())
    ? String(profile.color).trim().toLowerCase()
    : '#58a6ff';
  const environment = profile.environment && typeof profile.environment === 'object' && !Array.isArray(profile.environment)
    ? { ...profile.environment }
    : {};

  return {
    id: String(profile.id || ''),
    name: String(profile.name || 'Terminal Profile').trim() || 'Terminal Profile',
    kind,
    executable: String(profile.executable || '').trim(),
    args: Array.isArray(profile.args) ? profile.args.map((item) => String(item ?? '')).slice(0, 40) : [],
    workingDirectory: String(profile.workingDirectory || '').trim(),
    environment,
    icon: Array.from(String(profile.icon || '').trim()).slice(0, 4).join('') || 'TERM',
    color
  };
}

function getTerminalProfiles() {
  if (!state.settings) {
    return [];
  }

  state.settings.terminalProfiles = Array.isArray(state.settings.terminalProfiles)
    ? state.settings.terminalProfiles.map(normalizeTerminalProfileClient)
    : [];

  return state.settings.terminalProfiles;
}

function getDefaultTerminalProfileId() {
  const profiles = getTerminalProfiles();
  const requested = String(state.settings?.defaultTerminalProfileId || '');

  return profiles.some((profile) => profile.id === requested)
    ? requested
    : (profiles[0]?.id || '');
}

function getTerminalProfileById(profileId) {
  return getTerminalProfiles().find((profile) => profile.id === profileId) || null;
}

function terminalProfileKindLabel(kind) {
  return TERMINAL_PROFILE_KIND_LABELS[String(kind || '')] || 'Custom';
}

function parseTerminalProfileEnvironment(text) {
  const environment = {};
  const lines = String(text || '').split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');

    if (separator <= 0) {
      return {
        ok: false,
        error: `Environment line ${index + 1} must use NAME=value.`
      };
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);

    if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)) {
      return {
        ok: false,
        error: `Environment variable "${key}" has an invalid name.`
      };
    }

    environment[key] = value;
  }

  return { ok: true, environment };
}

function terminalProfileEnvironmentToText(environment = {}) {
  return Object.entries(environment || {})
    .map(([key, value]) => `${key}=${String(value ?? '')}`)
    .join('\n');
}

function terminalProfileDefaultExecutable(kind) {
  const defaults = {
    powershell: 'powershell.exe',
    cmd: 'cmd.exe',
    'git-bash': 'C:\\Program Files\\Git\\bin\\bash.exe',
    wsl: 'wsl.exe',
    custom: ''
  };

  return defaults[String(kind || '')] || '';
}

function terminalProfileDefaultIcon(kind) {
  const icons = {
    powershell: 'PS',
    cmd: 'CMD',
    'git-bash': 'GIT',
    wsl: 'WSL',
    custom: 'TERM'
  };

  return icons[String(kind || '')] || 'TERM';
}

function populateLocalProfileDropdown(selectedProfileId = null) {
  const select = $('#add-connection-profile');

  if (!select) {
    return;
  }

  const current = selectedProfileId !== null
    ? String(selectedProfileId || '')
    : String(select.value || '');
  const defaultProfileId = getDefaultTerminalProfileId();

  select.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  const defaultProfile = getTerminalProfileById(defaultProfileId);
  defaultOption.textContent = defaultProfile
    ? `Default — ${defaultProfile.name}`
    : 'Default Terminal Profile';
  select.appendChild(defaultOption);

  getTerminalProfiles().forEach((profile) => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = `${profile.icon || 'TERM'}  ${profile.name}`;
    select.appendChild(option);
  });

  select.value = getTerminalProfiles().some((profile) => profile.id === current)
    ? current
    : '';
}

function closeQuickActionsMenu() {
  const menu = $('#quick-actions-menu');
  const button = $('#tool-quick-menu');

  if (menu) {
    menu.classList.add('hidden');
    menu.style.removeProperty('left');
    menu.style.removeProperty('top');
  }

  button?.setAttribute('aria-expanded', 'false');
}

function toggleQuickActionsMenu() {
  const menu = $('#quick-actions-menu');
  const button = $('#tool-quick-menu');

  if (!menu || !button) {
    return;
  }

  if (!menu.classList.contains('hidden')) {
    closeQuickActionsMenu();
    return;
  }

  closeTerminalProfileQuickMenu();
  closeWorkspaceQuickMenu();
  closeCommandPalette({ restoreFocus: false });
  closeTerminalTabPicker();

  menu.classList.remove('hidden');
  button.setAttribute('aria-expanded', 'true');

  const rect = button.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const gap = 6;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuRect.width - 8));
  const top = Math.max(8, Math.min(rect.bottom + gap, window.innerHeight - menuRect.height - 8));

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.querySelector('button')?.focus();
}

function runQuickActionsMenuItem(action) {
  const quickButton = $('#tool-quick-menu');

  if (!action) {
    return;
  }

  if (action === 'new-connection') {
    closeQuickActionsMenu();
    openAddConnectionModal('remote', true);
    return;
  }

  if (action === 'new-terminal') {
    closeQuickActionsMenu();
    toggleTerminalProfileQuickMenu(quickButton);
    return;
  }

  if (action === 'command-palette') {
    closeQuickActionsMenu();
    openCommandPalette();
    return;
  }

  if (action === 'workspaces') {
    closeQuickActionsMenu();
    toggleWorkspaceQuickMenu(quickButton);
  }
}

function renderTerminalProfileQuickMenu() {
  const menu = $('#terminal-profile-quick-menu');

  if (!menu) {
    return;
  }

  const profiles = getTerminalProfiles();
  const defaultProfileId = getDefaultTerminalProfileId();
  menu.innerHTML = '';

  if (!profiles.length) {
    const empty = document.createElement('div');
    empty.className = 'manage-command-empty';
    empty.textContent = 'No Terminal Profiles. Create one in Settings.';
    menu.appendChild(empty);
    return;
  }

  const ordered = [...profiles].sort((left, right) => {
    if (left.id === defaultProfileId) return -1;
    if (right.id === defaultProfileId) return 1;
    return 0;
  });

  ordered.forEach((profile) => {
    const button = document.createElement('button');
    const icon = document.createElement('span');
    const main = document.createElement('span');
    const name = document.createElement('strong');
    const details = document.createElement('small');
    const badge = document.createElement('span');

    button.type = 'button';
    button.className = 'terminal-profile-quick-item';
    button.setAttribute('role', 'menuitem');

    icon.className = 'terminal-profile-quick-icon';
    icon.textContent = profile.icon || 'TERM';
    icon.style.color = profile.color || '';

    main.className = 'terminal-profile-quick-main';
    name.textContent = profile.name;
    details.textContent = `${terminalProfileKindLabel(profile.kind)} · ${profile.workingDirectory || 'root folder'}`;
    main.append(name, details);

    badge.className = 'terminal-profile-quick-default';
    badge.textContent = profile.id === defaultProfileId ? 'Default' : '';

    button.append(icon, main, badge);
    button.addEventListener('click', () => {
      closeTerminalProfileQuickMenu();
      launchTerminalProfile(profile.id).catch((error) => {
        showToast(`Terminal profile failed: ${error.message}`, 7000, 'error');
      });
    });

    menu.appendChild(button);
  });
}

function closeTerminalProfileQuickMenu() {
  const menu = $('#terminal-profile-quick-menu');

  if (menu) {
    menu.classList.add('hidden');
    menu.style.removeProperty('left');
    menu.style.removeProperty('top');
  }
}

function toggleTerminalProfileQuickMenu(anchor = $('#tool-quick-menu')) {
  const menu = $('#terminal-profile-quick-menu');

  if (!menu || !anchor) {
    return;
  }

  if (!menu.classList.contains('hidden')) {
    closeTerminalProfileQuickMenu();
    return;
  }

  closeQuickActionsMenu();
  closeWorkspaceQuickMenu();
  renderTerminalProfileQuickMenu();
  menu.classList.remove('hidden');

  const rect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const gap = 6;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuRect.width - 8));
  const top = Math.max(8, Math.min(rect.bottom + gap, window.innerHeight - menuRect.height - 8));

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.querySelector('button')?.focus();
}

function renderTerminalProfileList() {
  const list = $('#terminal-profile-list');

  if (!list) {
    return;
  }

  const profiles = getTerminalProfiles();
  const defaultId = getDefaultTerminalProfileId();
  list.innerHTML = '';

  profiles.forEach((profile) => {
    const button = document.createElement('button');
    const icon = document.createElement('span');
    const main = document.createElement('span');
    const name = document.createElement('strong');
    const meta = document.createElement('small');
    const badge = document.createElement('span');

    button.type = 'button';
    button.className = `terminal-profile-list-item ${profile.id === state.editingTerminalProfileId ? 'active' : ''}`;

    icon.className = 'terminal-profile-list-icon';
    icon.textContent = profile.icon || 'TERM';
    icon.style.color = profile.color || '';

    main.className = 'terminal-profile-list-main';
    name.textContent = profile.name;
    meta.textContent = `${terminalProfileKindLabel(profile.kind)} · ${profile.executable || 'Executable not set'}`;
    main.append(name, meta);

    badge.className = 'terminal-profile-default-badge';
    badge.textContent = profile.id === defaultId ? 'Default' : '';

    button.append(icon, main, badge);
    button.addEventListener('click', () => loadTerminalProfileIntoManager(profile.id));
    list.appendChild(button);
  });

  if (!profiles.length) {
    const empty = document.createElement('div');
    empty.className = 'manage-command-empty';
    empty.textContent = 'No terminal profiles yet.';
    list.appendChild(empty);
  }

  const selected = getTerminalProfileById(state.editingTerminalProfileId);
  $('#terminal-profile-duplicate') && ($('#terminal-profile-duplicate').disabled = !selected);
  $('#terminal-profile-delete') && ($('#terminal-profile-delete').disabled = profiles.length <= 1 || !selected);
  $('#terminal-profile-launch') && ($('#terminal-profile-launch').disabled = !selected);
}

function fillTerminalProfileForm(profile = null) {
  const normalized = normalizeTerminalProfileClient(profile || {
    name: 'New Profile',
    kind: 'custom',
    executable: '',
    args: [],
    workingDirectory: '',
    environment: {},
    icon: 'TERM',
    color: '#58a6ff'
  });

  $('#terminal-profile-name').value = normalized.name;
  $('#terminal-profile-kind').value = normalized.kind;
  $('#terminal-profile-executable').value = normalized.executable;
  $('#terminal-profile-args').value = normalized.args.join('\n');
  $('#terminal-profile-working-directory').value = normalized.workingDirectory;
  $('#terminal-profile-icon').value = normalized.icon;
  $('#terminal-profile-color').value = normalized.color || '#58a6ff';
  $('#terminal-profile-color-text').value = normalized.color || '#58a6ff';
  $('#terminal-profile-environment').value = terminalProfileEnvironmentToText(normalized.environment);
  $('#terminal-profile-default').checked = Boolean(
    normalized.id && normalized.id === getDefaultTerminalProfileId()
  );
}

function loadTerminalProfileIntoManager(profileId) {
  const profile = getTerminalProfileById(profileId);

  if (!profile) {
    return;
  }

  state.editingTerminalProfileId = profile.id;
  fillTerminalProfileForm(profile);
  renderTerminalProfileList();
}

function newTerminalProfileFromManager() {
  state.editingTerminalProfileId = null;
  fillTerminalProfileForm();
  renderTerminalProfileList();
  $('#terminal-profile-name')?.select();
}

async function saveTerminalProfileFromManager(options = {}) {
  if (!state.settings) {
    return null;
  }

  const name = String($('#terminal-profile-name')?.value || '').trim();
  const kind = String($('#terminal-profile-kind')?.value || 'custom').trim();
  const executable = String($('#terminal-profile-executable')?.value || '').trim();
  const workingDirectory = String($('#terminal-profile-working-directory')?.value || '').trim();
  const icon = Array.from(String($('#terminal-profile-icon')?.value || '').trim()).slice(0, 4).join('');
  const colorText = String($('#terminal-profile-color-text')?.value || $('#terminal-profile-color')?.value || '').trim();
  const color = /^#[0-9a-f]{6}$/i.test(colorText)
    ? colorText.toLowerCase()
    : String($('#terminal-profile-color')?.value || '#58a6ff').toLowerCase();
  const args = String($('#terminal-profile-args')?.value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);
  const environmentResult = parseTerminalProfileEnvironment($('#terminal-profile-environment')?.value || '');

  if (!name) {
    showToast('Terminal profile needs a name.', 4500, 'warning');
    $('#terminal-profile-name')?.focus();
    return null;
  }

  if (!executable) {
    showToast('Terminal profile needs an executable.', 5000, 'warning');
    $('#terminal-profile-executable')?.focus();
    return null;
  }

  if (!environmentResult.ok) {
    showToast(environmentResult.error, 6500, 'warning');
    $('#terminal-profile-environment')?.focus();
    return null;
  }

  const profile = normalizeTerminalProfileClient({
    id: state.editingTerminalProfileId || randomId('profile'),
    name,
    kind,
    executable,
    args,
    workingDirectory,
    environment: environmentResult.environment,
    icon: icon || terminalProfileDefaultIcon(kind),
    color
  });

  const profiles = getTerminalProfiles();
  const index = profiles.findIndex((item) => item.id === profile.id);

  if (index >= 0) {
    profiles[index] = profile;
  } else {
    profiles.push(profile);
  }

  state.settings.terminalProfiles = profiles;

  if ($('#terminal-profile-default')?.checked || !getDefaultTerminalProfileId()) {
    state.settings.defaultTerminalProfileId = profile.id;
  }

  state.settings = await saveSettingsNow({ refresh: false });
  state.editingTerminalProfileId = profile.id;

  renderTerminalProfileList();
  fillTerminalProfileForm(getTerminalProfileById(profile.id));
  renderTerminalProfileQuickMenu();
  populateLocalProfileDropdown();

  if (options.showToast !== false) {
    showToast('Terminal profile saved.', 3500, 'success');
  }

  return getTerminalProfileById(profile.id);
}

async function duplicateTerminalProfileFromManager() {
  const selected = getTerminalProfileById(state.editingTerminalProfileId);

  if (!selected) {
    showToast('Select a Terminal Profile to duplicate.');
    return;
  }

  const duplicate = normalizeTerminalProfileClient({
    ...selected,
    id: randomId('profile'),
    name: `${selected.name} Copy`
  });

  state.settings.terminalProfiles = [...getTerminalProfiles(), duplicate];
  state.settings = await saveSettingsNow({ refresh: false });
  state.editingTerminalProfileId = duplicate.id;
  renderTerminalProfilesSettings();
  renderTerminalProfileQuickMenu();
  populateLocalProfileDropdown();
  showToast('Terminal profile duplicated.', 3500, 'success');
}

async function deleteTerminalProfileFromManager() {
  const selected = getTerminalProfileById(state.editingTerminalProfileId);
  const profiles = getTerminalProfiles();

  if (!selected) {
    showToast('Select a Terminal Profile to delete.');
    return;
  }

  if (profiles.length <= 1) {
    showToast('Keep at least one Terminal Profile.', 5000, 'warning');
    return;
  }

  const usedBy = (state.settings?.servers || []).filter(
    (server) => server.type === 'local' && server.profileId === selected.id
  );
  const nextProfile = profiles.find((profile) => profile.id !== selected.id);
  const usageMessage = usedBy.length
    ? `\n\n${usedBy.length} Local connection(s) use this profile. They will be reassigned to "${nextProfile.name}".`
    : '';
  const confirmed = await showConfirmDialog({
    title: 'Delete Terminal Profile?',
    message: `Delete "${selected.name}"?${usageMessage}`,
    confirmLabel: 'Delete Profile',
    cancelLabel: 'Cancel'
  });

  if (!confirmed) {
    return;
  }

  state.settings.terminalProfiles = profiles.filter((profile) => profile.id !== selected.id);
  state.settings.servers = (state.settings.servers || []).map((server) => {
    if (server.type === 'local' && server.profileId === selected.id) {
      return { ...server, profileId: nextProfile.id };
    }

    return server;
  });

  if (state.settings.defaultTerminalProfileId === selected.id) {
    state.settings.defaultTerminalProfileId = nextProfile.id;
  }

  state.settings = await saveSettingsNow({ refresh: false });
  state.editingTerminalProfileId = nextProfile.id;
  renderTerminalProfilesSettings();
  renderTerminalProfileQuickMenu();
  populateLocalProfileDropdown();
  renderServerList();
  renderTerminalToolbarActions();
  showToast('Terminal profile deleted.', 3500, 'success');
}

function renderDetectedTerminalShells() {
  const wrap = $('#terminal-profile-detection-results');

  if (!wrap) {
    return;
  }

  const shells = Array.isArray(state.detectedTerminalShells) ? state.detectedTerminalShells : [];
  wrap.innerHTML = '';
  wrap.classList.toggle('hidden', !shells.length);

  shells.forEach((shellInfo) => {
    const row = document.createElement('div');
    const name = document.createElement('strong');
    const executable = document.createElement('code');
    const button = document.createElement('button');

    row.className = `terminal-profile-detection-row ${shellInfo.available ? '' : 'unavailable'}`;
    name.textContent = `${shellInfo.name}${shellInfo.available ? '' : ' — not detected'}`;
    executable.textContent = shellInfo.executable || 'Not found';

    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = shellInfo.available ? 'Use' : 'Use Path';
    button.addEventListener('click', () => {
      $('#terminal-profile-kind').value = shellInfo.kind || 'custom';
      $('#terminal-profile-executable').value = shellInfo.executable || '';
      if (!String($('#terminal-profile-icon').value || '').trim()) {
        $('#terminal-profile-icon').value = terminalProfileDefaultIcon(shellInfo.kind);
      }
      if (shellInfo.kind === 'git-bash' && !String($('#terminal-profile-args').value || '').trim()) {
        $('#terminal-profile-args').value = '--login\n-i';
      }
      showToast(`${shellInfo.name} applied to the profile editor.`, 3000, 'success');
    });

    row.append(name, executable, button);
    wrap.appendChild(row);
  });
}

async function detectTerminalShellsForProfiles() {
  if (!window.advanceTerminal?.detectTerminalProfileShells) {
    showToast('Shell detection is not available in this build.', 5000, 'warning');
    return;
  }

  const result = await window.advanceTerminal.detectTerminalProfileShells();

  if (!result?.ok) {
    showToast(result?.error || 'Could not detect installed shells.', 6000, 'error');
    return;
  }

  state.detectedTerminalShells = Array.isArray(result.shells) ? result.shells : [];
  renderDetectedTerminalShells();
  const available = state.detectedTerminalShells.filter((item) => item.available).length;
  showToast(`Shell detection finished: ${available} available.`, 3500, available ? 'success' : 'warning');
}

function renderTerminalProfilesSettings() {
  if (!state.settings) {
    return;
  }

  const profiles = getTerminalProfiles();

  if (!state.editingTerminalProfileId || !getTerminalProfileById(state.editingTerminalProfileId)) {
    state.editingTerminalProfileId = getDefaultTerminalProfileId() || profiles[0]?.id || null;
  }

  renderTerminalProfileList();
  fillTerminalProfileForm(getTerminalProfileById(state.editingTerminalProfileId));
  renderDetectedTerminalShells();
}

async function launchTerminalProfile(profileId, options = {}) {
  const profile = getTerminalProfileById(profileId || getDefaultTerminalProfileId());
  const requestedWorkingDirectory = normalizeTerminalLocation(options?.workingDirectory || '');

  if (!profile) {
    showToast('Create a Terminal Profile first.', 5000, 'warning');
    setActiveView('settings', 'settings');
    setSettingsTab('terminal-profiles');
    return;
  }

  if (!profile.executable) {
    showToast(`Profile "${profile.name}" has no executable.`, 5500, 'warning');
    setActiveView('settings', 'settings');
    setSettingsTab('terminal-profiles');
    loadTerminalProfileIntoManager(profile.id);
    return;
  }

  const connectingSession = getConnectingTerminalSession();

  if (connectingSession) {
    showConnectionAttemptBusyNotification(connectingSession, { name: profile.name });
    return;
  }

  if (state.connectionAttemptInFlight) {
    showToast('A terminal is already being opened. Please wait.', 4500, 'warning');
    return;
  }

  state.connectionAttemptInFlight = true;
  updateTerminalInteractionState();
  setActiveView('terminal', 'terminal');

  const terminalId = randomId('term');
  const server = {
    id: `terminal-profile:${profile.id}`,
    type: 'local',
    name: profile.name,
    description: 'Terminal Profile',
    group: 'Profiles',
    profileId: profile.id,
    workingDirectory: requestedWorkingDirectory || profile.workingDirectory || ''
  };
  let session = null;

  try {
    session = createTerminalPane(terminalId, server);
    session.workspaceRestoreWorkingDirectory = server.type === 'remote'
      ? requestedWorkingDirectory
      : '';
    session.status = 'connecting';
    setTerminalStatus('connecting');
    showToast(`Opening ${profile.name}...`, 3000, 'info');

    fitTerminalSessionNow(session, { notifyBackend: false });
    const initialSize = getTerminalSize(session);
    const result = await window.advanceTerminal.createTerminal({
      terminalId,
      profileId: profile.id,
      workingDirectory: requestedWorkingDirectory,
      cols: initialSize.cols,
      rows: initialSize.rows
    });

    if (!result?.ok) {
      const error = new Error(result?.error || 'Terminal profile could not be started.');
      error.code = result?.code || 'TERMINAL_PROFILE_CREATE_FAILED';
      throw error;
    }

    fitTerminalSession(session, { delays: [0, 120, 360] });
    session.closed = false;
    session.manualClose = false;
    session.hasConnected = true;
    session.status = 'connected';
    session.report = ensureSessionReport(session);
    session.report.connectedAt = session.report.connectedAt || Date.now();
    session.report.lastUsageCheckpointAt = Date.now();
    session.connectionReadyNotified = true;

    setTerminalStatus('connected');
    recordDailySessionStarted(session);
    recordSessionEvent(session, `Terminal Profile opened: ${profile.name}`, 'success');
    showTerminalSession(session);
    renderTerminalTabs();
    showToast(`${profile.name} is connected.`, 3500, 'success');
    return session;
  } catch (error) {
    if (session) {
      session.term.writeln(`Terminal profile failed: ${error.message}`);
      recordSessionEvent(session, `Terminal profile failed: ${error.message}`, 'error');
      session.closed = true;
      session.status = 'error';
      showTerminalSession(session);
      renderTerminalTabs();
    }

    setTerminalStatus('error');
    showToast(`Terminal profile failed: ${error.message}`, 7000, 'error');
  } finally {
    state.connectionAttemptInFlight = false;
    updateTerminalInteractionState();
  }

  return null;
}


function getWorkspaces() {
  if (!state.settings) {
    return [];
  }

  if (!Array.isArray(state.settings.workspaces)) {
    state.settings.workspaces = [];
  }

  return state.settings.workspaces;
}

function getWorkspaceById(workspaceId) {
  return getWorkspaces().find((workspace) => workspace.id === workspaceId) || null;
}

function cloneWorkspaceData(value) {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value;
  }
}

function nextWorkspaceName() {
  const names = new Set(getWorkspaces().map((workspace) => String(workspace.name || '').toLocaleLowerCase()));
  let index = getWorkspaces().length + 1;
  let name = `Workspace ${index}`;

  while (names.has(name.toLocaleLowerCase())) {
    index += 1;
    name = `Workspace ${index}`;
  }

  return name;
}

function workspaceDisplayDate(value) {
  const time = Date.parse(String(value || ''));

  if (!Number.isFinite(time)) {
    return 'Not saved yet';
  }

  return new Date(time).toLocaleString();
}

function workspaceSessionTarget(item) {
  if (!item) {
    return null;
  }

  if (item.kind === 'profile') {
    const profile = getTerminalProfileById(item.profileId);

    return profile
      ? { kind: 'profile', profile, type: 'local', label: profile.name || item.label || 'Terminal Profile' }
      : null;
  }

  const server = state.settings?.servers?.find((candidate) => candidate.id === item.serverId) || null;

  return server
    ? { kind: 'connection', server, type: server.type === 'remote' ? 'remote' : 'local', label: server.name || item.label || 'Connection' }
    : null;
}

function workspaceSessionFromTerminal(session) {
  if (!session || session.closed) {
    return null;
  }

  const server = session.server || {};
  const savedServer = state.settings?.servers?.find((candidate) => candidate.id === server.id) || null;
  const explicitProfileId = String(server.profileId || '').trim();
  const parsedProfileId = String(server.id || '').startsWith('terminal-profile:')
    ? String(server.id).slice('terminal-profile:'.length)
    : '';
  const profileId = explicitProfileId || parsedProfileId;
  const profile = profileId ? getTerminalProfileById(profileId) : null;

  if (savedServer) {
    return {
      kind: 'connection',
      serverId: savedServer.id,
      profileId: '',
      type: savedServer.type === 'remote' ? 'remote' : 'local',
      label: savedServer.name || server.name || 'Connection',
      workingDirectory: normalizeTerminalLocation(session.currentLocation || server.workingDirectory || savedServer.workingDirectory || '')
    };
  }

  if (profile) {
    return {
      kind: 'profile',
      serverId: '',
      profileId: profile.id,
      type: 'local',
      label: profile.name || server.name || 'Terminal Profile',
      workingDirectory: normalizeTerminalLocation(session.currentLocation || server.workingDirectory || profile.workingDirectory || '')
    };
  }

  return null;
}


function getWorkspaceOrderedTerminalSessions() {
  const ordered = [];
  const seen = new Set();

  state.terminalGroups.forEach((group) => {
    splitGroupTerminalIds(group).forEach((terminalId) => {
      const session = state.terminals.get(terminalId);

      if (!session || session.closed || seen.has(terminalId)) {
        return;
      }

      seen.add(terminalId);
      ordered.push(session);
    });
  });

  state.terminals.forEach((session, terminalId) => {
    if (!session || session.closed || seen.has(terminalId)) {
      return;
    }

    seen.add(terminalId);
    ordered.push(session);
  });

  return ordered;
}

function captureWorkspaceSplitGroups(sessionIndexByTerminalId) {
  const groups = [];

  state.terminalGroups.forEach((group) => {
    const root = serializeWorkspaceSplitNode(group.root, sessionIndexByTerminalId);

    if (!root) {
      return;
    }

    const activeSessionIndex = sessionIndexByTerminalId.get(group.activeTerminalId);
    const fallbackTerminalId = splitGroupTerminalIds(group)
      .find((terminalId) => sessionIndexByTerminalId.has(terminalId));
    const fallbackIndex = sessionIndexByTerminalId.get(fallbackTerminalId);

    groups.push({
      root,
      activeSessionIndex: Number.isInteger(activeSessionIndex) ? activeSessionIndex : fallbackIndex,
      title: normalizeTerminalTabTitle(group.title),
      color: normalizeTerminalTabColor(group.color),
      pinned: group.pinned === true
    });
  });

  return groups;
}

function workspaceSavedTabCount(workspace) {
  const groups = Array.isArray(workspace?.splitGroups) ? workspace.splitGroups : [];
  return groups.length || (workspace?.sessions?.length || 0);
}

function workspaceSavedPaneCount(workspace) {
  return workspace?.sessions?.length || 0;
}

function workspaceSplitSessionIndexes(node, result = []) {
  if (!node) return result;

  if (node.type === 'leaf') {
    if (Number.isInteger(Number(node.sessionIndex))) {
      result.push(Number(node.sessionIndex));
    }
    return result;
  }

  workspaceSplitSessionIndexes(node.first, result);
  workspaceSplitSessionIndexes(node.second, result);
  return result;
}

function workspaceSessionLayoutLabel(workspace, sessionIndex) {
  const groups = Array.isArray(workspace?.splitGroups) ? workspace.splitGroups : [];

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const indexes = workspaceSplitSessionIndexes(groups[groupIndex]?.root, []);
    const paneIndex = indexes.indexOf(sessionIndex);

    if (paneIndex >= 0) {
      return `Tab ${groupIndex + 1} · Pane ${paneIndex + 1}`;
    }
  }

  return `Tab ${sessionIndex + 1}`;
}

async function captureWorkspaceSnapshot({
  id = '',
  name = '',
  includeToolbar = true,
  restoreWindowState = true,
  createdAt = ''
} = {}) {
  const now = new Date().toISOString();
  const terminalSessions = getWorkspaceOrderedTerminalSessions();
  const sessions = [];
  const sessionIndexByTerminalId = new Map();
  let activeSessionIndex = -1;
  let omitted = 0;

  terminalSessions.forEach((session) => {
    const item = workspaceSessionFromTerminal(session);

    if (!item) {
      omitted += 1;
      return;
    }

    const sessionIndex = sessions.length;
    sessionIndexByTerminalId.set(session.terminalId, sessionIndex);

    if (session.terminalId === state.activeTerminalId) {
      activeSessionIndex = sessionIndex;
    }

    sessions.push(item);
  });

  if (sessions.length && activeSessionIndex < 0) {
    activeSessionIndex = 0;
  }

  const splitGroups = captureWorkspaceSplitGroups(sessionIndexByTerminalId);

  let windowState = null;

  if (window.advanceTerminal?.getWorkspaceWindowState) {
    try {
      const result = await window.advanceTerminal.getWorkspaceWindowState();
      windowState = result?.ok === true ? result.state : result;
    } catch (error) {
      appendActivityFeedEvent(`Workspace window state could not be read: ${error.message}`, 'warning', { dedupeMs: 1200 });
    }
  }

  return {
    id: id || randomId('workspace'),
    name: String(name || nextWorkspaceName()).trim().slice(0, 100) || nextWorkspaceName(),
    sessions,
    activeSessionIndex,
    splitGroups,
    includeToolbar: includeToolbar !== false,
    restoreWindowState: restoreWindowState !== false,
    toolbarActions: includeToolbar !== false
      ? cloneWorkspaceData(state.settings?.terminalActions || [])
      : [],
    windowState: windowState || {},
    createdAt: createdAt || now,
    updatedAt: now,
    omitted
  };
}

async function saveCurrentWorkspaceQuick() {
  if (state.workspaceRestoreInFlight) {
    showToast('Wait for the current workspace restore to finish.', 4000, 'warning');
    return null;
  }

  const active = getWorkspaceById(state.activeWorkspaceId);
  const snapshot = await captureWorkspaceSnapshot({
    id: active?.id || '',
    name: active?.name || nextWorkspaceName(),
    includeToolbar: active?.includeToolbar !== false,
    restoreWindowState: active?.restoreWindowState !== false,
    createdAt: active?.createdAt || ''
  });

  if (!snapshot.sessions.length && state.terminals.size) {
    showToast('No restorable terminal tabs were found. Only saved connections and Terminal Profiles can be captured.', 6500, 'warning');
    return null;
  }

  const isStartup = Boolean(active && state.settings?.startupWorkspaceId === active.id);
  const persisted = await persistWorkspaceRecord(snapshot, {
    startup: isStartup,
    toastMessage: active
      ? `Workspace "${snapshot.name}" updated.`
      : `Workspace "${snapshot.name}" saved.`
  });

  state.activeWorkspaceId = persisted?.id || snapshot.id;
  state.editingWorkspaceId = state.activeWorkspaceId;
  state.workspaceDraftMode = false;
  renderWorkspaceQuickMenu();

  if (state.activeSettingsTab === 'workspaces') {
    renderWorkspaceSettings();
  }

  if (snapshot.omitted) {
    showToast(
      `${snapshot.name} saved. ${snapshot.omitted} unsupported transient tab${snapshot.omitted === 1 ? ' was' : 's were'} skipped.`,
      6500,
      'warning'
    );
  }

  appendActivityFeedEvent(
    `Workspace saved: ${snapshot.name} (${snapshot.splitGroups?.length || snapshot.sessions.length} tab${(snapshot.splitGroups?.length || snapshot.sessions.length) === 1 ? '' : 's'} · ${snapshot.sessions.length} pane${snapshot.sessions.length === 1 ? '' : 's'}).`,
    'action',
    { dedupeMs: 1000 }
  );

  return persisted;
}

function workspaceFormOptions() {
  return {
    name: String($('#workspace-name')?.value || '').trim().slice(0, 100),
    startup: $('#workspace-startup')?.checked === true,
    includeToolbar: $('#workspace-include-toolbar')?.checked !== false,
    restoreWindowState: $('#workspace-restore-window')?.checked !== false
  };
}

async function persistWorkspaceRecord(workspace, { startup = false, toastMessage = '' } = {}) {
  if (!state.settings || !workspace) {
    return null;
  }

  const workspaces = getWorkspaces();
  const index = workspaces.findIndex((item) => item.id === workspace.id);

  if (index >= 0) {
    workspaces[index] = workspace;
  } else {
    workspaces.push(workspace);
  }

  state.settings.workspaces = workspaces;

  if (startup) {
    state.settings.startupWorkspaceId = workspace.id;
  } else if (state.settings.startupWorkspaceId === workspace.id) {
    state.settings.startupWorkspaceId = '';
  }

  await saveSettingsNow({ refresh: false });
  state.editingWorkspaceId = workspace.id;
  state.workspaceDraftMode = false;
  renderWorkspaceQuickMenu();

  if (state.activeSettingsTab === 'workspaces') {
    renderWorkspaceSettings();
  }

  if (toastMessage) {
    showToast(toastMessage, 4200, 'success');
  }

  return getWorkspaceById(workspace.id) || workspace;
}

function renderWorkspaceList() {
  const list = $('#workspace-list');

  if (!list) {
    return;
  }

  const workspaces = getWorkspaces();
  list.innerHTML = '';

  workspaces.forEach((workspace) => {
    const targetCount = (workspace.sessions || []).filter((item) => Boolean(workspaceSessionTarget(item))).length;
    const missingCount = Math.max(0, (workspace.sessions || []).length - targetCount);
    const button = document.createElement('button');
    const icon = document.createElement('span');
    const main = document.createElement('span');
    const name = document.createElement('strong');
    const meta = document.createElement('small');
    const badge = document.createElement('span');

    button.type = 'button';
    button.className = `workspace-list-item ${workspace.id === state.editingWorkspaceId && !state.workspaceDraftMode ? 'active' : ''}`;
    button.dataset.workspaceId = workspace.id;

    icon.className = 'workspace-list-icon';
    icon.textContent = 'WS';

    main.className = 'workspace-list-main';
    name.textContent = workspace.name || 'Workspace';
    const tabCount = workspaceSavedTabCount(workspace);
    const paneCount = workspaceSavedPaneCount(workspace);
    meta.textContent = `${tabCount} tab${tabCount === 1 ? '' : 's'} · ${paneCount} pane${paneCount === 1 ? '' : 's'} · ${workspaceDisplayDate(workspace.updatedAt)}`;
    main.append(name, meta);

    badge.className = 'workspace-startup-badge';
    if (state.settings?.startupWorkspaceId === workspace.id) {
      badge.textContent = 'Startup';
    } else if (missingCount) {
      badge.textContent = `${missingCount} missing`;
      badge.classList.add('missing');
    } else if (state.activeWorkspaceId === workspace.id) {
      badge.textContent = 'Active';
    } else {
      badge.textContent = '';
    }

    button.append(icon, main, badge);
    button.addEventListener('click', () => {
      state.editingWorkspaceId = workspace.id;
      state.workspaceDraftMode = false;
      renderWorkspaceSettings();
    });
    list.appendChild(button);
  });

  if (!workspaces.length) {
    const empty = document.createElement('div');
    empty.className = 'workspace-session-empty';
    empty.textContent = 'No workspaces saved yet.';
    list.appendChild(empty);
  }
}

function renderWorkspaceSessionPreview(workspace) {
  const list = $('#workspace-session-list');

  if (!list) {
    return;
  }

  list.innerHTML = '';
  const sessions = Array.isArray(workspace?.sessions) ? workspace.sessions : [];

  if (!sessions.length) {
    const empty = document.createElement('div');
    empty.className = 'workspace-session-empty';
    empty.textContent = state.workspaceDraftMode
      ? 'Capture the current terminal state to add tabs to this workspace.'
      : 'This workspace does not contain terminal tabs or panes.';
    list.appendChild(empty);
    return;
  }

  sessions.forEach((item, index) => {
    const target = workspaceSessionTarget(item);
    const row = document.createElement('div');
    const order = document.createElement('span');
    const main = document.createElement('span');
    const name = document.createElement('strong');
    const meta = document.createElement('small');
    const badge = document.createElement('span');

    row.className = 'workspace-session-row';
    order.className = 'workspace-session-index';
    order.textContent = String(index + 1);

    main.className = 'workspace-session-copy';
    name.textContent = target?.label || item.label || (item.kind === 'profile' ? 'Missing Terminal Profile' : 'Missing Connection');
    const location = String(item.workingDirectory || '').trim();
    meta.textContent = [
      workspaceSessionLayoutLabel(workspace, index),
      item.kind === 'profile' ? 'Terminal Profile' : (item.type === 'remote' ? 'SSH' : 'Local'),
      location || 'Default folder'
    ].join(' · ');
    main.append(name, meta);

    badge.className = `workspace-session-state ${target ? '' : 'missing'}`;
    if (!target) {
      badge.textContent = 'Missing';
    } else if (index === Number(workspace.activeSessionIndex)) {
      badge.textContent = 'Active';
    } else {
      badge.textContent = item.type === 'remote' ? 'SSH' : 'Local';
    }

    row.append(order, main, badge);
    list.appendChild(row);
  });
}

function renderWorkspaceSettings() {
  if (!state.settings) {
    return;
  }

  const workspaces = getWorkspaces();

  if (!state.workspaceDraftMode && (!state.editingWorkspaceId || !getWorkspaceById(state.editingWorkspaceId))) {
    state.editingWorkspaceId = workspaces[0]?.id || null;
  }

  renderWorkspaceList();

  const workspace = state.workspaceDraftMode
    ? null
    : getWorkspaceById(state.editingWorkspaceId);
  const nameInput = $('#workspace-name');
  const startupInput = $('#workspace-startup');
  const toolbarInput = $('#workspace-include-toolbar');
  const windowInput = $('#workspace-restore-window');
  const summary = $('#workspace-summary');
  const duplicateButton = $('#workspace-duplicate');
  const deleteButton = $('#workspace-delete');
  const openButton = $('#workspace-open');

  if (state.workspaceDraftMode) {
    if (nameInput && !nameInput.value) {
      nameInput.value = nextWorkspaceName();
    }

    if (startupInput) startupInput.checked = false;
    if (toolbarInput) toolbarInput.checked = true;
    if (windowInput) windowInput.checked = true;
    if (summary) summary.textContent = 'New workspace. Capture the current terminal state to save its tab and split-pane layout.';
    renderWorkspaceSessionPreview(null);
  } else if (workspace) {
    if (nameInput) nameInput.value = workspace.name || '';
    if (startupInput) startupInput.checked = state.settings.startupWorkspaceId === workspace.id;
    if (toolbarInput) toolbarInput.checked = workspace.includeToolbar !== false;
    if (windowInput) windowInput.checked = workspace.restoreWindowState !== false;

    const missing = (workspace.sessions || []).filter((item) => !workspaceSessionTarget(item)).length;
    const details = [
      `${workspaceSavedTabCount(workspace)} saved tab${workspaceSavedTabCount(workspace) === 1 ? '' : 's'} · ${workspaceSavedPaneCount(workspace)} pane${workspaceSavedPaneCount(workspace) === 1 ? '' : 's'}`,
      `updated ${workspaceDisplayDate(workspace.updatedAt)}`
    ];

    if (workspace.includeToolbar !== false) details.push('toolbar saved');
    if (workspace.restoreWindowState !== false) details.push('window placement saved');
    if (missing) details.push(`${missing} missing target${missing === 1 ? '' : 's'}`);

    if (summary) summary.textContent = details.join(' · ');
    renderWorkspaceSessionPreview(workspace);
  } else {
    if (nameInput) nameInput.value = '';
    if (startupInput) startupInput.checked = false;
    if (toolbarInput) toolbarInput.checked = true;
    if (windowInput) windowInput.checked = true;
    if (summary) summary.textContent = 'No workspace selected. Save the current terminal state to create one.';
    renderWorkspaceSessionPreview(null);
  }

  if (duplicateButton) duplicateButton.disabled = !workspace || state.workspaceDraftMode;
  if (deleteButton) deleteButton.disabled = !workspace || state.workspaceDraftMode;
  if (openButton) openButton.disabled = !workspace || state.workspaceDraftMode || !(workspace.sessions || []).length;
}

function newWorkspaceFromManager() {
  state.workspaceDraftMode = true;
  state.editingWorkspaceId = null;
  renderWorkspaceSettings();

  const nameInput = $('#workspace-name');
  if (nameInput) {
    nameInput.value = nextWorkspaceName();
    nameInput.focus();
    nameInput.select();
  }
}

async function captureWorkspaceFromManager() {
  if (state.workspaceRestoreInFlight) {
    showToast('Wait for the current workspace restore to finish.', 4000, 'warning');
    return null;
  }

  const options = workspaceFormOptions();
  const existing = state.workspaceDraftMode ? null : getWorkspaceById(state.editingWorkspaceId);
  const snapshot = await captureWorkspaceSnapshot({
    id: existing?.id || '',
    name: options.name || existing?.name || nextWorkspaceName(),
    includeToolbar: options.includeToolbar,
    restoreWindowState: options.restoreWindowState,
    createdAt: existing?.createdAt || ''
  });

  if (!snapshot.sessions.length && state.terminals.size) {
    showToast('No restorable terminal tabs were found. Only saved connections and Terminal Profiles can be captured.', 6500, 'warning');
    return null;
  }

  const persisted = await persistWorkspaceRecord(snapshot, {
    startup: options.startup,
    toastMessage: existing ? `Workspace "${snapshot.name}" updated.` : `Workspace "${snapshot.name}" saved.`
  });

  state.activeWorkspaceId = persisted?.id || snapshot.id;

  if (snapshot.omitted) {
    showToast(
      `${snapshot.name} saved. ${snapshot.omitted} unsupported transient tab${snapshot.omitted === 1 ? ' was' : 's were'} skipped.`,
      6500,
      'warning'
    );
  }

  renderWorkspaceQuickMenu();
  renderWorkspaceSettings();
  appendActivityFeedEvent(`Workspace saved: ${snapshot.name} (${snapshot.splitGroups?.length || snapshot.sessions.length} tab${(snapshot.splitGroups?.length || snapshot.sessions.length) === 1 ? '' : 's'} · ${snapshot.sessions.length} pane${snapshot.sessions.length === 1 ? '' : 's'}).`, 'action', { dedupeMs: 1000 });
  return persisted;
}

async function saveWorkspaceDetailsFromManager() {
  if (state.workspaceDraftMode) {
    return captureWorkspaceFromManager();
  }

  const workspace = getWorkspaceById(state.editingWorkspaceId);

  if (!workspace) {
    return captureWorkspaceFromManager();
  }

  const options = workspaceFormOptions();
  const updated = {
    ...cloneWorkspaceData(workspace),
    name: options.name || workspace.name || 'Workspace',
    includeToolbar: options.includeToolbar,
    restoreWindowState: options.restoreWindowState,
    updatedAt: new Date().toISOString()
  };

  if (!options.includeToolbar) {
    updated.toolbarActions = [];
  } else if (workspace.includeToolbar === false) {
    updated.toolbarActions = cloneWorkspaceData(state.settings?.terminalActions || []);
  }

  await persistWorkspaceRecord(updated, {
    startup: options.startup,
    toastMessage: `Workspace "${updated.name}" details saved.`
  });

  return updated;
}

async function duplicateWorkspaceFromManager() {
  const workspace = getWorkspaceById(state.editingWorkspaceId);

  if (!workspace || state.workspaceDraftMode) {
    return;
  }

  const now = new Date().toISOString();
  const duplicate = {
    ...cloneWorkspaceData(workspace),
    id: randomId('workspace'),
    name: `${workspace.name || 'Workspace'} Copy`.slice(0, 100),
    createdAt: now,
    updatedAt: now
  };

  await persistWorkspaceRecord(duplicate, {
    startup: false,
    toastMessage: `Workspace duplicated as "${duplicate.name}".`
  });
}

async function deleteWorkspaceFromManager() {
  const workspace = getWorkspaceById(state.editingWorkspaceId);

  if (!workspace || state.workspaceDraftMode) {
    return;
  }

  const confirmed = await showConfirmDialog({
    title: 'Delete Workspace?',
    message: `Delete "${workspace.name}"? This removes only the saved workspace layout. Connections, profiles, and terminal data are not deleted.`,
    confirmLabel: 'Delete Workspace',
    cancelLabel: 'Cancel'
  });

  if (!confirmed) {
    return;
  }

  state.settings.workspaces = getWorkspaces().filter((item) => item.id !== workspace.id);

  if (state.settings.startupWorkspaceId === workspace.id) {
    state.settings.startupWorkspaceId = '';
  }

  if (state.activeWorkspaceId === workspace.id) {
    state.activeWorkspaceId = null;
  }

  state.editingWorkspaceId = state.settings.workspaces[0]?.id || null;
  state.workspaceDraftMode = false;
  await saveSettingsNow({ refresh: false });
  renderWorkspaceQuickMenu();
  renderWorkspaceSettings();
  showToast(`Workspace "${workspace.name}" deleted.`, 4000, 'success');
}

function closeWorkspaceQuickMenu() {
  const menu = $('#workspace-quick-menu');

  if (menu) {
    menu.classList.add('hidden');
    menu.style.removeProperty('left');
    menu.style.removeProperty('top');
  }
}

function renderWorkspaceQuickMenu() {
  const menu = $('#workspace-quick-menu');

  if (!menu || !state.settings) {
    return;
  }

  menu.innerHTML = '';

  const heading = document.createElement('div');
  heading.className = 'terminal-profile-quick-heading';
  heading.textContent = 'Workspaces';
  menu.appendChild(heading);

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'terminal-profile-quick-item workspace-quick-item workspace-quick-action';
  saveButton.innerHTML = '<span class="terminal-profile-quick-icon">＋</span><span><strong></strong><small></small></span>';
  saveButton.querySelector('strong').textContent = state.activeWorkspaceId && getWorkspaceById(state.activeWorkspaceId)
    ? `Update ${getWorkspaceById(state.activeWorkspaceId).name}`
    : 'Save Current Workspace';
  saveButton.querySelector('small').textContent = 'Capture the current tab/split layout, folders, toolbar and window placement.';
  saveButton.addEventListener('click', async () => {
    closeWorkspaceQuickMenu();
    await saveCurrentWorkspaceQuick();
  });
  menu.appendChild(saveButton);

  const workspaces = getWorkspaces();

  if (workspaces.length) {
    const divider = document.createElement('div');
    divider.className = 'terminal-profile-quick-divider workspace-quick-divider';
    menu.appendChild(divider);
  }

  workspaces.forEach((workspace) => {
    const button = document.createElement('button');
    const icon = document.createElement('span');
    const main = document.createElement('span');
    const name = document.createElement('strong');
    const meta = document.createElement('small');

    button.type = 'button';
    button.className = 'terminal-profile-quick-item workspace-quick-item';
    button.dataset.workspaceId = workspace.id;

    icon.className = 'terminal-profile-quick-icon';
    icon.textContent = 'WS';

    name.textContent = workspace.name || 'Workspace';
    const tabCount = workspaceSavedTabCount(workspace);
    const paneCount = workspaceSavedPaneCount(workspace);
    meta.textContent = `${tabCount} tab${tabCount === 1 ? '' : 's'} · ${paneCount} pane${paneCount === 1 ? '' : 's'}${state.settings.startupWorkspaceId === workspace.id ? ' · Startup' : ''}`;
    main.append(name, meta);
    button.append(icon, main);

    button.addEventListener('click', () => {
      closeWorkspaceQuickMenu();
      restoreWorkspace(workspace.id).catch((error) => {
        showToast(`Workspace restore failed: ${error.message}`, 7000, 'error');
      });
    });

    menu.appendChild(button);
  });

  const divider = document.createElement('div');
  divider.className = 'terminal-profile-quick-divider workspace-quick-divider';
  const manage = document.createElement('button');
  manage.type = 'button';
  manage.className = 'terminal-profile-quick-item workspace-quick-item';
  manage.innerHTML = '<span class="terminal-profile-quick-icon">⚙</span><span><strong>Manage Workspaces</strong><small>Create, rename, duplicate or delete workspaces.</small></span>';
  manage.addEventListener('click', () => {
    closeWorkspaceQuickMenu();
    setActiveView('settings', 'settings');
    setSettingsTab('workspaces');
  });
  menu.append(divider, manage);
}

function toggleWorkspaceQuickMenu(anchor = $('#tool-quick-menu')) {
  const menu = $('#workspace-quick-menu');

  if (!menu || !anchor) {
    return;
  }

  if (!menu.classList.contains('hidden')) {
    closeWorkspaceQuickMenu();
    return;
  }

  closeQuickActionsMenu();
  closeTerminalProfileQuickMenu();
  closeCommandPalette({ restoreFocus: false });
  renderWorkspaceQuickMenu();
  menu.classList.remove('hidden');

  const rect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const gap = 6;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuRect.width - 8));
  const top = Math.max(8, Math.min(rect.bottom + gap, window.innerHeight - menuRect.height - 8));

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.querySelector('button')?.focus();
}

function delayWorkspace(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForWorkspaceSessionReady(session, timeoutMs = 90000) {
  if (!session || session.closed) {
    return false;
  }

  if (session.server?.type !== 'remote') {
    return session.status === 'connected';
  }

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (session.closed || session.status === 'error' || session.status === 'disconnected') {
      return false;
    }

    if (session.status === 'connected' && session.cleanSshStartupActive !== true) {
      return true;
    }

    await delayWorkspace(250);
  }

  return false;
}

async function closeAllTerminalSessionsForWorkspace() {
  const terminalIds = Array.from(state.terminals.keys());

  if (!terminalIds.length) {
    return;
  }

  for (const terminalId of terminalIds) {
    if (state.terminals.has(terminalId)) {
      await Promise.resolve(closeTerminalSession(terminalId));
    }
  }

  await delayWorkspace(60);
}

async function applyWorkspaceToolbar(workspace) {
  if (!workspace?.includeToolbar || !Array.isArray(workspace.toolbarActions)) {
    return;
  }

  state.settings.terminalActions = cloneWorkspaceData(workspace.toolbarActions);
  await saveSettingsNow({ refresh: false });
  renderTerminalToolbarActions();
}

async function restoreWorkspace(workspaceId, { startup = false } = {}) {
  const workspace = getWorkspaceById(workspaceId);

  if (!workspace) {
    showToast('Workspace no longer exists.', 4500, 'warning');
    return false;
  }

  if (state.workspaceRestoreInFlight) {
    showToast('A workspace restore is already running.', 4500, 'warning');
    return false;
  }

  const entries = (workspace.sessions || []).map((item, index) => ({
    item,
    index,
    target: workspaceSessionTarget(item)
  }));
  const validEntries = entries.filter((entry) => entry.target);

  if (!entries.length) {
    showToast(`Workspace "${workspace.name}" has no saved terminal tabs or panes.`, 5000, 'warning');
    return false;
  }

  if (!validEntries.length) {
    showToast(`Workspace "${workspace.name}" cannot be opened because all saved connections/profiles are missing.`, 7000, 'error');
    return false;
  }

  const currentPaneCount = Array.from(state.terminals.values()).filter((session) => !session.closed).length;
  const currentTabCount = Array.from(state.terminalGroups.values())
    .filter((group) => splitGroupTerminalIds(group).some((terminalId) => {
      const session = state.terminals.get(terminalId);
      return session && !session.closed;
    }))
    .length;

  if (!startup && currentPaneCount) {
    const confirmed = await showConfirmDialog({
      title: 'Open Workspace?',
      message: `Opening "${workspace.name}" will close ${currentTabCount} current tab${currentTabCount === 1 ? '' : 's'} (${currentPaneCount} pane${currentPaneCount === 1 ? '' : 's'}) and restore ${workspaceSavedTabCount(workspace)} saved tab${workspaceSavedTabCount(workspace) === 1 ? '' : 's'} (${validEntries.length} pane${validEntries.length === 1 ? '' : 's'}). Continue?`,
      confirmLabel: 'Open Workspace',
      cancelLabel: 'Cancel'
    });

    if (!confirmed) {
      return false;
    }
  }

  state.workspaceRestoreInFlight = true;
  document.body.classList.add('workspace-restore-active');
  closeWorkspaceQuickMenu();
  closeTerminalProfileQuickMenu();
  closeCommandPalette({ restoreFocus: false });

  let opened = 0;
  let skipped = entries.length - validEntries.length;
  const openedByOriginalIndex = new Map();
  let stopReason = '';

  try {
    await closeAllTerminalSessionsForWorkspace();

    if (workspace.restoreWindowState !== false && window.advanceTerminal?.applyWorkspaceWindowState) {
      try {
        await window.advanceTerminal.applyWorkspaceWindowState(workspace.windowState || {});
        await delayWorkspace(80);
      } catch (error) {
        appendActivityFeedEvent(`Workspace window placement skipped: ${error.message}`, 'warning', { dedupeMs: 1200 });
      }
    }

    await applyWorkspaceToolbar(workspace);
    setActiveView('terminal', 'terminal');

    for (let entryIndex = 0; entryIndex < validEntries.length; entryIndex += 1) {
      const entry = validEntries[entryIndex];
      const { item, target } = entry;
      let session = null;

      if (target.kind === 'profile') {
        session = await launchTerminalProfile(target.profile.id, {
          workingDirectory: item.workingDirectory || '',
          workspaceRestore: true
        });
      } else {
        selectServer(target.server.id);
        session = await connectSelectedServer({
          workingDirectory: item.workingDirectory || '',
          workspaceRestore: true
        });
      }

      if (!session) {
        skipped += 1;
        continue;
      }

      opened += 1;
      openedByOriginalIndex.set(entry.index, session.terminalId);

      if (session.server?.type === 'remote') {
        const ready = await waitForWorkspaceSessionReady(session);

        if (!ready) {
          stopReason = `SSH session "${session.server?.name || 'SSH'}" did not become ready, so remaining tabs were not opened to avoid overlapping connection attempts.`;
          skipped += Math.max(0, validEntries.length - entryIndex - 1);
          break;
        }
      }

      await delayWorkspace(40);
    }

    restoreWorkspaceSplitLayout(workspace, openedByOriginalIndex);

    const preferredTerminalId = openedByOriginalIndex.get(Number(workspace.activeSessionIndex));
    const fallbackTerminalId = Array.from(openedByOriginalIndex.values())[0] || null;

    if (preferredTerminalId && state.terminals.has(preferredTerminalId)) {
      activateTerminal(preferredTerminalId);
    } else if (fallbackTerminalId && state.terminals.has(fallbackTerminalId)) {
      activateTerminal(fallbackTerminalId);
    }

    state.activeWorkspaceId = workspace.id;
    state.editingWorkspaceId = workspace.id;
    state.workspaceDraftMode = false;
    renderWorkspaceQuickMenu();
    renderTerminalTabs();

    const restoredTabCount = workspaceSavedTabCount(workspace);
    const summary = `Workspace "${workspace.name}" restored: ${restoredTabCount} tab${restoredTabCount === 1 ? '' : 's'} · ${opened} pane${opened === 1 ? '' : 's'} opened${skipped ? `, ${skipped} skipped` : ''}.`;
    appendActivityFeedEvent(summary, skipped ? 'warning' : 'success', { dedupeMs: 1200 });
    showToast(stopReason ? `${summary} ${stopReason}` : summary, stopReason || skipped ? 8000 : 4500, stopReason || skipped ? 'warning' : 'success');

    requestAnimationFrame(() => {
      fitActiveTerminal();
      const active = state.terminals.get(state.activeTerminalId);
      if (active && !active.closed) focusTerminal(active);
    });

    return opened > 0;
  } finally {
    state.workspaceRestoreInFlight = false;
    document.body.classList.remove('workspace-restore-active');

    if (state.activeSettingsTab === 'workspaces') {
      renderWorkspaceSettings();
    }
  }
}

async function maybeRestoreStartupWorkspace() {
  if (state.workspaceStartupRestoreAttempted) {
    return;
  }

  state.workspaceStartupRestoreAttempted = true;
  const workspaceId = String(state.settings?.startupWorkspaceId || '');

  if (!workspaceId) {
    await restorePinnedTerminalTabsOnStartup();
    return;
  }

  const workspace = getWorkspaceById(workspaceId);

  if (!workspace) {
    state.settings.startupWorkspaceId = '';
    await saveSettingsNow({ refresh: false });
    await restorePinnedTerminalTabsOnStartup();
    return;
  }

  appendActivityFeedEvent(`Opening startup workspace: ${workspace.name}.`, 'system', { dedupeMs: 1200 });
  await restoreWorkspace(workspace.id, { startup: true });
  await restorePinnedTerminalTabsOnStartup();
}


function terminalToolbarVisibilityLabel(action) {
  const normalized = normalizeTerminalToolbarAction(action);
  const labels = {
    all: 'All',
    local: 'Local',
    ssh: 'SSH',
    admin: 'Admin',
    profile: 'Profile'
  };

  if (normalized.visibility === 'profile') {
    const profile = getTerminalProfileById(normalized.profileId);
    return profile ? `Profile: ${profile.name}` : 'Profile: missing (hidden)';
  }

  return labels[normalized.visibility] || 'All';
}

function renderTerminalActionList() {
  const list = $('#terminal-action-list');

  if (!list || !state.settings) {
    return;
  }

  const actions = getTerminalToolbarActions();
  list.innerHTML = '';

  actions.forEach((actionValue, index) => {
    const action = normalizeTerminalToolbarAction(actionValue);
    const item = document.createElement('button');
    const icon = document.createElement('span');
    const main = document.createElement('span');
    const name = document.createElement('strong');
    const kind = document.createElement('small');
    const order = document.createElement('span');
    const details = [];

    item.type = 'button';
    item.draggable = true;
    item.dataset.actionId = action.id;
    item.className = `terminal-action-list-item ${action.id === state.editingTerminalActionId ? 'active' : ''}`;

    icon.className = 'terminal-action-list-icon';

    if (action.itemType === 'separator') {
      icon.classList.add('terminal-action-list-separator-icon');
      icon.textContent = '⋮';
    } else {
      setTerminalActionIconContent(icon, action);
      if (action.color) {
        icon.style.color = action.color;
      }
    }

    main.className = 'terminal-action-list-main';
    name.textContent = action.itemType === 'separator' ? 'Separator' : (action.name || 'Terminal Action');

    if (action.itemType === 'separator') {
      details.push('Separator');
    } else {
      details.push(terminalActionKindLabel(action.action));

      if (action.dropdown) {
        details.push(`Dropdown: ${action.dropdown}`);
      } else if (action.group) {
        details.push(`Group: ${action.group}`);
      }

      if (normalizeTerminalToolbarShortcut(action.shortcut)) {
        details.push(normalizeTerminalToolbarShortcut(action.shortcut));
      }
    }

    details.push(terminalToolbarVisibilityLabel(action));

    if (action.enabled === false) {
      details.unshift('Hidden');
    }

    kind.textContent = details.join(' · ');
    main.append(name, kind);

    order.className = 'terminal-action-list-order';
    order.textContent = String(index + 1);

    item.append(icon, main, order);
    item.addEventListener('click', () => loadTerminalActionIntoManager(action.id));

    item.addEventListener('dragstart', (event) => {
      state.draggingTerminalActionId = action.id;
      item.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', action.id);

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
    });

    item.addEventListener('dragover', (event) => {
      if (!state.draggingTerminalActionId || state.draggingTerminalActionId === action.id) {
        return;
      }

      event.preventDefault();
      item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', async (event) => {
      event.preventDefault();
      item.classList.remove('drag-over');
      const draggedId = state.draggingTerminalActionId || event.dataTransfer?.getData('text/plain');

      if (!draggedId || draggedId === action.id) {
        return;
      }

      const ordered = getTerminalToolbarActions();
      const fromIndex = ordered.findIndex((entry) => entry.id === draggedId);
      const targetIndex = ordered.findIndex((entry) => entry.id === action.id);

      if (fromIndex < 0 || targetIndex < 0) {
        return;
      }

      const [moved] = ordered.splice(fromIndex, 1);
      let insertIndex = ordered.findIndex((entry) => entry.id === action.id);
      const rect = item.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + (rect.height / 2);

      if (insertAfter) {
        insertIndex += 1;
      }

      ordered.splice(Math.max(0, insertIndex), 0, moved);
      state.settings.terminalActions = ordered;
      state.editingTerminalActionId = moved.id;
      await saveSettings();
      renderTerminalActionList();
      renderTerminalToolbarActions();
      showToast('Toolbar order updated.', 2600, 'success');
    });

    item.addEventListener('dragend', () => {
      state.draggingTerminalActionId = null;
      $$('.terminal-action-list-item').forEach((entry) => {
        entry.classList.remove('dragging', 'drag-over');
      });
    });

    list.appendChild(item);
  });

  if (!actions.length) {
    const empty = document.createElement('div');
    empty.className = 'manage-command-empty';
    empty.textContent = 'No terminal toolbar items yet.';
    list.appendChild(empty);
  }

  updateTerminalActionMoveButtons();
}

function updateTerminalActionMoveButtons() {
  const actions = getTerminalToolbarActions();
  const index = actions.findIndex((item) => item.id === state.editingTerminalActionId);
  const hasSelection = index >= 0;

  $('#terminal-action-duplicate') && ($('#terminal-action-duplicate').disabled = !hasSelection);
  $('#terminal-action-delete') && ($('#terminal-action-delete').disabled = !hasSelection);
  $('#terminal-action-move-up') && ($('#terminal-action-move-up').disabled = !hasSelection || index <= 0);
  $('#terminal-action-move-down') && ($('#terminal-action-move-down').disabled = !hasSelection || index < 0 || index >= actions.length - 1);
}

function populateTerminalActionProfileDropdown(selectedProfileId = '') {
  const select = $('#terminal-action-profile');

  if (!select) {
    return;
  }

  const profiles = getTerminalProfiles();
  const requested = String(selectedProfileId || select.value || '').trim();
  select.innerHTML = '';

  profiles.forEach((profile) => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = `${profile.icon || 'TERM'}  ${profile.name}`;
    select.appendChild(option);
  });

  if (requested && !profiles.some((profile) => profile.id === requested)) {
    const missing = document.createElement('option');
    missing.value = requested;
    missing.textContent = `Missing profile — item stays hidden (${requested})`;
    select.appendChild(missing);
  }

  select.value = requested && Array.from(select.options).some((option) => option.value === requested)
    ? requested
    : (profiles[0]?.id || '');
}

function updateTerminalActionShortcutHelp() {
  const input = $('#terminal-action-shortcut');
  const help = $('#terminal-action-shortcut-help');

  if (!input || !help) {
    return;
  }

  const raw = input.value.trim();

  if (!raw) {
    help.textContent = 'Use Ctrl/Alt/Shift plus a key. Duplicate and reserved shortcuts are blocked.';
    help.classList.remove('field-warning');
    return;
  }

  const normalized = normalizeTerminalToolbarShortcut(raw);

  if (!normalized) {
    help.textContent = 'Shortcut needs a modifier and a key, for example Ctrl+Alt+L.';
    help.classList.add('field-warning');
    return;
  }

  const conflict = getTerminalToolbarShortcutConflict(normalized, state.editingTerminalActionId || '');

  if (conflict?.reserved) {
    help.textContent = `${normalized} is reserved by Advance Terminal / terminal clipboard behavior.`;
    help.classList.add('field-warning');
    return;
  }

  if (conflict?.action) {
    help.textContent = `${normalized} is already used by "${conflict.action.name}".`;
    help.classList.add('field-warning');
    return;
  }

  help.textContent = `Shortcut: ${normalized}`;
  help.classList.remove('field-warning');
}

function updateTerminalActionFormVisibility() {
  const itemType = $('#terminal-action-item-type')?.value || 'action';
  const kind = $('#terminal-action-kind')?.value || 'clear';
  const visibility = $('#terminal-action-visibility')?.value || 'all';
  const isSeparator = itemType === 'separator';
  const hasText = !isSeparator && ['sendText', 'typeText'].includes(kind);
  const textRow = $('#terminal-action-text-row');
  const textLabel = $('#terminal-action-text-label');
  const textArea = $('#terminal-action-text');
  const textHelp = $('#terminal-action-text-help');

  $('#terminal-action-name-row')?.classList.toggle('hidden', isSeparator);
  $('#terminal-action-kind-row')?.classList.toggle('hidden', isSeparator);
  $('#terminal-action-group-row')?.classList.toggle('hidden', isSeparator);
  $('#terminal-action-dropdown-row')?.classList.toggle('hidden', isSeparator);
  $('#terminal-action-shortcut-row')?.classList.toggle('hidden', isSeparator);
  $('#terminal-action-custom-icon-row')?.classList.toggle('hidden', isSeparator || ($('#terminal-action-selected-icon')?.value || 'terminal') !== 'custom');
  $('#terminal-action-color-row')?.classList.toggle('hidden', isSeparator);
  $('#terminal-action-icon-block')?.classList.toggle('hidden', isSeparator);
  $('#terminal-action-profile-row')?.classList.toggle('hidden', visibility !== 'profile');
  textRow?.classList.toggle('hidden', !hasText);

  if (visibility === 'profile') {
    populateTerminalActionProfileDropdown($('#terminal-action-profile')?.value || '');
  }

  if (kind === 'typeText') {
    if (textLabel) {
      textLabel.textContent = 'Text to type without Enter';
    }
    if (textArea) {
      textArea.placeholder = 'Example: php artisan ';
    }
    if (textHelp) {
      textHelp.textContent = 'Writes the text into the active terminal without pressing Enter. Line breaks are converted to spaces.';
    }
  } else {
    if (textLabel) {
      textLabel.textContent = 'Text or command to send';
    }
    if (textArea) {
      textArea.placeholder = 'Example: php artisan optimize:clear';
    }
    if (textHelp) {
      textHelp.textContent = 'Send Command + Enter executes the text. Type Text Only writes text without pressing Enter.';
    }
  }

  updateTerminalActionShortcutHelp();
}

function updateTerminalActionCustomizationControls() {
  const itemType = $('#terminal-action-item-type')?.value || 'action';
  const icon = $('#terminal-action-selected-icon')?.value || 'terminal';
  const customIconRow = $('#terminal-action-custom-icon-row');
  const colorEnabled = $('#terminal-action-color-enabled');
  const colorInput = $('#terminal-action-color');
  const colorValue = $('#terminal-action-color-value');
  const useCustomColor = itemType !== 'separator' && Boolean(colorEnabled?.checked);

  customIconRow?.classList.toggle('hidden', itemType === 'separator' || icon !== 'custom');

  if (colorInput) {
    colorInput.disabled = !useCustomColor;
  }

  if (colorValue) {
    colorValue.textContent = useCustomColor ? (colorInput?.value || '#a78bfa').toUpperCase() : 'Default';
  }

  updateTerminalActionFormVisibility();
}

function fillTerminalActionForm(action) {
  const normalized = normalizeTerminalToolbarAction(action || {
    itemType: 'action',
    name: 'New Action',
    action: 'sendText',
    icon: 'terminal',
    customIcon: '',
    color: '',
    text: '',
    enabled: true,
    group: '',
    dropdown: '',
    shortcut: '',
    visibility: 'all',
    profileId: ''
  });

  $('#terminal-action-item-type').value = normalized.itemType;
  $('#terminal-action-name').value = normalized.itemType === 'separator' ? '' : normalized.name;
  $('#terminal-action-kind').value = normalized.action;
  $('#terminal-action-text').value = normalized.text;
  $('#terminal-action-enabled').checked = normalized.enabled !== false;
  $('#terminal-action-group').value = normalized.group || '';
  $('#terminal-action-dropdown').value = normalized.dropdown || '';
  $('#terminal-action-shortcut').value = normalizeTerminalToolbarShortcut(normalized.shortcut) || normalized.shortcut || '';
  $('#terminal-action-visibility').value = normalized.visibility || 'all';
  populateTerminalActionProfileDropdown(normalized.profileId || '');
  $('#terminal-action-custom-icon').value = normalized.customIcon || '';
  $('#terminal-action-color-enabled').checked = Boolean(normalized.color);
  $('#terminal-action-color').value = normalized.color || '#a78bfa';

  let hiddenIcon = $('#terminal-action-selected-icon');
  if (!hiddenIcon) {
    hiddenIcon = document.createElement('input');
    hiddenIcon.type = 'hidden';
    hiddenIcon.id = 'terminal-action-selected-icon';
    $('#settings-tab-terminal-actions')?.appendChild(hiddenIcon);
  }

  hiddenIcon.value = normalized.icon;
  renderTerminalActionIconPicker(normalized.icon);
  updateTerminalActionCustomizationControls();
  updateTerminalActionMoveButtons();
}

function loadTerminalActionIntoManager(actionId) {
  state.editingTerminalActionId = actionId || null;
  fillTerminalActionForm(getSelectedTerminalAction());
  renderTerminalActionList();

  if ($('#terminal-action-item-type')?.value === 'separator') {
    $('#terminal-action-visibility')?.focus();
  } else {
    $('#terminal-action-name')?.focus();
  }
}

function newTerminalActionFromManager() {
  state.editingTerminalActionId = null;
  fillTerminalActionForm({
    itemType: 'action',
    name: 'New Action',
    action: 'sendText',
    icon: 'terminal',
    customIcon: '',
    color: '',
    text: '',
    enabled: true,
    group: '',
    dropdown: '',
    shortcut: '',
    visibility: 'all',
    profileId: ''
  });
  renderTerminalActionList();
  $('#terminal-action-name')?.select();
}

function newTerminalSeparatorFromManager() {
  state.editingTerminalActionId = null;
  fillTerminalActionForm({
    itemType: 'separator',
    name: 'Separator',
    action: 'clear',
    icon: 'lines',
    customIcon: '',
    color: '',
    text: '',
    enabled: true,
    group: '',
    dropdown: '',
    shortcut: '',
    visibility: 'all',
    profileId: ''
  });
  renderTerminalActionList();
  $('#terminal-action-visibility')?.focus();
}

async function saveTerminalActionFromManager(options = {}) {
  const itemType = $('#terminal-action-item-type')?.value === 'separator' ? 'separator' : 'action';
  const name = itemType === 'separator' ? 'Separator' : $('#terminal-action-name').value.trim();
  const actionKind = $('#terminal-action-kind').value;
  const text = $('#terminal-action-text').value.trim();
  const icon = $('#terminal-action-selected-icon')?.value || 'terminal';
  const customIcon = $('#terminal-action-custom-icon')?.value.trim() || '';
  const color = itemType === 'action' && $('#terminal-action-color-enabled')?.checked
    ? ($('#terminal-action-color')?.value || '')
    : '';
  const enabled = $('#terminal-action-enabled').checked;
  const group = itemType === 'action' ? $('#terminal-action-group')?.value.trim() || '' : '';
  const dropdown = itemType === 'action' ? $('#terminal-action-dropdown')?.value.trim() || '' : '';
  const shortcutRaw = itemType === 'action' ? $('#terminal-action-shortcut')?.value.trim() || '' : '';
  const shortcut = shortcutRaw ? normalizeTerminalToolbarShortcut(shortcutRaw) : '';
  const visibility = $('#terminal-action-visibility')?.value || 'all';
  const profileId = visibility === 'profile' ? String($('#terminal-action-profile')?.value || '').trim() : '';

  if (itemType === 'action' && !name) {
    showToast('Terminal action needs a name.');
    return false;
  }

  if (itemType === 'action' && ['sendText', 'typeText'].includes(actionKind) && !text) {
    showToast(`${terminalActionKindLabel(actionKind)} needs text.`);
    return false;
  }

  if (itemType === 'action' && icon === 'custom' && !customIcon) {
    showToast('Enter a custom icon, or choose a built-in icon.');
    $('#terminal-action-custom-icon')?.focus();
    return false;
  }

  if (shortcutRaw && !shortcut) {
    showToast('Keyboard shortcut needs a modifier and a key, for example Ctrl+Alt+L.', 5000, 'warning');
    $('#terminal-action-shortcut')?.focus();
    return false;
  }

  const shortcutConflict = shortcut
    ? getTerminalToolbarShortcutConflict(shortcut, state.editingTerminalActionId || '')
    : null;

  if (shortcutConflict?.reserved) {
    showToast(`${shortcut} is reserved and cannot be assigned to a toolbar action.`, 5500, 'warning');
    $('#terminal-action-shortcut')?.focus();
    return false;
  }

  if (shortcutConflict?.action) {
    showToast(`${shortcut} is already assigned to "${shortcutConflict.action.name}".`, 5500, 'warning');
    $('#terminal-action-shortcut')?.focus();
    return false;
  }

  if (visibility === 'profile' && !profileId) {
    showToast('Choose a Terminal Profile for this profile-specific toolbar item.', 5000, 'warning');
    $('#terminal-action-profile')?.focus();
    return false;
  }

  const actions = getTerminalToolbarActions();
  const action = normalizeTerminalToolbarAction({
    id: state.editingTerminalActionId || randomId('term-action'),
    itemType,
    name,
    action: itemType === 'separator' ? 'clear' : actionKind,
    icon: itemType === 'separator' ? 'lines' : icon,
    customIcon: itemType === 'separator' ? '' : customIcon,
    color,
    text: itemType === 'separator' ? '' : text,
    enabled,
    group: dropdown ? '' : group,
    dropdown,
    shortcut,
    visibility,
    profileId
  });

  const index = actions.findIndex((item) => item.id === action.id);

  if (index >= 0) {
    actions[index] = action;
  } else {
    actions.push(action);
  }

  state.settings.terminalActions = actions;
  await saveSettings();
  state.editingTerminalActionId = action.id;
  renderTerminalActionList();
  fillTerminalActionForm(action);
  renderTerminalToolbarActions();

  if (options.showToast !== false) {
    showToast(options.toastMessage || `${itemType === 'separator' ? 'Separator' : 'Terminal action'} saved and applied.`);
  }

  return action;
}

async function saveTerminalToolbarFromManager() {
  const saved = await saveTerminalActionFromManager({
    showToast: false
  });

  if (!saved) {
    return;
  }

  renderTerminalToolbarActions();
  showToast('Toolbar saved and applied instantly.', 4000, 'success');
}

async function duplicateTerminalActionFromManager() {
  const selected = getSelectedTerminalAction();

  if (!selected) {
    showToast('Select a terminal toolbar item to duplicate.');
    return;
  }

  const duplicate = normalizeTerminalToolbarAction({
    ...selected,
    id: randomId('term-action'),
    name: selected.itemType === 'separator'
      ? 'Separator'
      : `${selected.name || 'Terminal Action'} Copy`,
    shortcut: ''
  });

  state.settings.terminalActions = [...getTerminalToolbarActions(), duplicate];
  await saveSettings();
  state.editingTerminalActionId = duplicate.id;
  renderTerminalActionList();
  fillTerminalActionForm(duplicate);
  renderTerminalToolbarActions();
  showToast(selected.itemType === 'separator' ? 'Separator duplicated.' : 'Terminal action duplicated.');
}

async function deleteTerminalActionFromManager() {
  const selected = getSelectedTerminalAction();

  if (!selected) {
    showToast('Select a terminal toolbar item to delete.');
    return;
  }

  const label = selected.itemType === 'separator' ? 'separator' : `terminal action "${selected.name || 'selected action'}"`;
  const confirmed = confirm(`Delete ${label}?`);

  if (!confirmed) {
    return;
  }

  state.settings.terminalActions = getTerminalToolbarActions().filter((item) => item.id !== selected.id);
  await saveSettings();

  const next = getTerminalToolbarActions()[0] || null;
  state.editingTerminalActionId = next?.id || null;
  renderTerminalActionList();
  fillTerminalActionForm(next || {
    itemType: 'action',
    name: 'New Action',
    action: 'sendText',
    icon: 'terminal',
    customIcon: '',
    color: '',
    text: '',
    enabled: true,
    group: '',
    dropdown: '',
    shortcut: '',
    visibility: 'all',
    profileId: ''
  });
  renderTerminalToolbarActions();
  showToast('Terminal toolbar item deleted.');
}

async function moveTerminalActionFromManager(direction) {
  const actions = getTerminalToolbarActions();
  const index = actions.findIndex((item) => item.id === state.editingTerminalActionId);

  if (index < 0) {
    showToast('Select a terminal toolbar item to move.');
    return;
  }

  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= actions.length) {
    return;
  }

  const [item] = actions.splice(index, 1);
  actions.splice(nextIndex, 0, item);
  state.settings.terminalActions = actions;
  await saveSettings();
  renderTerminalActionList();
  renderTerminalToolbarActions();
  showToast('Toolbar order updated and applied.');
}

async function resetTerminalActionsToDefault() {
  const confirmed = confirm('Reset Terminal Actions to the default toolbar?');

  if (!confirmed) {
    return;
  }

  state.settings.terminalActions = getDefaultTerminalActions().map(normalizeTerminalToolbarAction);
  await saveSettings();
  state.editingTerminalActionId = state.settings.terminalActions[0]?.id || null;
  renderTerminalActionList();
  fillTerminalActionForm(getSelectedTerminalAction());
  renderTerminalToolbarActions();
  showToast('Terminal actions reset to defaults.');
}

function renderTerminalActionsSettings() {
  if (!state.settings) {
    return;
  }

  const actions = getTerminalToolbarActions();

  if (!state.editingTerminalActionId && actions.length) {
    state.editingTerminalActionId = actions[0].id;
  }

  renderTerminalActionList();
  fillTerminalActionForm(getSelectedTerminalAction() || actions[0] || null);
}


function buildRiskyCommandWarningMessage(commandConfig = {}, resolved = {}, risk = {}) {
  const shortcutName = String(commandConfig?.name || 'Command Shortcut').trim();
  const category = getCommandCategory(commandConfig);
  const variableCount = Array.isArray(resolved?.variables) ? resolved.variables.length : 0;
  const variableText = variableCount ? `\nVariables filled: ${variableCount}` : '';
  const labels = Array.isArray(risk.labels) && risk.labels.length ? risk.labels.join(', ') : 'Potentially risky operation';
  const reasons = Array.isArray(risk.reasons) && risk.reasons.length
    ? risk.reasons.map((item) => `• ${item}`).join('\n')
    : '• This command may make permanent changes.';

  return [
    'Risky command detected.',
    '',
    `Shortcut: ${shortcutName}`,
    `Category: ${category}`,
    `Risk type: ${labels}`,
    variableText.trim() ? variableText.trim() : null,
    '',
    reasons,
    '',
    'The actual command text is not shown here for privacy.',
    'Run this command anyway?'
  ].filter(Boolean).join('\n');
}

async function confirmRiskyCommandIfNeeded(commandConfig = {}, resolved = {}) {
  const risk = analyzeCommandRisk(resolved?.command || '');

  if (!risk.risky) {
    return true;
  }

  const confirmed = await showConfirmDialog({
    title: risk.severity === 'high' ? 'High Risk Command' : 'Risky Command',
    message: buildRiskyCommandWarningMessage(commandConfig, resolved, risk),
    confirmLabel: 'Run Anyway',
    cancelLabel: 'Cancel'
  });

  if (!confirmed) {
    const description = describeCommandForLog(commandConfig, resolved);
    appendLiveConsole(`Risky command cancelled: ${description}`, 'warning');
    showToast('Risky command cancelled.', 4500, 'warning');
    return false;
  }

  appendLiveConsole(`Risky command approved: ${describeCommandForLog(commandConfig, resolved)}`, 'warning');
  return true;
}


function getCommandCategory(command = {}) {
  return normalizeCommandCategory(command.category, command.command);
}

function getCommandCategories() {
  const categories = [...DEFAULT_COMMAND_CATEGORIES];
  const seen = new Set(categories.map((item) => item.toLowerCase()));

  (state.settings ? getCommands() : []).forEach((command) => {
    const category = getCommandCategory(command);
    const key = category.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      categories.push(category);
    }
  });

  return categories;
}

function renderCommandCategoryOptions() {
  const filter = $('#command-category-filter');
  const datalist = $('#command-category-options');
  const categories = getCommandCategories();

  if (filter) {
    const current = state.commandCategoryFilter || 'all';
    filter.innerHTML = '<option value="all">All Categories</option>';

    categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      filter.appendChild(option);
    });

    if (current !== 'all' && !categories.includes(current)) {
      state.commandCategoryFilter = 'all';
    }

    filter.value = state.commandCategoryFilter || 'all';
  }

  if (datalist) {
    datalist.innerHTML = '';

    categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      datalist.appendChild(option);
    });
  }
}

function setCommandCategoryFilter(category) {
  state.commandCategoryFilter = String(category || 'all') || 'all';
  renderCommandList();
}

function resolveCommandVariables(template) {
  const original = String(template || '').trim();
  const variables = extractCommandVariables(original);

  if (!variables.length) {
    return {
      command: original,
      template: original,
      variables: []
    };
  }

  const replacements = {};

  for (const variable of variables) {
    const label = variable.replace(/[_-]+/g, ' ');
    const value = window.prompt(`Enter value for {${variable}}`, '');

    if (value === null) {
      return null;
    }

    const cleaned = String(value || '').replace(/[\r\n]+/g, ' ').trim();

    if (!cleaned) {
      showToast(`Value for {${variable}} is required.`, 5000, 'warning');
      return null;
    }

    replacements[variable] = cleaned;
  }

  let resolved = original;

  variables.forEach((variable) => {
    resolved = resolved.replace(new RegExp(`\\{${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), replacements[variable]);
  });

  return {
    command: resolved,
    template: original,
    variables
  };
}

function describeCommandForLog(command = {}, resolved = null) {
  const name = command?.name || 'Command Shortcut';
  const category = getCommandCategory(command);
  const variableCount = Array.isArray(resolved?.variables) ? resolved.variables.length : extractCommandVariables(command?.command || '').length;
  const variableText = variableCount ? `, variables: ${variableCount}` : '';

  return `${name} (${category}${variableText})`;
}

function getCommands() {
  if (!Array.isArray(state.settings?.commands)) {
    state.settings.commands = [];
  }

  return state.settings.commands;
}

function isCommandPinned(command) {
  return Boolean(command?.pinned);
}

function sortCommandsForDisplay(commands) {
  return (Array.isArray(commands) ? commands : [])
    .map((command, index) => ({ command, index }))
    .sort((a, b) => {
      const pinnedA = isCommandPinned(a.command) ? 1 : 0;
      const pinnedB = isCommandPinned(b.command) ? 1 : 0;

      if (pinnedA !== pinnedB) {
        return pinnedB - pinnedA;
      }

      return a.index - b.index;
    })
    .map((item) => item.command);
}

function renderCommandSelectedConnectionActions() {
  const panel = $('#command-selected-connection-actions');

  if (panel) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
  }
}

function renderCommandList() {
  const list = $('#command-list');
  const searchInput = $('#command-search');

  if (!list || !searchInput || !state.settings) {
    return;
  }

  renderCommandCategoryOptions();

  const search = (searchInput.value || '').toLowerCase();
  const categoryFilter = String(state.commandCategoryFilter || 'all');
  const commands = sortCommandsForDisplay(getCommands().filter((command) => {
    const category = getCommandCategory(command);
    const haystack = `${command.name || ''} ${category} ${command.command || ''}`.toLowerCase();
    const matchesCategory = categoryFilter === 'all' || category === categoryFilter;

    return matchesCategory && haystack.includes(search);
  }));

  list.innerHTML = '';

  if (!commands.length) {
    const empty = document.createElement('div');
    empty.className = 'command-empty';
    empty.textContent = categoryFilter === 'all' ? 'No command shortcuts found.' : `No ${categoryFilter} command shortcuts found.`;
    list.appendChild(empty);
    return;
  }

  commands.forEach((command) => {
    const category = getCommandCategory(command);
    const variables = extractCommandVariables(command.command || '');
    const risk = analyzeCommandRisk(command.command || '');
    const card = document.createElement('div');
    card.className = `command-card ${isCommandPinned(command) ? 'pinned-command-card' : ''} ${risk.risky ? 'risky-command-card' : ''}`;
    card.dataset.commandId = command.id;
    card.dataset.commandCategory = category;
    card.draggable = true;
    card.title = [
      isCommandPinned(command) ? 'Pinned command. Right-click to unpin. Drag to arrange.' : 'Right-click for actions. Drag to arrange.',
      variables.length ? `This command asks for ${variables.length} value${variables.length === 1 ? '' : 's'} before running.` : '',
      risk.risky ? 'This command shows a safety confirmation before running.' : ''
    ].filter(Boolean).join(' ');
    const pinned = isCommandPinned(command);
    card.innerHTML = `
      <div class="command-main">
        <div class="command-card-topline">
          <div class="command-title-wrap">
            <div class="command-name"></div>
          </div>
          <span class="command-category-badge"></span>
        </div>
        <div class="command-value"></div>
      </div>
      <div class="command-card-actions">
        <button class="command-run-button" type="button">Run</button>
      </div>
    `;

    card.querySelector('.command-name').textContent = `${isCommandPinned(command) ? '📌 ' : ''}${command.name || 'Command Shortcut'}`;
    card.querySelector('.command-category-badge').textContent = category;
    card.querySelector('.command-value').textContent = command.command || '';
    card.addEventListener('contextmenu', (event) => {
      showCommandContextMenu(event, command);
    });

    card.addEventListener('dragstart', (event) => {
      state.draggingCommandId = command.id;
      card.classList.add('is-dragging');
      hideSidebarContextMenu();

      try {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', command.id);
      } catch (_) {
        // Ignore drag data errors in older webviews.
      }
    });

    card.addEventListener('dragend', () => {
      state.draggingCommandId = null;
      card.classList.remove('is-dragging');
      $$('.command-card.drag-over').forEach((item) => item.classList.remove('drag-over', 'drop-after'));
    });

    card.addEventListener('dragover', (event) => {
      if (!state.draggingCommandId || state.draggingCommandId === command.id) {
        return;
      }

      event.preventDefault();
      card.classList.add('drag-over');
      card.classList.toggle('drop-after', getDropPlacement(event, card));
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over', 'drop-after');
    });

    card.addEventListener('drop', (event) => {
      event.preventDefault();
      const insertAfter = getDropPlacement(event, card);
      const draggedId = state.draggingCommandId;
      state.draggingCommandId = null;
      reorderSettingsArray('command', draggedId, command.id, insertAfter).catch((error) => {
        showToast(`Command reorder failed: ${error.message}`, 7000, 'error');
      });
    });

    card.querySelector('.command-run-button').addEventListener('click', (event) => {
      event.stopPropagation();
      sendCommandToActiveTerminal(command);
    });

    list.appendChild(card);
  });

  updateTerminalInteractionState();
}

function getSelectedCommand() {
  return getCommands().find((item) => item.id === state.editingCommandId) || null;
}

function renderManageCommandList() {
  const list = $('#manage-command-list');

  if (!list || !state.settings) {
    return;
  }

  renderCommandCategoryOptions();

  const commands = sortCommandsForDisplay(getCommands());
  list.innerHTML = '';

  if (!commands.length) {
    const empty = document.createElement('div');
    empty.className = 'manage-command-empty';
    empty.textContent = 'No command shortcuts yet.';
    list.appendChild(empty);
    return;
  }

  commands.forEach((command) => {
    const category = getCommandCategory(command);
    const button = document.createElement('button');
    button.className = `manage-command-item ${command.id === state.editingCommandId ? 'active' : ''}`;
    button.type = 'button';
    button.innerHTML = `
      <span class="manage-command-name"></span>
      <span class="manage-command-category"></span>
      <span class="manage-command-meta"></span>
    `;

    button.querySelector('.manage-command-name').textContent = command.name || 'Command Shortcut';
    button.querySelector('.manage-command-category').textContent = category;
    button.querySelector('.manage-command-meta').textContent = command.command || '';

    button.addEventListener('click', () => {
      loadCommandIntoManager(command.id);
    });

    list.appendChild(button);
  });
}

function fillCommandManagerForm(command) {
  const commandText = command?.command || '';

  $('#manage-command-name').value = command?.name || '';
  $('#manage-command-category').value = command ? getCommandCategory(command) : 'Custom';
  $('#manage-command-value').value = commandText;
  $('#modal-duplicate-command').disabled = !command;
  $('#modal-delete-command').disabled = !command;
}

function loadCommandIntoManager(commandId) {
  state.editingCommandId = commandId || null;
  fillCommandManagerForm(getSelectedCommand());
  renderManageCommandList();
  $('#manage-command-name')?.focus();
}

function clearCommandManagerForm() {
  state.editingCommandId = null;
  fillCommandManagerForm(null);
  $('#modal-duplicate-command').disabled = true;
  $('#modal-delete-command').disabled = true;
  renderManageCommandList();
  $('#manage-command-name')?.focus();
}

function openCommandManagerModal(commandId = null) {
  const modal = $('#command-manager-modal');

  if (!modal) {
    return;
  }

  if (commandId) {
    loadCommandIntoManager(commandId);
  } else {
    clearCommandManagerForm();
  }

  modal.classList.remove('hidden');
  $('#manage-command-name')?.focus();
}

function closeCommandManagerModal() {
  $('#command-manager-modal')?.classList.add('hidden');
  state.editingCommandId = null;
  renderCommandList();
}

async function saveCommandFromManager() {
  const name = $('#manage-command-name').value.trim();
  const commandValue = $('#manage-command-value').value.trim();
  const category = normalizeCommandCategory($('#manage-command-category')?.value, commandValue);

  if (!name || !commandValue) {
    showToast('Command shortcut needs a name and command.');
    return;
  }

  const commands = getCommands();
  const command = {
    id: state.editingCommandId || randomId('cmd'),
    name,
    category,
    command: commandValue
  };

  const index = commands.findIndex((item) => item.id === command.id);

  if (index >= 0 && isCommandPinned(commands[index])) {
    command.pinned = true;
  }

  if (index >= 0) {
    commands[index] = command;
  } else {
    commands.push(command);
  }

  state.settings.commands = commands;
  await saveSettings();
  state.editingCommandId = command.id;
  renderCommandList();
  renderManageCommandList();
  showToast('Command shortcut saved.');
}

async function duplicateCommandFromManager() {
  const selected = getSelectedCommand();

  if (!selected) {
    showToast('Select a command to duplicate.');
    return;
  }

  const duplicate = {
    id: randomId('cmd'),
    name: `${selected.name || 'Command Shortcut'} Copy`,
    category: getCommandCategory(selected),
    command: selected.command || ''
  };

  state.settings.commands = [...getCommands(), duplicate];
  await saveSettings();
  state.editingCommandId = duplicate.id;
  fillCommandManagerForm(duplicate);
  renderCommandList();
  renderManageCommandList();
  showToast('Command shortcut duplicated.');
}

async function deleteCommandFromManager() {
  const selected = getSelectedCommand();

  if (!selected) {
    showToast('Select a command to delete.');
    return;
  }

  const confirmed = confirm(`Delete command shortcut "${selected.name || 'selected command'}"?`);

  if (!confirmed) {
    return;
  }

  state.settings.commands = getCommands().filter((item) => item.id !== selected.id);
  await saveSettings();

  const next = getCommands()[0] || null;
  if (next) {
    state.editingCommandId = next.id;
    fillCommandManagerForm(next);
  } else {
    clearCommandManagerForm();
  }

  renderCommandList();
  renderManageCommandList();
  showToast('Command shortcut deleted.');
}

async function sendCommandToActiveTerminal(commandValue) {
  const commandConfig = typeof commandValue === 'object' && commandValue !== null
    ? commandValue
    : {
        name: 'Command Shortcut',
        category: inferCommandCategory(commandValue),
        command: String(commandValue || '')
      };
  const template = String(commandConfig.command || '').trim();
  const session = state.terminals.get(state.activeTerminalId);

  if (!template) {
    showToast('Command shortcut is empty.');
    return;
  }

  if (!session || session.closed) {
    showToast('Open or connect a terminal first.');
    setActiveView('terminal');
    return;
  }

  if (!guardTerminalAction(session, commandConfig.name || 'Run Command', 'sendText')) {
    return;
  }

  const resolved = resolveCommandVariables(template);

  if (!resolved) {
    showToast('Command shortcut cancelled.', 3500, 'warning');
    return;
  }

  const command = String(resolved.command || '').trim();

  if (!command) {
    showToast('Command shortcut is empty.');
    return;
  }

  const allowed = await confirmRiskyCommandIfNeeded(commandConfig, {
    ...resolved,
    command
  });

  if (!allowed) {
    return;
  }

  const payload = `${command.replace(/\r?\n/g, '\r')}\r`;
  const logDescription = describeCommandForLog(commandConfig, resolved);

  setActiveView('terminal');

  const sshLockResult = inspectSshLockedTerminalData(session, payload);

  if (sshLockResult.blocked) {
    showSshPathLockBlocked(session, sshLockResult.reason);
    return;
  }

  applySshLockedLocationResult(session, sshLockResult);
  session.sshTypedCommandBuffer = sshLockResult.trailing || '';

  setTerminalProcessBusy(session, true, `${commandConfig.name || 'Command shortcut'} is running`);
  commitReportCommand(session, resolved.template || template, 'shortcut');

  window.advanceTerminal.writeTerminal({
    terminalId: session.terminalId,
    data: payload
  });

  recordSessionEvent(session, `Command shortcut sent: ${logDescription}`, 'command');

  try {
    session.term.focus();
  } catch (_) {
    // Ignore focus failure.
  }

  appendLiveConsole(`Command shortcut sent to ${session.server?.name || 'active terminal'}: ${logDescription}`, 'command');
  showToast(`Sent command shortcut: ${logDescription}`);
}


function getConnectionGroups() {
  const groups = [];
  const seen = new Set();

  (state.settings?.servers || []).forEach((server) => {
    const group = getServerGroup(server);
    const key = group.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      groups.push(group);
    }
  });

  return groups;
}

function renderConnectionGroupOptions() {
  const select = $('#connection-group-filter');

  if (!select) {
    return;
  }

  const current = state.connectionGroupFilter || 'all';
  const groups = getConnectionGroups();

  select.innerHTML = '<option value="all">All Groups</option>';

  groups.forEach((group) => {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = group;
    select.appendChild(option);
  });

  if (current !== 'all' && !groups.includes(current)) {
    state.connectionGroupFilter = 'all';
  }

  select.value = state.connectionGroupFilter || 'all';
}

function updateConnectionGroupDatalist() {
  const list = $('#connection-group-options');

  if (!list) {
    return;
  }

  list.innerHTML = '';

  getConnectionGroups().forEach((group) => {
    const option = document.createElement('option');
    option.value = group;
    list.appendChild(option);
  });
}

function setConnectionGroupFilter(group) {
  state.connectionGroupFilter = String(group || 'all') || 'all';
  renderServerList();
}

function updateConnectionFilterButtons() {
  const filter = normalizeConnectionFilter(state.connectionFilter);

  $$('.connection-filter-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.connectionFilter === filter);
  });
}

function setConnectionFilter(filter) {
  state.connectionFilter = normalizeConnectionFilter(filter);
  updateConnectionFilterButtons();
  renderServerList();
}

function readPinnedConnectionIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PINNED_CONNECTIONS_STORAGE_KEY) || '[]');

    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.map((id) => String(id || '')).filter(Boolean));
  } catch (_) {
    return new Set();
  }
}

function persistPinnedConnectionIds() {
  try {
    localStorage.setItem(PINNED_CONNECTIONS_STORAGE_KEY, JSON.stringify(Array.from(state.pinnedConnectionIds)));
  } catch (_) {
    // UI preference persistence is optional.
  }
}

function isConnectionPinned(server) {
  return Boolean(server?.id && state.pinnedConnectionIds.has(server.id));
}

function connectionPinIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.6 3.4l6 6-2.1 2.1-1.7-1.7-4.6 4.6.5 3.4-1.5 1.5-3.9-3.9-4.4 4.4-1.4-1.4 4.4-4.4-3.9-3.9 1.5-1.5 3.4.5 4.6-4.6-1.7-1.7 2.1-2.1z"/></svg>';
}

function sortConnectionsForDisplay(servers) {
  return (Array.isArray(servers) ? servers : [])
    .map((server, index) => ({ server, index }))
    .sort((a, b) => {
      const pinnedA = isConnectionPinned(a.server) ? 1 : 0;
      const pinnedB = isConnectionPinned(b.server) ? 1 : 0;

      if (pinnedA !== pinnedB) {
        return pinnedB - pinnedA;
      }

      return a.index - b.index;
    })
    .map((item) => item.server);
}

function readConnectionsPanelCollapsedPreference() {
  try {
    return localStorage.getItem(CONNECTIONS_PANEL_COLLAPSED_STORAGE_KEY) === 'true';
  } catch (_) {
    return false;
  }
}

function applyConnectionsPanelCollapsed(collapsed = state.connectionsPanelCollapsed) {
  state.connectionsPanelCollapsed = Boolean(collapsed);

  const workspace = $('.workspace');
  const panel = $('#servers-panel');
  const button = $('#connections-panel-toggle');

  workspace?.classList.toggle('connections-collapsed', state.connectionsPanelCollapsed);
  panel?.classList.toggle('is-collapsed', state.connectionsPanelCollapsed);

  if (button) {
    button.setAttribute('aria-expanded', state.connectionsPanelCollapsed ? 'false' : 'true');
    button.title = state.connectionsPanelCollapsed ? 'Expand connections panel' : 'Collapse connections panel';
    button.textContent = state.connectionsPanelCollapsed ? '›' : '‹';
  }

  requestAnimationFrame(() => {
    fitActiveTerminal();
  });
}

function setConnectionsPanelCollapsed(collapsed, persist = true) {
  const previousCollapsed = state.connectionsPanelCollapsed;
  applyConnectionsPanelCollapsed(collapsed);

  if (persist) {
    try {
      localStorage.setItem(CONNECTIONS_PANEL_COLLAPSED_STORAGE_KEY, state.connectionsPanelCollapsed ? 'true' : 'false');
    } catch (_) {
      // UI preference persistence is optional.
    }
  }

  if (previousCollapsed !== state.connectionsPanelCollapsed) {
    appendActivityFeedEvent(`Connections panel ${state.connectionsPanelCollapsed ? 'collapsed' : 'expanded'}.`, 'action', { dedupeMs: 800 });
  }
}

function toggleConnectionsPanelCollapsed() {
  setConnectionsPanelCollapsed(!state.connectionsPanelCollapsed);
}

async function setConnectionPinned(serverId, pinned) {
  const server = getServerById(serverId);

  if (!server) {
    showToast('Connection not found.', 5000, 'error');
    return;
  }

  if (pinned) {
    state.pinnedConnectionIds.add(server.id);
  } else {
    state.pinnedConnectionIds.delete(server.id);
  }

  persistPinnedConnectionIds();
  renderServerList();
  renderConnectionManageList();
  renderCommandSelectedConnectionActions();
  appendLiveConsole(`${server.name || 'Connection'} ${isConnectionPinned(server) ? 'pinned to the top' : 'unpinned'}.`, 'system');
  showToast(`${server.name || 'Connection'} ${isConnectionPinned(server) ? 'pinned to the top.' : 'unpinned.'}`, 3500, 'success');
}

function matchesConnectionFilter(server) {
  const filter = normalizeConnectionFilter(state.connectionFilter);
  const groupFilter = String(state.connectionGroupFilter || 'all');

  if (groupFilter !== 'all' && getServerGroup(server) !== groupFilter) {
    return false;
  }

  if (filter === 'remote') {
    return server.type !== 'local';
  }

  if (filter === 'local') {
    return server.type === 'local';
  }

  return true;
}

function getServerById(serverId) {
  return (state.settings?.servers || []).find((server) => server.id === serverId) || null;
}

function getCommandById(commandId) {
  return getCommands().find((command) => command.id === commandId) || null;
}

function hideSidebarContextMenu() {
  const menu = $('#sidebar-context-menu');

  if (!menu) {
    return;
  }

  menu.classList.add('hidden');
  menu.setAttribute('aria-hidden', 'true');
  menu.innerHTML = '';
}

function showSidebarContextMenu(event, items = []) {
  const menu = $('#sidebar-context-menu');

  if (!menu || !items.length) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  menu.innerHTML = '';

  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `sidebar-context-menu-item ${item.danger ? 'danger' : ''}`;
    button.setAttribute('role', 'menuitem');
    button.textContent = item.label;
    button.addEventListener('click', () => {
      hideSidebarContextMenu();

      try {
        item.action?.();
      } catch (error) {
        showToast(error.message || 'Action failed.', 7000, 'error');
      }
    });

    menu.appendChild(button);
  });

  menu.classList.remove('hidden');
  menu.setAttribute('aria-hidden', 'false');

  const rect = menu.getBoundingClientRect();
  const x = Math.min(event.clientX, Math.max(8, window.innerWidth - rect.width - 8));
  const y = Math.min(event.clientY, Math.max(8, window.innerHeight - rect.height - 8));

  menu.style.left = `${Math.max(8, x)}px`;
  menu.style.top = `${Math.max(8, y)}px`;
}

function openConnectionEditor(serverId) {
  const server = getServerById(serverId);

  if (!server) {
    showToast('Connection not found.', 5000, 'error');
    return;
  }

  selectServer(server.id);
  openAddConnectionModal(server.type === 'local' ? 'local' : 'remote', false);
}

async function duplicateConnectionById(serverId) {
  const source = getServerById(serverId);

  if (!source) {
    showToast('Connection not found.', 5000, 'error');
    return;
  }

  const sourceIndex = state.settings.servers.findIndex((item) => item.id === source.id);
  const copy = {
    ...source,
    id: randomId('server')
  };

  state.settings.servers.splice(sourceIndex + 1, 0, copy);
  state.selectedServerId = copy.id;
  state.settings.selectedServerId = copy.id;
  state.settings = await window.advanceTerminal.saveSettings(state.settings);
  state.selectedServerId = copy.id;
  state.editingServerId = copy.id;

  setLeftTab('connections');
  renderConnectionManageList();
  renderServerList();
  selectServer(copy.id);
  showToast(`Duplicated "${copy.name}".`);
}

async function deleteConnectionById(serverId) {
  const server = getServerById(serverId);

  if (!server) {
    showToast('Connection not found.', 5000, 'error');
    return;
  }

  if ((state.settings.servers || []).length <= 1) {
    showToast('At least one connection is required.');
    return;
  }

  const confirmed = confirm(`Delete connection "${server.name || 'selected connection'}"?`);

  if (!confirmed) {
    return;
  }

  state.settings.servers = state.settings.servers.filter((item) => item.id !== server.id);

  if (state.selectedServerId === server.id) {
    state.selectedServerId = state.settings.servers[0]?.id || null;
    state.settings.selectedServerId = state.selectedServerId;
  }

  state.settings = await window.advanceTerminal.saveSettings(state.settings);
  state.selectedServerId = state.settings.selectedServerId || state.selectedServerId;
  state.editingServerId = state.selectedServerId;

  updateConnectionGroupDatalist();
  renderConnectionManageList();
  renderServerList();

  if (state.selectedServerId) {
    const next = getServerById(state.selectedServerId);
    if (next) {
      selectServer(next.id);
    }
  }

  showToast('Connection deleted.');
}

async function duplicateCommandById(commandId) {
  const source = getCommandById(commandId);

  if (!source) {
    showToast('Command shortcut not found.', 5000, 'error');
    return;
  }

  const commands = getCommands();
  const sourceIndex = commands.findIndex((item) => item.id === source.id);
  const duplicate = {
    id: randomId('cmd'),
    name: `${source.name || 'Command Shortcut'} Copy`,
    category: getCommandCategory(source),
    command: source.command || ''
  };

  commands.splice(sourceIndex + 1, 0, duplicate);
  state.settings.commands = commands;
  state.editingCommandId = duplicate.id;
  state.settings = await window.advanceTerminal.saveSettings(state.settings);
  renderCommandList();
  renderManageCommandList();
  showToast('Command shortcut duplicated.');
}

async function deleteCommandById(commandId) {
  const command = getCommandById(commandId);

  if (!command) {
    showToast('Command shortcut not found.', 5000, 'error');
    return;
  }

  const confirmed = confirm(`Delete command shortcut "${command.name || 'selected command'}"?`);

  if (!confirmed) {
    return;
  }

  state.settings.commands = getCommands().filter((item) => item.id !== command.id);

  if (state.editingCommandId === command.id) {
    state.editingCommandId = state.settings.commands[0]?.id || null;
  }

  state.settings = await window.advanceTerminal.saveSettings(state.settings);
  renderCommandList();
  renderManageCommandList();
  showToast('Command shortcut deleted.');
}

function getDropPlacement(event, element) {
  const rect = element.getBoundingClientRect();
  return event.clientY > rect.top + (rect.height / 2);
}

async function reorderSettingsArray(kind, draggedId, targetId, insertAfter = false) {
  if (!draggedId || !targetId || draggedId === targetId || !state.settings) {
    return;
  }

  const property = kind === 'command' ? 'commands' : 'servers';
  const items = Array.isArray(state.settings[property]) ? [...state.settings[property]] : [];
  const fromIndex = items.findIndex((item) => item.id === draggedId);
  const targetIndex = items.findIndex((item) => item.id === targetId);

  if (fromIndex < 0 || targetIndex < 0) {
    return;
  }

  const [moved] = items.splice(fromIndex, 1);
  let insertIndex = items.findIndex((item) => item.id === targetId);

  if (insertIndex < 0) {
    items.splice(fromIndex, 0, moved);
    return;
  }

  if (insertAfter) {
    insertIndex += 1;
  }

  items.splice(insertIndex, 0, moved);
  state.settings[property] = items;
  await saveSettings({ toastMessage: '', debounce: true, refresh: false });

  if (kind === 'command') {
    renderCommandList();
    renderManageCommandList();
    showToast('Command order saved.', 1800, 'success');
  } else {
    renderServerList();
    renderConnectionManageList();
    showToast('Connection order saved.', 1800, 'success');
  }
}


function updateConnectionHealthFromSession(server, status, summary) {
  if (!server || !state.settings?.servers) {
    return;
  }

  const stored = getServerById(server.id);

  if (!stored) {
    return;
  }

  const previous = stored.health && typeof stored.health === 'object' ? stored.health : {};
  const checkedAt = new Date().toISOString();

  if (status === 'ready') {
    const readyBadge = stored.type === 'local' ? 'Local Ready' : 'SSH Ready';
    const previousBadges = Array.isArray(previous.badges) ? previous.badges : [];
    const projectBadges = previousBadges
      .filter((badge) => !/^(ssh ready|local ready|ready|tested|testing|issue|check|not tested)$/i.test(String(badge || '')))
      .slice(0, 5);

    stored.health = {
      ...previous,
      status: 'ready',
      summary: summary || 'Connection opened successfully.',
      checkedAt,
      badges: [readyBadge, ...projectBadges],
      checks: Array.isArray(previous.checks) ? previous.checks : []
    };
  } else {
    stored.health = {
      ...previous,
      status: 'error',
      summary: summary || 'Connection has an issue.',
      checkedAt,
      badges: ['Issue'],
      checks: Array.isArray(previous.checks) ? previous.checks : []
    };
  }

  renderServerList();
  scheduleSettingsSave({ refresh: false, delay: 1500 });
}


function renderHealthChecks(result) {
  const container = $('#connection-health-checks');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  const checks = Array.isArray(result?.checks) ? result.checks : [];

  if (!checks.length) {
    const empty = document.createElement('div');
    empty.className = 'connection-health-empty';
    empty.textContent = 'No check details available.';
    container.appendChild(empty);
    return;
  }

  checks.forEach((check) => {
    const row = document.createElement('div');
    row.className = `connection-health-check ${getConnectionHealthBadgeClass(check.status)}`;
    row.innerHTML = `
      <span class="connection-health-check-icon"></span>
      <div>
        <strong></strong>
        <p></p>
      </div>
    `;

    row.querySelector('strong').textContent = check.label || 'Check';
    row.querySelector('p').textContent = check.message || '';
    container.appendChild(row);
  });
}

function showConnectionHealthModal(server, result) {
  const modal = $('#connection-health-modal');

  if (!modal) {
    return;
  }

  const title = $('#connection-health-title');
  const subtitle = $('#connection-health-subtitle');
  const statusBox = $('#connection-health-status');
  const summary = $('#connection-health-summary');
  const meta = $('#connection-health-meta');
  const badges = $('#connection-health-badges');
  const health = result || {};

  if (title) {
    title.textContent = `${server?.name || 'Connection'} Health Check`;
  }

  if (subtitle) {
    subtitle.textContent = server?.type === 'remote'
      ? `${server.username || 'user'}@${server.host || 'host'}:${server.port || 22}`
      : 'Local terminal connection';
  }

  if (statusBox) {
    statusBox.className = `connection-health-status ${getConnectionHealthBadgeClass(health.status)}`;
  }

  if (summary) {
    summary.textContent = health.summary || 'Health check finished.';
  }

  if (meta) {
    meta.textContent = `Checked ${health.checkedAt ? new Date(health.checkedAt).toLocaleString() : 'now'}`;
  }

  if (badges) {
    badges.innerHTML = '';

    (health.badges || []).forEach((badge) => {
      const item = document.createElement('span');
      item.className = `connection-health-badge ${getConnectionHealthBadgeClass(health.status)}`;
      item.textContent = badge;
      badges.appendChild(item);
    });
  }

  renderHealthChecks(health);
  modal.classList.remove('hidden');
}

function closeConnectionHealthModal() {
  $('#connection-health-modal')?.classList.add('hidden');
}


function buildRunningConnectionHealthResult(server = {}) {
  const isLocal = server.type === 'local';
  const checkedAt = new Date().toISOString();

  return {
    status: 'checking',
    summary: 'Health check running...',
    checkedAt,
    badges: ['Testing'],
    checks: isLocal
      ? [
        {
          label: 'Local terminal',
          status: 'checking',
          message: 'Checking local terminal availability...'
        },
        {
          label: 'Start folder',
          status: 'checking',
          message: 'Checking if the configured start folder exists...'
        },
        {
          label: 'Project detected',
          status: 'checking',
          message: 'Scanning the folder for known project files...'
        },
        {
          label: 'Runtime tools',
          status: 'checking',
          message: 'Checking available local tools...'
        }
      ]
      : [
        {
          label: 'SSH private key',
          status: 'checking',
          message: 'Checking selected private key and authentication settings...'
        },
        {
          label: 'SSH connection',
          status: 'checking',
          message: 'Opening a temporary test connection...'
        },
        {
          label: 'Start folder',
          status: 'checking',
          message: 'Waiting to verify the configured start folder...'
        },
        {
          label: 'Project detected',
          status: 'checking',
          message: 'Waiting to scan project files after login...'
        },
        {
          label: 'Runtime tools',
          status: 'checking',
          message: 'Waiting to check PHP, Composer, Node, and NPM...'
        }
      ]
  };
}

async function testConnectionHealthById(serverId) {
  const server = getServerById(serverId);

  if (!server) {
    showToast('Connection not found.', 5000, 'error');
    return;
  }

  if (!window.advanceTerminal?.testConnectionHealth) {
    showToast('Connection health check is not available.', 7000, 'error');
    return;
  }

  const connectingSession = getConnectingTerminalSession();

  if (connectingSession) {
    showConnectionAttemptBusyNotification(connectingSession, server);
    return;
  }

  if (state.connectionHealthCheckInFlight) {
    showToast(
      `Connection check already running for ${state.connectionHealthCheckInFlight.serverName}.`,
      5000,
      'warning'
    );
    return;
  }

  state.connectionHealthCheckInFlight = {
    serverId: server.id,
    serverName: server.name || 'connection'
  };
  updateTerminalInteractionState();

  const runningResult = buildRunningConnectionHealthResult(server);

  showConnectionHealthModal(server, runningResult);
  appendLiveConsole(`Testing connection health: ${server.name}`, 'system');
  showToast(`Testing ${server.name || 'connection'}...`, 4000, 'info');

  try {
    const response = await window.advanceTerminal.testConnectionHealth({ serverId: server.id });

    if (!response?.ok && ['CONNECTION_BUSY', 'TERMINAL_BUSY', 'CONNECTION_CHECK_BUSY'].includes(response?.code)) {
      showToast(response.error || 'Another connection operation is already running.', 6000, 'warning');
      return;
    }

    if (!response?.ok) {
      throw new Error(response?.error || 'Health check failed.');
    }

    const result = sanitizeHealthForSettings(response.result);
    const freshServer = getServerById(server.id);

    if (freshServer) {
      freshServer.health = result;
    }

    showConnectionHealthModal(freshServer || server, result);
    appendLiveConsole(`Health check finished for ${server.name}: ${result.summary}`, result.status === 'ready' ? 'success' : (result.status === 'warning' ? 'warning' : 'error'));
    scheduleSettingsSave({ refresh: false });

    if (result.status === 'ready') {
      showToast(`${server.name} is ready.`, 4000, 'success');
    } else if (result.status === 'warning') {
      showToast(`${server.name} works, but has warnings.`, 6000, 'warning');
    } else {
      showToast(`${server.name} needs attention.`, 7000, 'error');
    }
  } catch (error) {
    const result = sanitizeHealthForSettings({
      status: 'error',
      summary: error.message || 'Health check failed.',
      checkedAt: new Date().toISOString(),
      badges: ['Issue'],
      checks: [
        {
          label: 'Health check',
          status: 'error',
          message: error.message || 'Health check failed.'
        }
      ]
    });

    const freshServer = getServerById(server.id);

    if (freshServer) {
      freshServer.health = result;
    }

    showConnectionHealthModal(freshServer || server, result);
    appendLiveConsole(`Health check failed for ${server.name}: ${result.summary}`, 'error');
    scheduleSettingsSave({ refresh: false });
    showToast(`Health check failed: ${result.summary}`, 7000, 'error');
  } finally {
    if (state.connectionHealthCheckInFlight?.serverId === server.id) {
      state.connectionHealthCheckInFlight = null;
    }

    updateTerminalInteractionState();
  }
}


function showConnectionContextMenu(event, server) {
  showSidebarContextMenu(event, [
    {
      label: server.type === 'local' ? 'Open' : 'Connect',
      action: () => {
        selectServer(server.id);
        connectSelectedServer();
      }
    },
    {
      label: 'Test Connection',
      action: () => testConnectionHealthById(server.id).catch((error) => showToast(`Health check failed: ${error.message}`, 7000, 'error'))
    },
    {
      label: isConnectionPinned(server) ? 'Unpin' : 'Pin to Top',
      action: () => setConnectionPinned(server.id, !isConnectionPinned(server)).catch((error) => showToast(`Pin failed: ${error.message}`, 7000, 'error'))
    },
    {
      label: 'Edit',
      action: () => openConnectionEditor(server.id)
    },
    {
      label: 'Duplicate',
      action: () => duplicateConnectionById(server.id).catch((error) => showToast(`Duplicate failed: ${error.message}`, 7000, 'error'))
    },
    {
      label: 'Delete',
      danger: true,
      action: () => deleteConnectionById(server.id).catch((error) => showToast(`Delete failed: ${error.message}`, 7000, 'error'))
    }
  ]);
}

async function setCommandPinned(commandId, pinned) {
  const commands = getCommands();
  const index = commands.findIndex((item) => item.id === commandId);

  if (index < 0) {
    showToast('Command shortcut not found.', 5000, 'error');
    return;
  }

  const command = {
    ...commands[index],
    pinned: Boolean(pinned)
  };

  let nextCommands = commands.map((item) => (item.id === command.id ? command : item));

  if (command.pinned) {
    nextCommands = [
      command,
      ...nextCommands.filter((item) => item.id !== command.id)
    ];
  }

  state.settings.commands = nextCommands;
  await saveSettings({ toastMessage: '', refresh: true });
  appendLiveConsole(`${command.name || 'Command shortcut'} ${command.pinned ? 'pinned to the top' : 'unpinned'}.`, 'system');
  showToast(`${command.name || 'Command shortcut'} ${command.pinned ? 'pinned to the top.' : 'unpinned.'}`, 3500, 'success');
}

function getCommandPinMenuItem(command) {
  if (!command?.id) {
    return null;
  }

  const pinned = isCommandPinned(command);

  return {
    label: pinned ? 'Unpin Command' : 'Pin Command to Top',
    action: () => setCommandPinned(command.id, !pinned).catch((error) => showToast(`Command pin failed: ${error.message}`, 7000, 'error'))
  };
}

function showCommandsPanelContextMenu(event) {
  showSidebarContextMenu(event, [
    {
      label: 'New Command',
      action: () => openCommandManagerModal()
    }
  ]);
}

function showCommandContextMenu(event, command) {
  const pinItem = getCommandPinMenuItem(command);
  const items = [
    {
      label: 'Run Command',
      action: () => sendCommandToActiveTerminal(command)
    }
  ];

  if (pinItem) {
    items.push(pinItem);
  }

  items.push(
    {
      label: 'Edit',
      action: () => openCommandManagerModal(command.id)
    },
    {
      label: 'Duplicate',
      action: () => duplicateCommandById(command.id).catch((error) => showToast(`Duplicate failed: ${error.message}`, 7000, 'error'))
    },
    {
      label: 'Delete',
      danger: true,
      action: () => deleteCommandById(command.id).catch((error) => showToast(`Delete failed: ${error.message}`, 7000, 'error'))
    }
  );

  showSidebarContextMenu(event, items);
}


function clearReconnectTimer(terminalId) {
  const timer = state.reconnectTimers.get(terminalId);

  if (timer) {
    clearTimeout(timer);
    state.reconnectTimers.delete(terminalId);
  }
}

function showTerminalSession(session) {
  if (!session) {
    return;
  }

  closeAddConnectionModal();
  setActiveView('terminal', 'terminal');
  activateTerminal(session.terminalId);

  requestAnimationFrame(() => {
    fitActiveTerminal();
    focusTerminal(session);
  });
}


function setupConnectionSubtitleMarquee(card) {
  const subtitle = card?.querySelector?.('.server-subtitle');
  const text = card?.querySelector?.('.server-subtitle-text');

  if (!subtitle || !text) {
    return;
  }

  const stop = () => {
    subtitle.classList.remove('is-marquee');
    text.style.removeProperty('--server-subtitle-scroll');
    text.style.removeProperty('--server-subtitle-marquee-duration');
  };

  const start = () => {
    stop();

    requestAnimationFrame(() => {
      const overflow = Math.max(0, text.scrollWidth - subtitle.clientWidth);

      if (overflow <= 4) {
        return;
      }

      text.style.setProperty('--server-subtitle-scroll', `-${overflow + 12}px`);
      text.style.setProperty('--server-subtitle-marquee-duration', `${Math.min(14, Math.max(5, overflow / 26))}s`);
      subtitle.classList.add('is-marquee');
    });
  };

  subtitle.addEventListener('mouseenter', start);
  subtitle.addEventListener('mouseleave', stop);
  subtitle.addEventListener('focusin', start);
  subtitle.addEventListener('focusout', stop);
}


function compactConnectionSubtitle(server = {}) {
  if (server.type === 'local') {
    return normalizeTerminalLocation(server.workingDirectory)
      || String(server.description || '').trim()
      || 'Local terminal';
  }

  const username = String(server.username || 'user').trim();
  const host = String(server.host || 'host').trim();
  const port = Number(server.port || 22);
  const portSuffix = Number.isFinite(port) && port !== 22 ? `:${port}` : '';

  return `${username}@${host}${portSuffix}`;
}

function createConnectionCard(server) {
  const card = document.createElement('div');
  card.className = `server-card ${server.id === state.selectedServerId ? 'selected' : ''} ${isConnectionPinned(server) ? 'pinned' : ''}`;
  card.dataset.serverId = server.id;
  card.dataset.connectionGroup = getServerGroup(server);
  card.draggable = true;
  card.title = isConnectionPinned(server) ? 'Pinned. Right-click for actions. Drag to arrange.' : 'Right-click for actions. Drag to arrange.';

  const connectionType = server.type === 'local' ? 'local' : 'remote';
  const connectionTypeLabel = connectionType === 'local' ? 'Local terminal' : 'SSH connection';

  card.innerHTML = `
    <div class="server-main">
      <div class="server-name-row">
        <div class="server-name"></div>
        <span class="server-pin-badge" title="Pinned connection" aria-label="Pinned">${connectionPinIconSvg()}</span>
      </div>
      <div class="server-subtitle" aria-label="Connection details">
        <span class="server-subtitle-text"></span>
      </div>
    </div>
    <button class="connect-card-button" type="button">${connectionType === 'local' ? 'Open' : 'Connect'}</button>
  `;

  const subtitle = compactConnectionSubtitle(server);
  const fullDetails = serverSubtitle(server);
  card.querySelector('.server-name').textContent = server.name || connectionTypeLabel;
  card.querySelector('.server-subtitle').title = fullDetails;
  card.querySelector('.server-subtitle-text').textContent = subtitle;
  setupConnectionSubtitleMarquee(card);

  card.addEventListener('click', (event) => {
    if (!event.target.classList.contains('connect-card-button')) {
      selectServer(server.id);
    }
  });

  card.addEventListener('contextmenu', (event) => {
    showConnectionContextMenu(event, server);
  });

  card.addEventListener('dragstart', (event) => {
    state.draggingServerId = server.id;
    card.classList.add('is-dragging');
    hideSidebarContextMenu();

    try {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', server.id);
    } catch (_) {
      // Ignore drag data errors in older webviews.
    }
  });

  card.addEventListener('dragend', () => {
    state.draggingServerId = null;
    card.classList.remove('is-dragging');
    $$('.server-card.drag-over').forEach((item) => item.classList.remove('drag-over', 'drop-after'));
  });

  card.addEventListener('dragover', (event) => {
    if (!state.draggingServerId || state.draggingServerId === server.id) {
      return;
    }

    event.preventDefault();
    card.classList.add('drag-over');
    card.classList.toggle('drop-after', getDropPlacement(event, card));
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-over', 'drop-after');
  });

  card.addEventListener('drop', (event) => {
    event.preventDefault();
    const insertAfter = getDropPlacement(event, card);
    const draggedId = state.draggingServerId;
    state.draggingServerId = null;
    reorderSettingsArray('server', draggedId, server.id, insertAfter).catch((error) => {
      showToast(`Connection reorder failed: ${error.message}`, 7000, 'error');
    });
  });

  card.querySelector('.connect-card-button').addEventListener('click', (event) => {
    event.stopPropagation();
    selectServer(server.id);
    connectSelectedServer();
  });

  return card;
}

function renderConnectionGroupSection(list, groupName, servers, { pinned = false } = {}) {
  const header = document.createElement('div');
  header.className = `server-group-header ${pinned ? 'pinned-group-header' : ''}`;
  header.innerHTML = `
    <span class="server-group-title"></span>
    <span class="server-group-count"></span>
  `;
  header.querySelector('.server-group-title').innerHTML = pinned ? `${connectionPinIconSvg()} <span>Pinned</span>` : '';
  if (!pinned) {
    header.querySelector('.server-group-title').textContent = groupName;
  }
  header.querySelector('.server-group-count').textContent = String(servers.length);
  list.appendChild(header);

  servers.forEach((server) => {
    list.appendChild(createConnectionCard(server));
  });
}

function renderServerList() {
  const list = $('#server-list');
  const searchInput = $('#server-search');

  if (!list || !searchInput || !state.settings) {
    return;
  }

  const search = (searchInput.value || '').toLowerCase();
  const servers = sortConnectionsForDisplay((state.settings.servers || []).filter((server) => {
    const haystack = `${server.name || ''} ${server.description || ''} ${server.host || ''} ${server.username || ''} ${getServerGroup(server)}`.toLowerCase();
    return matchesConnectionFilter(server) && haystack.includes(search);
  }));

  updateConnectionFilterButtons();
  renderConnectionGroupOptions();
  updateConnectionGroupDatalist();
  list.innerHTML = '';

  if (!servers.length) {
    const empty = document.createElement('div');
    empty.className = 'command-empty';
    empty.textContent = 'No connections match this view.';
    list.appendChild(empty);
    return;
  }

  const pinnedServers = servers.filter((server) => isConnectionPinned(server));
  const regularServers = servers.filter((server) => !isConnectionPinned(server));

  if (pinnedServers.length) {
    renderConnectionGroupSection(list, 'Pinned', pinnedServers, { pinned: true });
  }

  if (state.connectionGroupFilter && state.connectionGroupFilter !== 'all') {
    regularServers.forEach((server) => {
      list.appendChild(createConnectionCard(server));
    });
    updateTerminalInteractionState();
    return;
  }

  const grouped = new Map();

  regularServers.forEach((server) => {
    const group = getServerGroup(server);

    if (!grouped.has(group)) {
      grouped.set(group, []);
    }

    grouped.get(group).push(server);
  });

  grouped.forEach((groupServers, groupName) => {
    renderConnectionGroupSection(list, groupName, groupServers);
  });

  updateTerminalInteractionState();
}

function selectServer(serverId) {
  const previousServerId = state.selectedServerId;
  state.selectedServerId = serverId;
  state.settings.selectedServerId = serverId;
  renderServerList();
  loadServerForm(serverId);
  renderCommandSelectedConnectionActions();

  const server = getSelectedServer();
  if (server) {
    setTerminalHeaderTitle(server.name);

    if (previousServerId && previousServerId !== serverId) {
      appendActivityFeedEvent(`Selected connection: ${server.name || server.host || server.id}.`, 'action', { dedupeMs: 800 });
    }
  }
}



function getTerminalGroup(groupId) {
  return groupId ? state.terminalGroups.get(groupId) || null : null;
}

function getTerminalGroupForSession(sessionOrId) {
  const session = typeof sessionOrId === 'string'
    ? state.terminals.get(sessionOrId)
    : sessionOrId;

  if (!session) {
    return null;
  }

  return getTerminalGroup(session.groupId);
}

function collectSplitTerminalIds(node, result = []) {
  if (!node) {
    return result;
  }

  if (node.type === 'leaf') {
    if (node.terminalId) {
      result.push(node.terminalId);
    }
    return result;
  }

  collectSplitTerminalIds(node.first, result);
  collectSplitTerminalIds(node.second, result);
  return result;
}

function splitGroupTerminalIds(group) {
  return group ? collectSplitTerminalIds(group.root, []) : [];
}

function getFirstTerminalIdInGroup(group) {
  return splitGroupTerminalIds(group).find((terminalId) => state.terminals.has(terminalId)) || null;
}

function terminalGroupPaneCount(group) {
  return splitGroupTerminalIds(group)
    .filter((terminalId) => {
      const session = state.terminals.get(terminalId);
      return session && !session.closed;
    })
    .length;
}

function createSplitLeaf(terminalId) {
  return {
    type: 'leaf',
    terminalId
  };
}

function createSplitNode(direction, first, second, ratio = 0.5) {
  return {
    type: 'split',
    id: randomId('split'),
    direction: direction === 'column' ? 'column' : 'row',
    ratio: Math.min(0.85, Math.max(0.15, Number(ratio) || 0.5)),
    first,
    second
  };
}

function ensureTerminalGroupContainer(group) {
  if (!group) {
    return null;
  }

  if (group.container?.isConnected) {
    return group.container;
  }

  const container = document.createElement('div');
  container.className = 'terminal-split-group';
  container.dataset.groupId = group.id;
  $('#terminal-host')?.appendChild(container);
  group.container = container;
  return container;
}

function isTerminalSessionVisible(session) {
  if (!session || session.closed) {
    return false;
  }

  const group = getTerminalGroupForSession(session);
  return Boolean(group && group.id === state.activeTerminalGroupId && group.container?.classList.contains('active'));
}

function scheduleActiveTerminalGroupFit() {
  if (state.terminalFitAnimationFrame) {
    cancelAnimationFrame(state.terminalFitAnimationFrame);
  }

  state.terminalFitAnimationFrame = requestAnimationFrame(() => {
    state.terminalFitAnimationFrame = null;
    const group = getTerminalGroup(state.activeTerminalGroupId);

    splitGroupTerminalIds(group).forEach((terminalId) => {
      fitTerminalSessionNow(state.terminals.get(terminalId));
    });
  });
}

function installSplitDividerDrag(divider, splitElement, node) {
  if (!divider || !splitElement || !node) {
    return;
  }

  divider.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    divider.setPointerCapture?.(event.pointerId);
    document.body.classList.add('terminal-split-resizing');

    state.splitResize = {
      pointerId: event.pointerId,
      divider,
      splitElement,
      node
    };
  });

  divider.addEventListener('pointermove', (event) => {
    const drag = state.splitResize;

    if (!drag || drag.pointerId !== event.pointerId || drag.divider !== divider) {
      return;
    }

    const rect = splitElement.getBoundingClientRect();
    let ratio;

    if (node.direction === 'column') {
      ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
    } else {
      ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
    }

    node.ratio = Math.min(0.85, Math.max(0.15, ratio));
    const first = splitElement.children[0];
    const second = splitElement.children[2];

    if (node.direction === 'column') {
      splitElement.style.gridTemplateRows = `${node.ratio}fr 6px ${1 - node.ratio}fr`;
      splitElement.style.gridTemplateColumns = 'minmax(0, 1fr)';
    } else {
      splitElement.style.gridTemplateColumns = `${node.ratio}fr 6px ${1 - node.ratio}fr`;
      splitElement.style.gridTemplateRows = 'minmax(0, 1fr)';
    }

    first?.classList.add('terminal-split-dragging');
    second?.classList.add('terminal-split-dragging');
    scheduleActiveTerminalGroupFit();
  });

  const finish = (event) => {
    const drag = state.splitResize;

    if (!drag || drag.divider !== divider || (event && drag.pointerId !== event.pointerId)) {
      return;
    }

    try {
      divider.releasePointerCapture?.(drag.pointerId);
    } catch (_) {
      // Ignore pointer-capture cleanup failure.
    }

    state.splitResize = null;
    document.body.classList.remove('terminal-split-resizing');
    splitElement.querySelectorAll('.terminal-split-dragging').forEach((element) => {
      element.classList.remove('terminal-split-dragging');
    });
    scheduleActiveTerminalGroupFit();
  };

  divider.addEventListener('pointerup', finish);
  divider.addEventListener('pointercancel', finish);
  divider.addEventListener('lostpointercapture', finish);
}

function buildTerminalSplitNode(group, node) {
  if (!group || !node) {
    return document.createElement('div');
  }

  if (node.type === 'leaf') {
    const leaf = document.createElement('div');
    leaf.className = 'terminal-split-leaf';
    leaf.dataset.terminalId = node.terminalId;

    const session = state.terminals.get(node.terminalId);
    if (!session) {
      leaf.classList.add('terminal-split-leaf-missing');
      return leaf;
    }

    const header = document.createElement('div');
    header.className = 'terminal-split-pane-header';

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'terminal-split-pane-label';
    label.title = 'Focus this terminal pane';
    label.textContent = session.server?.name || 'Terminal';
    label.addEventListener('click', () => activateTerminalAndFocus(session.terminalId));

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'terminal-split-pane-close';
    close.title = 'Close this pane';
    close.setAttribute('aria-label', `Close ${session.server?.name || 'terminal'} pane`);
    close.textContent = '×';
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      closeTerminalSession(session.terminalId);
    });

    header.append(label, close);
    leaf.appendChild(header);
    leaf.appendChild(session.pane);
    return leaf;
  }

  const split = document.createElement('div');
  split.className = `terminal-split-node terminal-split-${node.direction === 'column' ? 'column' : 'row'}`;
  split.dataset.splitId = node.id || '';
  const first = buildTerminalSplitNode(group, node.first);
  const divider = document.createElement('div');
  divider.className = `terminal-split-divider terminal-split-divider-${node.direction === 'column' ? 'column' : 'row'}`;
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-orientation', node.direction === 'column' ? 'horizontal' : 'vertical');
  divider.title = 'Drag to resize terminal panes';
  const second = buildTerminalSplitNode(group, node.second);

  if (node.direction === 'column') {
    split.style.gridTemplateRows = `${node.ratio}fr 6px ${1 - node.ratio}fr`;
    split.style.gridTemplateColumns = 'minmax(0, 1fr)';
  } else {
    split.style.gridTemplateColumns = `${node.ratio}fr 6px ${1 - node.ratio}fr`;
    split.style.gridTemplateRows = 'minmax(0, 1fr)';
  }

  split.append(first, divider, second);
  installSplitDividerDrag(divider, split, node);
  return split;
}

function renderTerminalGroupLayout(group) {
  if (!group) {
    return;
  }

  const container = ensureTerminalGroupContainer(group);
  const layout = buildTerminalSplitNode(group, group.root);
  const paneCount = splitGroupTerminalIds(group).length;

  container.replaceChildren(layout);
  container.classList.toggle('is-split', paneCount > 1);
  container.classList.toggle('active', group.id === state.activeTerminalGroupId);

  splitGroupTerminalIds(group).forEach((terminalId) => {
    const session = state.terminals.get(terminalId);

    if (!session?.pane) {
      return;
    }

    session.pane.classList.toggle('active', terminalId === state.activeTerminalId);
    session.pane.classList.toggle('split-pane', paneCount > 1);
  });

  requestAnimationFrame(() => {
    if (group.id === state.activeTerminalGroupId) {
      scheduleActiveTerminalGroupFit();
    }
  });
}

function syncTerminalGroupVisibility() {
  state.terminalGroups.forEach((group) => {
    const active = group.id === state.activeTerminalGroupId;
    const container = ensureTerminalGroupContainer(group);
    container.classList.toggle('active', active);

    splitGroupTerminalIds(group).forEach((terminalId) => {
      const session = state.terminals.get(terminalId);
      session?.pane?.classList.toggle('active', active && terminalId === state.activeTerminalId);
    });
  });
}

function createStandaloneTerminalGroup(session) {
  if (!session) {
    return null;
  }

  const group = {
    id: randomId('tab'),
    root: createSplitLeaf(session.terminalId),
    activeTerminalId: session.terminalId,
    title: '',
    color: '',
    pinned: false,
    container: null
  };

  session.groupId = group.id;
  state.terminalGroups.set(group.id, group);
  renderTerminalGroupLayout(group);
  return group;
}

function replaceTerminalSplitLeaf(node, terminalId, replacement) {
  if (!node) {
    return node;
  }

  if (node.type === 'leaf') {
    return node.terminalId === terminalId ? replacement : node;
  }

  node.first = replaceTerminalSplitLeaf(node.first, terminalId, replacement);
  node.second = replaceTerminalSplitLeaf(node.second, terminalId, replacement);
  return node;
}

function removeTerminalSplitLeaf(node, terminalId) {
  if (!node) {
    return null;
  }

  if (node.type === 'leaf') {
    return node.terminalId === terminalId ? null : node;
  }

  const first = removeTerminalSplitLeaf(node.first, terminalId);
  const second = removeTerminalSplitLeaf(node.second, terminalId);

  if (!first) return second;
  if (!second) return first;

  node.first = first;
  node.second = second;
  return node;
}

function removeTerminalFromSplitGroup(terminalId, groupId = '') {
  const group = getTerminalGroup(groupId) || getTerminalGroupForSession(terminalId);

  if (!group) {
    return null;
  }

  group.root = removeTerminalSplitLeaf(group.root, terminalId);

  if (!group.root) {
    group.container?.remove();
    state.terminalGroups.delete(group.id);

    if (state.activeTerminalGroupId === group.id) {
      state.activeTerminalGroupId = null;
    }

    return null;
  }

  if (group.activeTerminalId === terminalId || !state.terminals.has(group.activeTerminalId)) {
    group.activeTerminalId = getFirstTerminalIdInGroup(group);
  }

  renderTerminalGroupLayout(group);
  return group;
}

function attachTerminalAsSplit(baseTerminalId, newTerminalId, direction = 'row') {
  const baseSession = state.terminals.get(baseTerminalId);
  const newSession = state.terminals.get(newTerminalId);
  const baseGroup = getTerminalGroupForSession(baseSession);
  const newGroup = getTerminalGroupForSession(newSession);

  if (!baseSession || !newSession || !baseGroup || !newGroup || baseGroup.id === newGroup.id) {
    return false;
  }

  if (splitGroupTerminalIds(baseGroup).length >= 4) {
    showToast('A split tab can contain up to 4 terminal panes.', 4500, 'warning');
    return false;
  }

  newGroup.container?.remove();
  state.terminalGroups.delete(newGroup.id);

  newSession.groupId = baseGroup.id;
  const replacement = createSplitNode(
    direction,
    createSplitLeaf(baseTerminalId),
    createSplitLeaf(newTerminalId),
    0.5
  );
  baseGroup.root = replaceTerminalSplitLeaf(baseGroup.root, baseTerminalId, replacement);
  baseGroup.activeTerminalId = newTerminalId;
  state.activeTerminalGroupId = baseGroup.id;
  state.activeTerminalId = newTerminalId;

  renderTerminalGroupLayout(baseGroup);
  syncTerminalGroupVisibility();
  renderTerminalTabs();
  updateCurrentTabFooter();
  updateTerminalLocationHeader(newSession);
  setTerminalHeaderTitle(newSession.server?.name || 'Terminal');
  setTerminalStatus(newSession.status || 'connected');

  appendActivityFeedEvent(
    `Split terminal ${direction === 'column' ? 'down' : 'right'}: ${newSession.server?.name || newTerminalId}.`,
    'action',
    { dedupeMs: 900 }
  );

  requestAnimationFrame(() => {
    scheduleActiveTerminalGroupFit();
    focusTerminal(newSession);
  });

  return true;
}

function focusNextSplitPane() {
  const group = getTerminalGroup(state.activeTerminalGroupId);
  const terminalIds = splitGroupTerminalIds(group)
    .filter((terminalId) => {
      const session = state.terminals.get(terminalId);
      return session && !session.closed;
    });

  if (terminalIds.length < 2) {
    showToast('The active tab has only one terminal pane.', 3000, 'info');
    return false;
  }

  const currentIndex = Math.max(0, terminalIds.indexOf(state.activeTerminalId));
  const nextTerminalId = terminalIds[(currentIndex + 1) % terminalIds.length];
  activateTerminalAndFocus(nextTerminalId);
  return true;
}

function swapSplitTerminalIds(node, firstTerminalId, secondTerminalId) {
  if (!node) {
    return;
  }

  if (node.type === 'leaf') {
    if (node.terminalId === firstTerminalId) {
      node.terminalId = secondTerminalId;
    } else if (node.terminalId === secondTerminalId) {
      node.terminalId = firstTerminalId;
    }
    return;
  }

  swapSplitTerminalIds(node.first, firstTerminalId, secondTerminalId);
  swapSplitTerminalIds(node.second, firstTerminalId, secondTerminalId);
}

function swapActiveSplitPaneWithNext() {
  const group = getTerminalGroup(state.activeTerminalGroupId);
  const terminalIds = splitGroupTerminalIds(group)
    .filter((terminalId) => state.terminals.has(terminalId));

  if (terminalIds.length < 2) {
    showToast('The active tab has only one terminal pane.', 3000, 'info');
    return false;
  }

  const currentIndex = Math.max(0, terminalIds.indexOf(state.activeTerminalId));
  const nextTerminalId = terminalIds[(currentIndex + 1) % terminalIds.length];

  swapSplitTerminalIds(group.root, state.activeTerminalId, nextTerminalId);
  renderTerminalGroupLayout(group);
  renderTerminalTabs();
  appendActivityFeedEvent('Swapped terminal pane positions.', 'action', { dedupeMs: 800 });
  return true;
}


function normalizeTerminalTabTitle(value) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function normalizeTerminalTabColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : '';
}

function getTerminalGroupPrimarySession(group) {
  if (!group) {
    return null;
  }

  const terminalIds = splitGroupTerminalIds(group)
    .filter((terminalId) => state.terminals.has(terminalId));
  const terminalId = group.activeTerminalId && terminalIds.includes(group.activeTerminalId)
    ? group.activeTerminalId
    : terminalIds[0];

  return terminalId ? state.terminals.get(terminalId) || null : null;
}

function getTerminalGroupDisplayTitle(group) {
  const customTitle = normalizeTerminalTabTitle(group?.title);
  if (customTitle) {
    return customTitle;
  }

  return getTerminalGroupPrimarySession(group)?.server?.name || 'Terminal';
}

function captureTerminalGroupSnapshot(group) {
  if (!group) {
    return null;
  }

  const terminalIds = splitGroupTerminalIds(group)
    .filter((terminalId) => {
      const session = state.terminals.get(terminalId);
      return session && !session.closed;
    });

  if (!terminalIds.length) {
    return null;
  }

  const sessions = [];
  const sessionIndexByTerminalId = new Map();

  terminalIds.forEach((terminalId) => {
    const session = state.terminals.get(terminalId);
    const descriptor = workspaceSessionFromTerminal(session);

    if (!descriptor) {
      return;
    }

    sessionIndexByTerminalId.set(terminalId, sessions.length);
    sessions.push(descriptor);
  });

  if (!sessions.length) {
    return null;
  }

  const root = serializeWorkspaceSplitNode(group.root, sessionIndexByTerminalId);
  if (!root) {
    return null;
  }

  const activeSessionIndex = sessionIndexByTerminalId.get(group.activeTerminalId);
  return {
    id: randomId('closed-tab'),
    title: normalizeTerminalTabTitle(group.title),
    color: normalizeTerminalTabColor(group.color),
    pinned: group.pinned === true,
    sessions,
    root,
    activeSessionIndex: Number.isInteger(activeSessionIndex) ? activeSessionIndex : 0,
    closedAt: Date.now()
  };
}


function terminalTabRootIdentity(node) {
  if (!node || typeof node !== 'object') {
    return null;
  }

  if (node.type === 'leaf') {
    const sessionIndex = Number(node.sessionIndex);
    return Number.isInteger(sessionIndex) ? { type: 'leaf', sessionIndex } : null;
  }

  return {
    type: 'split',
    direction: node.direction === 'column' ? 'column' : 'row',
    first: terminalTabRootIdentity(node.first),
    second: terminalTabRootIdentity(node.second)
  };
}

function persistentTerminalTabSignature(snapshot) {
  const sessions = (Array.isArray(snapshot?.sessions) ? snapshot.sessions : []).map((item) => ({
    kind: item?.kind === 'profile' ? 'profile' : 'connection',
    targetId: item?.kind === 'profile'
      ? String(item?.profileId || '')
      : String(item?.serverId || ''),
    type: item?.type === 'remote' ? 'remote' : 'local'
  }));

  return JSON.stringify({
    sessions,
    root: terminalTabRootIdentity(snapshot?.root)
  });
}

function persistentPinnedTerminalTabSnapshot(group) {
  const snapshot = captureTerminalGroupSnapshot(group);

  if (!snapshot) {
    return null;
  }

  return {
    sessions: snapshot.sessions,
    root: snapshot.root,
    activeSessionIndex: snapshot.activeSessionIndex,
    title: snapshot.title,
    color: snapshot.color,
    pinned: true
  };
}

function capturePersistentPinnedTerminalTabs() {
  const snapshots = [];

  state.terminalGroups.forEach((group) => {
    if (group?.pinned !== true) {
      return;
    }

    const snapshot = persistentPinnedTerminalTabSnapshot(group);
    if (snapshot) snapshots.push(snapshot);
  });

  return snapshots.slice(0, 12);
}

function syncPinnedTerminalTabsSetting() {
  if (!state.settings) {
    return [];
  }

  const snapshots = capturePersistentPinnedTerminalTabs();
  state.settings.pinnedTerminalTabs = snapshots;
  return snapshots;
}

function queuePinnedTerminalTabsPersist({ immediate = false } = {}) {
  if (!state.settings) {
    return;
  }

  syncPinnedTerminalTabsSetting();

  const savePromise = immediate
    ? saveSettingsNow({ refresh: false })
    : scheduleSettingsSave({ refresh: false, delay: 120 });

  Promise.resolve(savePromise).catch((error) => {
    appendActivityFeedEvent(
      `Pinned terminal tabs could not be saved: ${error.message}`,
      'warning',
      { dedupeMs: 1600 }
    );
  });
}

async function restorePinnedTerminalTabsOnStartup() {
  if (state.pinnedTabsStartupRestoreAttempted) {
    return;
  }

  state.pinnedTabsStartupRestoreAttempted = true;
  const snapshots = Array.isArray(state.settings?.pinnedTerminalTabs)
    ? state.settings.pinnedTerminalTabs
    : [];

  if (!snapshots.length) {
    return;
  }

  const existingBySignature = new Map();

  state.terminalGroups.forEach((group) => {
    const snapshot = captureTerminalGroupSnapshot(group);
    if (!snapshot) return;

    const signature = persistentTerminalTabSignature(snapshot);
    const groups = existingBySignature.get(signature) || [];
    groups.push(group);
    existingBySignature.set(signature, groups);
  });

  let restoredCount = 0;
  let matchedCount = 0;

  for (const snapshot of snapshots) {
    const signature = persistentTerminalTabSignature(snapshot);
    const matchingGroups = existingBySignature.get(signature) || [];
    const existingGroup = matchingGroups.shift() || null;

    if (matchingGroups.length) {
      existingBySignature.set(signature, matchingGroups);
    } else {
      existingBySignature.delete(signature);
    }

    if (existingGroup) {
      existingGroup.pinned = true;
      matchedCount += 1;
      continue;
    }

    const restored = await restoreTerminalGroupSnapshot({
      ...snapshot,
      pinned: true
    });

    if (restored) {
      restored.pinned = true;
      restoredCount += 1;
    }
  }

  reorderPinnedTerminalGroups();
  renderTerminalTabs();
  updateCurrentTabFooter();

  if (restoredCount || matchedCount) {
    appendActivityFeedEvent(
      `Pinned tabs restored: ${matchedCount + restoredCount}.`,
      'system',
      { dedupeMs: 1200 }
    );
  }
}

function rememberClosedTerminalGroup(group) {
  const snapshot = captureTerminalGroupSnapshot(group);

  if (!snapshot) {
    return false;
  }

  state.closedTerminalTabs = [
    snapshot,
    ...(Array.isArray(state.closedTerminalTabs) ? state.closedTerminalTabs : [])
  ].slice(0, 12);

  return true;
}

async function restoreTerminalGroupSnapshot(snapshot, { duplicate = false } = {}) {
  if (!snapshot || !Array.isArray(snapshot.sessions) || !snapshot.sessions.length) {
    showToast('No closed terminal tab is available to restore.', 3500, 'info');
    return null;
  }

  if (state.workspaceRestoreInFlight) {
    showToast('Wait for the current workspace restore to finish.', 4000, 'warning');
    return null;
  }

  const openedByIndex = new Map();
  const createdSessions = [];

  for (let index = 0; index < snapshot.sessions.length; index += 1) {
    const item = snapshot.sessions[index];
    const target = workspaceSessionTarget(item);

    if (!target) {
      appendActivityFeedEvent(`Tab restore skipped missing target: ${item.label || 'terminal'}.`, 'warning', { dedupeMs: 900 });
      continue;
    }

    let session = null;

    if (target.kind === 'profile') {
      session = await launchTerminalProfile(target.profile.id, {
        workingDirectory: item.workingDirectory || ''
      });
    } else {
      selectServer(target.server.id);
      session = await connectSelectedServer({
        workingDirectory: item.workingDirectory || ''
      });
    }

    if (!session) {
      continue;
    }

    openedByIndex.set(index, session.terminalId);
    createdSessions.push(session);

    if (session.server?.type === 'remote') {
      const ready = await waitForWorkspaceSessionReady(session);
      if (!ready) {
        appendActivityFeedEvent(
          `Tab restore stopped because ${session.server?.name || 'SSH'} did not become ready.`,
          'warning',
          { dedupeMs: 1200 }
        );
        break;
      }
    }

    await delayWorkspace(40);
  }

  if (!openedByIndex.size) {
    showToast('The terminal tab could not be restored because its saved targets are unavailable.', 6000, 'warning');
    return null;
  }

  const root = deserializeWorkspaceSplitNode(snapshot.root, openedByIndex);
  if (!root) {
    return null;
  }

  const terminalIds = collectSplitTerminalIds(root, [])
    .filter((terminalId) => state.terminals.has(terminalId));

  if (!terminalIds.length) {
    return null;
  }

  const oldGroupIds = new Set(
    terminalIds
      .map((terminalId) => state.terminals.get(terminalId)?.groupId)
      .filter(Boolean)
  );

  oldGroupIds.forEach((groupId) => {
    const group = getTerminalGroup(groupId);
    group?.container?.remove();
    state.terminalGroups.delete(groupId);
  });

  const requestedActiveId = openedByIndex.get(Number(snapshot.activeSessionIndex));
  const group = {
    id: randomId('tab'),
    root,
    activeTerminalId: terminalIds.includes(requestedActiveId) ? requestedActiveId : terminalIds[0],
    title: duplicate && normalizeTerminalTabTitle(snapshot.title)
      ? normalizeTerminalTabTitle(`${snapshot.title} copy`)
      : normalizeTerminalTabTitle(snapshot.title),
    color: normalizeTerminalTabColor(snapshot.color),
    pinned: duplicate ? false : snapshot.pinned === true,
    container: null
  };

  terminalIds.forEach((terminalId) => {
    const session = state.terminals.get(terminalId);
    if (session) {
      session.groupId = group.id;
    }
  });

  state.terminalGroups.set(group.id, group);
  state.activeTerminalGroupId = group.id;
  state.activeTerminalId = group.activeTerminalId;

  renderTerminalGroupLayout(group);
  syncTerminalGroupVisibility();
  renderTerminalTabs();
  updateCurrentTabFooter();

  const activeSession = state.terminals.get(group.activeTerminalId);
  if (activeSession) {
    setTerminalHeaderTitle(activeSession.server?.name || 'Terminal');
    setTerminalStatus(activeSession.status || 'connected');
    updateTerminalLocationHeader(activeSession);
  }

  requestAnimationFrame(() => {
    scheduleActiveTerminalGroupFit();
    focusTerminal(activeSession);
  });

  appendActivityFeedEvent(
    `${duplicate ? 'Duplicated' : 'Reopened'} terminal tab: ${getTerminalGroupDisplayTitle(group)}.`,
    'action',
    { dedupeMs: 900 }
  );
  showToast(`${duplicate ? 'Duplicated' : 'Reopened'} ${getTerminalGroupDisplayTitle(group)}.`, 3500, 'success');
  return group;
}

async function duplicateTerminalGroup(groupId = state.activeTerminalGroupId) {
  const group = getTerminalGroup(groupId);
  const snapshot = captureTerminalGroupSnapshot(group);

  if (!snapshot) {
    showToast('This tab cannot be duplicated because its connection/profile is no longer saved.', 5500, 'warning');
    return null;
  }

  return restoreTerminalGroupSnapshot(snapshot, { duplicate: true });
}

async function reopenLastClosedTerminalTab() {
  const snapshot = state.closedTerminalTabs?.shift();

  if (!snapshot) {
    showToast('No recently closed terminal tab.', 3200, 'info');
    return null;
  }

  const restored = await restoreTerminalGroupSnapshot(snapshot);

  if (!restored) {
    state.closedTerminalTabs.unshift(snapshot);
  }

  return restored;
}


let activeWorkspaceTabStatePersistTimer = null;
let activeWorkspaceTabStatePersistInFlight = false;
let activeWorkspaceTabStatePersistQueued = false;

function queueActiveWorkspaceTabStatePersist() {
  // Pinned tabs have their own safe restart snapshot and must persist even when
  // the user is not working inside a saved Workspace.
  queuePinnedTerminalTabsPersist();

  const workspaceId = String(state.activeWorkspaceId || '');

  if (!workspaceId || state.workspaceRestoreInFlight || !getWorkspaceById(workspaceId)) {
    return;
  }

  activeWorkspaceTabStatePersistQueued = true;

  if (activeWorkspaceTabStatePersistTimer) {
    clearTimeout(activeWorkspaceTabStatePersistTimer);
  }

  activeWorkspaceTabStatePersistTimer = setTimeout(() => {
    activeWorkspaceTabStatePersistTimer = null;
    persistActiveWorkspaceTabState().catch((error) => {
      appendActivityFeedEvent(
        `Active workspace tab state could not be saved: ${error.message}`,
        'warning',
        { dedupeMs: 1600 }
      );
    });
  }, 250);
}

async function persistActiveWorkspaceTabState() {
  if (activeWorkspaceTabStatePersistInFlight) {
    activeWorkspaceTabStatePersistQueued = true;
    return;
  }

  if (!activeWorkspaceTabStatePersistQueued || state.workspaceRestoreInFlight) {
    return;
  }

  const workspaceId = String(state.activeWorkspaceId || '');
  const workspace = getWorkspaceById(workspaceId);

  if (!workspace) {
    activeWorkspaceTabStatePersistQueued = false;
    return;
  }

  activeWorkspaceTabStatePersistQueued = false;
  activeWorkspaceTabStatePersistInFlight = true;

  try {
    const snapshot = await captureWorkspaceSnapshot({
      id: workspace.id,
      name: workspace.name,
      includeToolbar: workspace.includeToolbar !== false,
      restoreWindowState: workspace.restoreWindowState !== false,
      createdAt: workspace.createdAt || ''
    });

    if (String(state.activeWorkspaceId || '') !== workspace.id) {
      return;
    }

    const latestWorkspace = getWorkspaceById(workspace.id);

    if (!latestWorkspace) {
      return;
    }

    // sessions and splitGroups must be updated together because split descriptors
    // reference indexes in the captured sessions array. Toolbar/window preferences
    // remain exactly as the user saved them.
    const updated = {
      ...cloneWorkspaceData(latestWorkspace),
      sessions: snapshot.sessions,
      activeSessionIndex: snapshot.activeSessionIndex,
      splitGroups: snapshot.splitGroups,
      updatedAt: snapshot.updatedAt
    };

    await persistWorkspaceRecord(updated, {
      startup: state.settings?.startupWorkspaceId === workspace.id
    });
  } finally {
    activeWorkspaceTabStatePersistInFlight = false;

    if (activeWorkspaceTabStatePersistQueued) {
      queueActiveWorkspaceTabStatePersist();
    }
  }
}

function reorderPinnedTerminalGroups() {
  const entries = Array.from(state.terminalGroups.entries());
  const pinned = entries.filter(([, group]) => group?.pinned === true);
  const normal = entries.filter(([, group]) => group?.pinned !== true);
  state.terminalGroups = new Map([...pinned, ...normal]);
}

function setTerminalGroupPinned(groupId, pinned) {
  const group = getTerminalGroup(groupId);

  if (!group) {
    return false;
  }

  group.pinned = pinned === true;
  reorderPinnedTerminalGroups();
  renderTerminalTabs();
  updateCurrentTabFooter();
  queuePinnedTerminalTabsPersist({ immediate: true });
  queueActiveWorkspaceTabStatePersist();

  appendActivityFeedEvent(
    `${group.pinned ? 'Pinned' : 'Unpinned'} terminal tab: ${getTerminalGroupDisplayTitle(group)}.`,
    'action',
    { dedupeMs: 800 }
  );
  showToast(`${group.pinned ? 'Pinned' : 'Unpinned'} ${getTerminalGroupDisplayTitle(group)}.`, 3000, 'success');
  return true;
}

function setTerminalGroupColor(groupId, color) {
  const group = getTerminalGroup(groupId);

  if (!group) {
    return false;
  }

  group.color = normalizeTerminalTabColor(color);
  renderTerminalTabs();
  queueActiveWorkspaceTabStatePersist();
  return true;
}

function setTerminalGroupTitle(groupId, title) {
  const group = getTerminalGroup(groupId);

  if (!group) {
    return false;
  }

  group.title = normalizeTerminalTabTitle(title);
  renderTerminalTabs();
  updateCurrentTabFooter();
  queueActiveWorkspaceTabStatePersist();
  appendActivityFeedEvent(`Renamed terminal tab: ${getTerminalGroupDisplayTitle(group)}.`, 'action', { dedupeMs: 800 });
  return true;
}

function openTerminalTabRenameModal(groupId) {
  const group = getTerminalGroup(groupId);
  const modal = $('#terminal-tab-rename-modal');
  const input = $('#terminal-tab-rename-input');

  if (!group || !modal || !input) {
    return;
  }

  closeTerminalTabContextMenu();
  state.editingTerminalTabGroupId = group.id;
  input.value = normalizeTerminalTabTitle(group.title) || getTerminalGroupDisplayTitle(group);
  modal.classList.remove('hidden');
  input.focus();
  input.select();
}

function closeTerminalTabRenameModal(save = false) {
  const modal = $('#terminal-tab-rename-modal');
  const input = $('#terminal-tab-rename-input');
  const groupId = state.editingTerminalTabGroupId;

  if (save && groupId) {
    const nextTitle = normalizeTerminalTabTitle(input?.value || '');
    setTerminalGroupTitle(groupId, nextTitle);
  }

  state.editingTerminalTabGroupId = null;
  modal?.classList.add('hidden');

  const group = getTerminalGroup(groupId);
  const terminalId = group?.activeTerminalId || getFirstTerminalIdInGroup(group);
  if (terminalId) {
    requestAnimationFrame(() => focusTerminal(state.terminals.get(terminalId)));
  }
}

async function closeOtherTerminalGroups(groupId) {
  const keep = getTerminalGroup(groupId);
  if (!keep) return;

  const groups = Array.from(state.terminalGroups.values());
  let skippedPinned = 0;

  for (const group of groups) {
    if (group.id === keep.id) continue;
    if (group.pinned) {
      skippedPinned += 1;
      continue;
    }
    await closeTerminalGroup(group.id);
  }

  if (skippedPinned) {
    showToast(`${skippedPinned} pinned tab${skippedPinned === 1 ? ' was' : 's were'} kept open.`, 4000, 'info');
  }
}

async function closeTerminalGroupsToRight(groupId) {
  const groups = Array.from(state.terminalGroups.values());
  const index = groups.findIndex((group) => group.id === groupId);

  if (index < 0) return;

  let skippedPinned = 0;
  for (const group of groups.slice(index + 1)) {
    if (group.pinned) {
      skippedPinned += 1;
      continue;
    }
    await closeTerminalGroup(group.id);
  }

  if (skippedPinned) {
    showToast(`${skippedPinned} pinned tab${skippedPinned === 1 ? ' was' : 's were'} kept open.`, 4000, 'info');
  }
}

let terminalTabContextMenu = null;

function closeTerminalTabContextMenu() {
  if (terminalTabContextMenu) {
    terminalTabContextMenu.remove();
    terminalTabContextMenu = null;
  }
}

function terminalTabContextMenuButton(label, action, { disabled = false, danger = false } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `terminal-tab-context-item${danger ? ' danger' : ''}`;
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener('click', () => {
    closeTerminalTabContextMenu();
    Promise.resolve(action?.()).catch((error) => {
      showToast(`Tab action failed: ${error.message}`, 6000, 'error');
    });
  });
  return button;
}

function showTerminalTabContextMenu(group, clientX, clientY) {
  if (!group) {
    return;
  }

  closeTerminalTabContextMenu();
  closeTerminalTabPicker();
  closeTerminalSplitPicker();

  const menu = document.createElement('div');
  menu.className = 'terminal-tab-context-menu';
  menu.setAttribute('role', 'menu');

  const heading = document.createElement('div');
  heading.className = 'terminal-tab-context-heading';
  heading.textContent = getTerminalGroupDisplayTitle(group);

  const duplicateDisabled = !captureTerminalGroupSnapshot(group);
  const groups = Array.from(state.terminalGroups.values());
  const groupIndex = groups.findIndex((candidate) => candidate.id === group.id);
  const hasClosableOther = groups.some((candidate) => candidate.id !== group.id && !candidate.pinned);
  const hasClosableRight = groups.slice(groupIndex + 1).some((candidate) => !candidate.pinned);

  menu.append(
    heading,
    terminalTabContextMenuButton('Rename Tab', () => openTerminalTabRenameModal(group.id)),
    terminalTabContextMenuButton(group.pinned ? 'Unpin Tab' : 'Pin Tab', () => setTerminalGroupPinned(group.id, !group.pinned)),
    terminalTabContextMenuButton('Duplicate Tab', () => duplicateTerminalGroup(group.id), { disabled: duplicateDisabled })
  );

  const divider1 = document.createElement('div');
  divider1.className = 'terminal-tab-context-divider';
  menu.appendChild(divider1);

  const colorRow = document.createElement('div');
  colorRow.className = 'terminal-tab-context-color-row';

  const colorLabel = document.createElement('span');
  colorLabel.textContent = 'Tab Color';

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = normalizeTerminalTabColor(group.color) || '#4f8fd8';
  colorInput.title = 'Choose tab color';
  colorInput.setAttribute('aria-label', 'Choose tab color');
  colorInput.addEventListener('input', () => setTerminalGroupColor(group.id, colorInput.value));

  const clearColor = document.createElement('button');
  clearColor.type = 'button';
  clearColor.className = 'terminal-tab-context-clear-color';
  clearColor.textContent = 'Reset';
  clearColor.addEventListener('click', () => {
    setTerminalGroupColor(group.id, '');
    closeTerminalTabContextMenu();
  });

  colorRow.append(colorLabel, colorInput, clearColor);
  menu.appendChild(colorRow);

  const divider2 = document.createElement('div');
  divider2.className = 'terminal-tab-context-divider';
  menu.append(
    divider2,
    terminalTabContextMenuButton('Reopen Last Closed Tab', () => reopenLastClosedTerminalTab(), {
      disabled: !state.closedTerminalTabs?.length
    }),
    terminalTabContextMenuButton('Close Other Tabs', () => closeOtherTerminalGroups(group.id), {
      disabled: !hasClosableOther
    }),
    terminalTabContextMenuButton('Close Tabs to the Right', () => closeTerminalGroupsToRight(group.id), {
      disabled: !hasClosableRight
    }),
    terminalTabContextMenuButton(group.pinned ? 'Pinned Tab — Unpin to Close' : 'Close Tab', () => closeTerminalGroup(group.id), {
      disabled: group.pinned === true,
      danger: group.pinned !== true
    })
  );

  document.body.appendChild(menu);
  terminalTabContextMenu = menu;

  const rect = menu.getBoundingClientRect();
  const left = Math.max(8, Math.min(Number(clientX) || 8, window.innerWidth - rect.width - 8));
  const top = Math.max(8, Math.min(Number(clientY) || 8, window.innerHeight - rect.height - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  requestAnimationFrame(() => menu.querySelector('button:not(:disabled)')?.focus());
}

async function closeTerminalGroup(groupId, { force = false, remember = true } = {}) {
  const group = getTerminalGroup(groupId);

  if (!group) {
    return false;
  }

  if (group.pinned && !force) {
    showToast('This tab is pinned. Unpin it before closing.', 3800, 'info');
    return false;
  }

  if (remember) {
    rememberClosedTerminalGroup(group);
  }

  const terminalIds = splitGroupTerminalIds(group);

  for (const terminalId of terminalIds) {
    if (state.terminals.has(terminalId)) {
      await closeTerminalSession(terminalId);
    }
  }

  return true;
}

function serializeWorkspaceSplitNode(node, sessionIndexByTerminalId) {
  if (!node) {
    return null;
  }

  if (node.type === 'leaf') {
    const sessionIndex = sessionIndexByTerminalId.get(node.terminalId);
    return Number.isInteger(sessionIndex)
      ? { type: 'leaf', sessionIndex }
      : null;
  }

  const first = serializeWorkspaceSplitNode(node.first, sessionIndexByTerminalId);
  const second = serializeWorkspaceSplitNode(node.second, sessionIndexByTerminalId);

  if (!first) return second;
  if (!second) return first;

  return {
    type: 'split',
    direction: node.direction === 'column' ? 'column' : 'row',
    ratio: Math.round(Math.min(0.85, Math.max(0.15, Number(node.ratio) || 0.5)) * 1000) / 1000,
    first,
    second
  };
}

function deserializeWorkspaceSplitNode(node, terminalIdBySessionIndex) {
  if (!node) {
    return null;
  }

  if (node.type === 'leaf') {
    const terminalId = terminalIdBySessionIndex.get(Number(node.sessionIndex));
    return terminalId ? createSplitLeaf(terminalId) : null;
  }

  const first = deserializeWorkspaceSplitNode(node.first, terminalIdBySessionIndex);
  const second = deserializeWorkspaceSplitNode(node.second, terminalIdBySessionIndex);

  if (!first) return second;
  if (!second) return first;

  return createSplitNode(node.direction, first, second, node.ratio);
}

function restoreWorkspaceSplitLayout(workspace, terminalIdBySessionIndex) {
  const descriptors = Array.isArray(workspace?.splitGroups) ? workspace.splitGroups : [];

  if (!descriptors.length || !terminalIdBySessionIndex?.size) {
    return;
  }

  const existingGroups = Array.from(state.terminalGroups.values());
  existingGroups.forEach((group) => group.container?.remove());
  state.terminalGroups.clear();
  state.activeTerminalGroupId = null;

  const usedTerminalIds = new Set();

  descriptors.forEach((descriptor) => {
    const root = deserializeWorkspaceSplitNode(descriptor.root, terminalIdBySessionIndex);

    if (!root) {
      return;
    }

    const terminalIds = collectSplitTerminalIds(root, [])
      .filter((terminalId) => state.terminals.has(terminalId) && !usedTerminalIds.has(terminalId));

    if (!terminalIds.length) {
      return;
    }

    terminalIds.forEach((terminalId) => usedTerminalIds.add(terminalId));

    const activeTerminalId = terminalIdBySessionIndex.get(Number(descriptor.activeSessionIndex));
    const group = {
      id: randomId('tab'),
      root,
      activeTerminalId: terminalIds.includes(activeTerminalId) ? activeTerminalId : terminalIds[0],
      title: normalizeTerminalTabTitle(descriptor.title),
      color: normalizeTerminalTabColor(descriptor.color),
      pinned: descriptor.pinned === true,
      container: null
    };

    terminalIds.forEach((terminalId) => {
      const session = state.terminals.get(terminalId);
      if (session) session.groupId = group.id;
    });

    state.terminalGroups.set(group.id, group);
    renderTerminalGroupLayout(group);
  });

  terminalIdBySessionIndex.forEach((terminalId) => {
    if (usedTerminalIds.has(terminalId)) {
      return;
    }

    const session = state.terminals.get(terminalId);
    if (session) createStandaloneTerminalGroup(session);
  });
}

function getTerminalTabRects() {
  const rects = new Map();

  $$('.terminal-tab').forEach((tab) => {
    if (tab.dataset.groupId) {
      rects.set(tab.dataset.groupId, tab.getBoundingClientRect());
    }
  });

  return rects;
}

function animateTerminalTabLayout(previousRects) {
  if (!previousRects || !previousRects.size) {
    return;
  }

  requestAnimationFrame(() => {
    $$('.terminal-tab').forEach((tab) => {
      const previousRect = previousRects.get(tab.dataset.groupId);

      if (!previousRect) {
        return;
      }

      const currentRect = tab.getBoundingClientRect();
      const deltaX = previousRect.left - currentRect.left;

      if (Math.abs(deltaX) < 2) {
        return;
      }

      tab.classList.add('tab-moving');
      tab.style.transform = `translateX(${deltaX}px)`;

      requestAnimationFrame(() => {
        tab.style.transform = '';
      });

      const cleanup = () => {
        tab.classList.remove('tab-moving');
        tab.style.transform = '';
        tab.removeEventListener('transitionend', cleanup);
      };

      tab.addEventListener('transitionend', cleanup);
      setTimeout(cleanup, 240);
    });
  });
}

function clearTerminalTabDropMarkers() {
  $$('.terminal-tab.drop-before, .terminal-tab.drop-after').forEach((tab) => {
    tab.classList.remove('drop-before', 'drop-after');
  });
}

function getTerminalTabDropPlacement(tab, eventOrClientX) {
  const clientX = typeof eventOrClientX === 'number' ? eventOrClientX : eventOrClientX.clientX;
  const rect = tab.getBoundingClientRect();
  return clientX > rect.left + (rect.width / 2) ? 'after' : 'before';
}

function getTerminalTabSlideTarget(draggedGroupId, clientX) {
  const tabs = $$('.terminal-tab')
    .filter((tab) => tab.dataset.groupId && tab.dataset.groupId !== draggedGroupId);

  if (!tabs.length) {
    return null;
  }

  for (const tab of tabs) {
    const rect = tab.getBoundingClientRect();

    if (clientX < rect.left + (rect.width / 2)) {
      return {
        groupId: tab.dataset.groupId,
        placement: 'before',
        tab
      };
    }
  }

  const lastTab = tabs[tabs.length - 1];
  return {
    groupId: lastTab.dataset.groupId,
    placement: 'after',
    tab: lastTab
  };
}

function setTerminalTabSlideMarker(target) {
  clearTerminalTabDropMarkers();

  if (!target?.tab) {
    return;
  }

  target.tab.classList.add(target.placement === 'after' ? 'drop-after' : 'drop-before');
}

function clampTerminalTabSlide(deltaX, drag) {
  if (!drag?.rowRect || !drag?.startRect) {
    return deltaX;
  }

  const leftLimit = drag.rowRect.left - drag.startRect.left;
  const rightLimit = drag.rowRect.right - drag.startRect.right;

  return Math.max(leftLimit, Math.min(rightLimit, deltaX));
}

function setTerminalTabDragState(active) {
  $('#terminal-tabs')?.classList.toggle('dragging-horizontal', Boolean(active));
  document.body.classList.toggle('terminal-tab-drag-active', Boolean(active));
}

function beginTerminalTabSlideDrag(tab, group, event) {
  if (event.button !== 0 || event.target.closest('.terminal-tab-close, .terminal-tab-add-button, .terminal-tab-split-button')) {
    return;
  }

  const tabs = $('#terminal-tabs');
  const tabRect = tab.getBoundingClientRect();
  const rowRect = tabs?.getBoundingClientRect();

  state.draggingTerminalId = group.id;
  state.terminalTabDrag = {
    groupId: group.id,
    pointerId: event.pointerId,
    tab,
    startX: event.clientX,
    startY: event.clientY,
    startRect: tabRect,
    rowRect,
    moved: false,
    targetGroupId: null,
    placement: 'before'
  };

  tab.setPointerCapture?.(event.pointerId);
  tab.classList.add('drag-ready');
  event.preventDefault();
}

function updateTerminalTabSlideDrag(event) {
  const drag = state.terminalTabDrag;

  if (!drag || drag.pointerId !== event.pointerId || !drag.tab) {
    return;
  }

  const rawDeltaX = event.clientX - drag.startX;
  const rawDeltaY = event.clientY - drag.startY;

  if (!drag.moved && Math.abs(rawDeltaX) < 5 && Math.abs(rawDeltaY) < 5) {
    return;
  }

  drag.moved = true;
  const deltaX = clampTerminalTabSlide(rawDeltaX, drag);
  drag.tab.classList.add('dragging', 'sliding');
  drag.tab.style.transform = `translateX(${deltaX}px)`;

  const target = getTerminalTabSlideTarget(drag.groupId, event.clientX);
  drag.targetGroupId = target?.groupId || null;
  drag.placement = target?.placement || 'before';
  setTerminalTabSlideMarker(target);
  setTerminalTabDragState(true);
  event.preventDefault();
}

function finishTerminalTabSlideDrag(event, commit = true) {
  const drag = state.terminalTabDrag;

  if (!drag || (event && drag.pointerId !== event.pointerId)) {
    return;
  }

  const tab = drag.tab;
  const moved = Boolean(drag.moved);
  const targetGroupId = drag.targetGroupId;
  const placement = drag.placement;

  if (tab) {
    tab.releasePointerCapture?.(drag.pointerId);
    tab.classList.remove('drag-ready', 'dragging', 'sliding');
    tab.style.transform = '';
  }

  state.draggingTerminalId = null;
  state.terminalTabDrag = null;
  clearTerminalTabDropMarkers();
  setTerminalTabDragState(false);

  if (moved) {
    if (tab) {
      tab.dataset.suppressClick = '1';
      setTimeout(() => {
        if (tab.dataset.suppressClick === '1') {
          delete tab.dataset.suppressClick;
        }
      }, 0);
    }

    if (commit && targetGroupId) {
      reorderTerminalTab(drag.groupId, targetGroupId, placement);
    }

    event?.preventDefault();
    return;
  }

  if (commit) {
    const group = getTerminalGroup(drag.groupId);
    const terminalId = group?.activeTerminalId || getFirstTerminalIdInGroup(group);
    if (terminalId) activateTerminalAndFocus(terminalId);
  }
}

function reorderTerminalTab(draggedGroupId, targetGroupId, placement = 'before') {
  if (!draggedGroupId || !targetGroupId || draggedGroupId === targetGroupId) {
    return false;
  }

  if (!state.terminalGroups.has(draggedGroupId) || !state.terminalGroups.has(targetGroupId)) {
    return false;
  }

  const draggedGroup = getTerminalGroup(draggedGroupId);
  const targetGroup = getTerminalGroup(targetGroupId);

  if (Boolean(draggedGroup?.pinned) !== Boolean(targetGroup?.pinned)) {
    showToast('Pinned tabs stay together. Unpin the tab before moving it across normal tabs.', 4200, 'info');
    renderTerminalTabs();
    return false;
  }

  const previousRects = getTerminalTabRects();
  const entries = Array.from(state.terminalGroups.entries());
  const draggedEntry = entries.find(([groupId]) => groupId === draggedGroupId);

  if (!draggedEntry) {
    return false;
  }

  const orderedEntries = entries.filter(([groupId]) => groupId !== draggedGroupId);
  const targetIndex = orderedEntries.findIndex(([groupId]) => groupId === targetGroupId);

  if (targetIndex < 0) {
    return false;
  }

  const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
  orderedEntries.splice(insertIndex, 0, draggedEntry);
  state.terminalGroups = new Map(orderedEntries);

  const movedGroup = draggedEntry[1];
  const activeSession = state.terminals.get(movedGroup.activeTerminalId)
    || state.terminals.get(getFirstTerminalIdInGroup(draggedGroup));
  appendActivityFeedEvent(`Moved terminal tab: ${activeSession?.server?.name || 'Split tab'}.`, 'action', { dedupeMs: 800 });
  renderTerminalTabs();
  animateTerminalTabLayout(previousRects);
  updateCurrentTabFooter();
  fitActiveTerminal();
  queueActiveWorkspaceTabStatePersist();

  return true;
}

function terminalTabIconSvg(serverType) {
  if (serverType === 'local') {
    return '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="2" y="2.5" width="12" height="8.5" rx="1.4"></rect><path d="M5.5 13.5h5M8 11v2.5"></path></svg>';
  }

  return '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="2" y="2" width="12" height="5" rx="1.2"></rect><rect x="2" y="9" width="12" height="5" rx="1.2"></rect><path d="M4.5 4.5h.01M4.5 11.5h.01M7 4.5h4.5M7 11.5h4.5"></path></svg>';
}


let terminalSearchRefreshTimer = null;

function isTerminalSearchOpen() {
  return Boolean($('#terminal-search-bar') && !$('#terminal-search-bar').classList.contains('hidden'));
}

function clearTerminalSearchRefreshTimer() {
  if (terminalSearchRefreshTimer) {
    clearTimeout(terminalSearchRefreshTimer);
    terminalSearchRefreshTimer = null;
  }
}

function collectTerminalSearchMatches(session, query) {
  const matches = [];
  const buffer = session?.term?.buffer?.active;
  const needle = String(query || '').toLocaleLowerCase();

  if (!buffer || !needle) {
    return matches;
  }

  for (let row = 0; row < buffer.length; row += 1) {
    const line = buffer.getLine(row);

    if (!line) {
      continue;
    }

    const text = line.translateToString(true);
    const searchable = text.toLocaleLowerCase();
    let startAt = 0;

    while (startAt <= searchable.length) {
      const column = searchable.indexOf(needle, startAt);

      if (column < 0) {
        break;
      }

      matches.push({
        row,
        column,
        length: Math.max(1, String(query).length)
      });

      startAt = column + Math.max(1, needle.length);
    }
  }

  return matches;
}

function updateTerminalSearchCount(total, activeIndex) {
  const count = $('#terminal-search-count');
  const bar = $('#terminal-search-bar');

  if (!count || !bar) {
    return;
  }

  const hasResults = total > 0;
  count.textContent = hasResults ? `${activeIndex + 1} / ${total}` : 'No results';
  bar.classList.toggle('no-results', !hasResults);
}

function clearTerminalSearchSelection(session) {
  try {
    session?.term?.clearSelection?.();
  } catch (_) {
    // Ignore selection cleanup failure.
  }
}

function selectTerminalSearchMatch(session, match) {
  if (!session?.term || !match) {
    return;
  }

  try {
    session.term.select(match.column, match.row, match.length);
    session.term.scrollToLine(match.row);
  } catch (_) {
    // Ignore selection failure if the buffer changed during a search.
  }
}

function runTerminalSearch(direction = 0, { reset = false } = {}) {
  const session = state.terminals.get(state.activeTerminalId);
  const input = $('#terminal-search-input');

  if (!session?.term || !input) {
    updateTerminalSearchCount(0, -1);
    return false;
  }

  const query = input.value;
  const previousSearch = session.terminalSearch || {
    query: '',
    matches: [],
    activeIndex: -1
  };

  if (!query) {
    session.terminalSearch = {
      query: '',
      matches: [],
      activeIndex: -1
    };
    clearTerminalSearchSelection(session);
    const count = $('#terminal-search-count');
    const bar = $('#terminal-search-bar');

    if (count) {
      count.textContent = '0 / 0';
    }

    bar?.classList.remove('no-results');
    return false;
  }

  const matches = collectTerminalSearchMatches(session, query);
  const queryChanged = previousSearch.query !== query;
  let activeIndex = previousSearch.activeIndex;

  if (!matches.length) {
    session.terminalSearch = {
      query,
      matches,
      activeIndex: -1
    };
    clearTerminalSearchSelection(session);
    updateTerminalSearchCount(0, -1);
    return false;
  }

  if (reset || queryChanged || !Number.isInteger(activeIndex) || activeIndex < 0) {
    activeIndex = direction < 0 ? matches.length - 1 : 0;
  } else if (direction !== 0) {
    activeIndex = (activeIndex + direction + matches.length) % matches.length;
  } else {
    activeIndex = Math.min(activeIndex, matches.length - 1);
  }

  session.terminalSearch = {
    query,
    matches,
    activeIndex
  };

  updateTerminalSearchCount(matches.length, activeIndex);
  selectTerminalSearchMatch(session, matches[activeIndex]);
  return true;
}

function openTerminalSearch() {
  const session = state.terminals.get(state.activeTerminalId);

  if (!session?.term) {
    showToast('Open or connect a terminal before searching.', 4500, 'warning');
    return;
  }

  setActiveView('terminal', 'terminal');

  const bar = $('#terminal-search-bar');
  const input = $('#terminal-search-input');

  if (!bar || !input) {
    return;
  }

  bar.classList.remove('hidden');
  bar.setAttribute('aria-hidden', 'false');

  if (!input.value && session.terminalSearch?.query) {
    input.value = session.terminalSearch.query;
  }

  if (input.value) {
    runTerminalSearch(0, { reset: false });
  } else {
    const count = $('#terminal-search-count');

    if (count) {
      count.textContent = '0 / 0';
    }

    bar.classList.remove('no-results');
  }

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function closeTerminalSearch({ focusActiveTerminal = true } = {}) {
  clearTerminalSearchRefreshTimer();

  const bar = $('#terminal-search-bar');
  const session = state.terminals.get(state.activeTerminalId);

  if (bar) {
    bar.classList.add('hidden');
    bar.setAttribute('aria-hidden', 'true');
    bar.classList.remove('no-results');
  }

  clearTerminalSearchSelection(session);

  if (focusActiveTerminal && session && !session.closed) {
    requestAnimationFrame(() => focusTerminal(session));
  }
}

function syncTerminalSearchToActiveSession() {
  if (!isTerminalSearchOpen()) {
    return;
  }

  const session = state.terminals.get(state.activeTerminalId);

  if (!session?.term) {
    closeTerminalSearch({ focusActiveTerminal: false });
    return;
  }

  runTerminalSearch(0, { reset: true });
}

function scheduleTerminalSearchRefresh(terminalId) {
  if (!isTerminalSearchOpen() || terminalId !== state.activeTerminalId) {
    return;
  }

  clearTerminalSearchRefreshTimer();
  terminalSearchRefreshTimer = setTimeout(() => {
    terminalSearchRefreshTimer = null;

    if (terminalId === state.activeTerminalId && isTerminalSearchOpen()) {
      runTerminalSearch(0, { reset: false });
    }
  }, 140);
}

function handleTerminalSearchShortcut(event) {
  const isFindShortcut = (event.ctrlKey || event.metaKey)
    && !event.altKey
    && String(event.key || '').toLocaleLowerCase() === 'f';

  if (!isFindShortcut || state.activeView !== 'terminal') {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  openTerminalSearch();
}



let terminalTabPickerMenu = null;
let terminalTabPickerButton = null;

function getOpenTerminalSessionForServer(serverId) {
  if (!serverId) {
    return null;
  }

  return Array.from(state.terminals.values()).find((session) => (
    !session?.closed && session.server?.id === serverId
  )) || null;
}

function closeTerminalTabPicker({ restoreFocus = false } = {}) {
  const menu = terminalTabPickerMenu;
  const button = terminalTabPickerButton;

  terminalTabPickerMenu = null;
  terminalTabPickerButton = null;

  if (menu) {
    menu.remove();
  }

  if (button) {
    button.setAttribute('aria-expanded', 'false');

    if (restoreFocus && button.isConnected) {
      button.focus();
    }
  }
}

function positionTerminalTabPicker(button, menu) {
  if (!button?.isConnected || !menu?.isConnected) {
    return;
  }

  const buttonRect = button.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const viewportPadding = 8;
  const gap = 6;
  const maxLeft = Math.max(viewportPadding, window.innerWidth - menuRect.width - viewportPadding);
  const left = Math.max(viewportPadding, Math.min(buttonRect.left, maxLeft));
  let top = buttonRect.bottom + gap;

  if (top + menuRect.height > window.innerHeight - viewportPadding) {
    top = Math.max(viewportPadding, buttonRect.top - menuRect.height - gap);
  }

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

async function openTerminalFromTabPicker(server) {
  if (!server?.id) {
    return;
  }

  const openSession = getOpenTerminalSessionForServer(server.id);
  closeTerminalTabPicker();
  setActiveView('terminal', 'terminal');

  if (openSession) {
    activateTerminalAndFocus(openSession.terminalId);
    showToast(`${server.name || 'Terminal'} is already open.`, 2600, 'info');
    return;
  }

  selectServer(server.id);
  await connectSelectedServer();
}

function createTerminalTabPickerItem(server) {
  const openSession = getOpenTerminalSessionForServer(server.id);
  const terminalType = server.type === 'local' ? 'local' : 'ssh';
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'terminal-tab-picker-item';
  item.setAttribute('role', 'menuitem');
  item.dataset.serverId = server.id;
  item.dataset.searchText = [
    server.name || '',
    serverSubtitle(server) || '',
    server.type === 'local' ? 'local terminal' : 'ssh connection',
    server.group || ''
  ].join(' ').toLocaleLowerCase();

  const icon = document.createElement('span');
  icon.className = `terminal-tab-picker-icon terminal-tab-icon-${terminalType}`;
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = terminalTabIconSvg(terminalType);

  const copy = document.createElement('span');
  copy.className = 'terminal-tab-picker-copy';

  const name = document.createElement('strong');
  name.className = 'terminal-tab-picker-name';
  name.textContent = server.name || (terminalType === 'local' ? 'Local terminal' : 'SSH connection');

  const subtitle = document.createElement('small');
  subtitle.className = 'terminal-tab-picker-subtitle';
  subtitle.textContent = serverSubtitle(server);
  subtitle.title = subtitle.textContent;

  const action = document.createElement('span');
  action.className = `terminal-tab-picker-action ${openSession ? 'is-open' : ''}`;
  action.textContent = openSession
    ? (openSession.status === 'connecting' ? 'Connecting' : 'Open')
    : (terminalType === 'local' ? 'Launch' : 'Connect');

  copy.appendChild(name);
  copy.appendChild(subtitle);
  item.appendChild(icon);
  item.appendChild(copy);
  item.appendChild(action);

  item.addEventListener('click', () => {
    openTerminalFromTabPicker(server).catch((error) => {
      showToast(`Could not open ${server.name || 'terminal'}: ${error.message}`, 7000, 'error');
    });
  });

  return item;
}

function showTerminalTabPicker(button) {
  closeTerminalTabPicker();

  const menu = document.createElement('div');
  menu.id = 'terminal-tab-picker-menu';
  menu.className = 'terminal-tab-picker-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Open saved terminal');

  const searchWrap = document.createElement('div');
  searchWrap.className = 'terminal-tab-picker-search';

  const searchIcon = document.createElement('span');
  searchIcon.className = 'terminal-tab-picker-search-icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  searchIcon.textContent = '⌕';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'terminal-tab-picker-search-input';
  searchInput.placeholder = 'Search terminals...';
  searchInput.setAttribute('aria-label', 'Search saved terminals');
  searchInput.autocomplete = 'off';
  searchInput.spellcheck = false;

  searchWrap.append(searchIcon, searchInput);
  menu.appendChild(searchWrap);

  const servers = sortConnectionsForDisplay([...(state.settings?.servers || [])]);
  const groups = [
    {
      label: 'Local terminals',
      servers: servers.filter((server) => server.type === 'local')
    },
    {
      label: 'SSH connections',
      servers: servers.filter((server) => server.type !== 'local')
    }
  ].filter((group) => group.servers.length > 0);

  const noMatches = document.createElement('div');
  noMatches.className = 'terminal-tab-picker-empty terminal-tab-picker-no-matches hidden';
  noMatches.textContent = 'No matching terminals.';

  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'terminal-tab-picker-empty';
    empty.textContent = 'No saved terminals are available.';
    menu.appendChild(empty);
  } else {
    groups.forEach((group) => {
      const section = document.createElement('section');
      section.className = 'terminal-tab-picker-section';
      section.dataset.searchGroup = group.label.toLocaleLowerCase();

      const heading = document.createElement('div');
      heading.className = 'terminal-tab-picker-heading';
      heading.textContent = group.label;
      section.appendChild(heading);

      group.servers.forEach((server) => {
        section.appendChild(createTerminalTabPickerItem(server));
      });

      menu.appendChild(section);
    });

    menu.appendChild(noMatches);
  }

  const visibleItems = () => Array.from(
    menu.querySelectorAll('.terminal-tab-picker-item:not(.hidden)')
  );

  const applySearch = () => {
    const query = String(searchInput.value || '').trim().toLocaleLowerCase();
    let totalVisible = 0;

    menu.querySelectorAll('.terminal-tab-picker-section').forEach((section) => {
      let sectionVisible = 0;
      const groupText = String(section.dataset.searchGroup || '');

      section.querySelectorAll('.terminal-tab-picker-item').forEach((item) => {
        const haystack = `${item.dataset.searchText || ''} ${groupText}`;
        const matches = !query || haystack.includes(query);
        item.classList.toggle('hidden', !matches);

        if (matches) {
          sectionVisible += 1;
          totalVisible += 1;
        }
      });

      section.classList.toggle('hidden', sectionVisible === 0);
    });

    noMatches.classList.toggle('hidden', totalVisible > 0 || !groups.length);
  };

  searchInput.addEventListener('input', applySearch);

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeTerminalTabPicker({ restoreFocus: true });
      closeTerminalSplitPicker({ restoreFocus: true });
      return;
    }

    const items = visibleItems();

    if (document.activeElement === searchInput) {
      if (event.key === 'Enter' && items.length) {
        event.preventDefault();
        items[0].click();
        return;
      }

      if (event.key === 'ArrowDown' && items.length) {
        event.preventDefault();
        items[0].focus();
        return;
      }

      if (event.key === 'ArrowUp' && items.length) {
        event.preventDefault();
        items[items.length - 1].focus();
        return;
      }
    }

    if (!items.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement);
    let nextIndex = 0;

    if (event.key === 'End') {
      nextIndex = items.length - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    } else {
      nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    }

    items[nextIndex]?.focus();
  });

  terminalTabPickerMenu = menu;
  terminalTabPickerButton = button;
  button.setAttribute('aria-expanded', 'true');
  document.body.appendChild(menu);
  positionTerminalTabPicker(button, menu);

  requestAnimationFrame(() => {
    searchInput.focus();
    searchInput.select();
  });
}


let terminalSplitPickerMenu = null;
let terminalSplitPickerButton = null;
let terminalSplitPickerDirection = 'row';

function closeTerminalSplitPicker({ restoreFocus = false } = {}) {
  const menu = terminalSplitPickerMenu;
  const button = terminalSplitPickerButton;

  terminalSplitPickerMenu = null;
  terminalSplitPickerButton = null;

  if (menu) {
    menu.remove();
  }

  if (button) {
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus && button.isConnected) button.focus();
  }
}

function activeSplitTargetDescriptor() {
  const session = state.terminals.get(state.activeTerminalId);

  if (!session) {
    return null;
  }

  const savedServer = state.settings?.servers?.find((server) => server.id === session.server?.id) || null;
  if (savedServer) {
    return {
      kind: 'connection',
      server: savedServer,
      label: savedServer.name || session.server?.name || 'Connection'
    };
  }

  const explicitProfileId = String(session.server?.profileId || '').trim();
  const parsedProfileId = String(session.server?.id || '').startsWith('terminal-profile:')
    ? String(session.server.id).slice('terminal-profile:'.length)
    : '';
  const profile = getTerminalProfileById(explicitProfileId || parsedProfileId);

  return profile
    ? { kind: 'profile', profile, label: profile.name || session.server?.name || 'Terminal Profile' }
    : null;
}

async function openSplitTarget(target, direction = terminalSplitPickerDirection) {
  const baseTerminalId = state.activeTerminalId;
  const baseSession = state.terminals.get(baseTerminalId);
  const baseGroup = getTerminalGroupForSession(baseSession);

  if (!baseSession || !baseGroup) {
    showToast('Open a terminal first before creating a split.', 4000, 'warning');
    return null;
  }

  if (splitGroupTerminalIds(baseGroup).length >= 4) {
    showToast('A split tab can contain up to 4 terminal panes.', 4500, 'warning');
    return null;
  }

  closeTerminalSplitPicker();
  let session = null;

  try {
    if (target?.kind === 'profile' && target.profile?.id) {
      session = await launchTerminalProfile(target.profile.id, {
        workingDirectory: target.workingDirectory || ''
      });
    } else if (target?.kind === 'connection' && target.server?.id) {
      selectServer(target.server.id);
      session = await connectSelectedServer({
        workingDirectory: target.workingDirectory || ''
      });
    } else {
      showToast('The selected split target is no longer available.', 4500, 'warning');
      return null;
    }
  } catch (error) {
    showToast(`Split terminal failed: ${error.message}`, 7000, 'error');
    return null;
  }

  if (!session) {
    activateTerminalAndFocus(baseTerminalId);
    return null;
  }

  if (!attachTerminalAsSplit(baseTerminalId, session.terminalId, direction)) {
    showToast('The new terminal opened, but it could not be attached as a split pane.', 6000, 'warning');
    return session;
  }

  return session;
}

function splitPickerTargetItem(target, subtitle = '') {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'terminal-tab-picker-item terminal-split-picker-item';

  const icon = document.createElement('span');
  icon.className = 'terminal-tab-picker-icon';
  icon.textContent = target.kind === 'profile'
    ? commandPaletteText(target.profile?.icon || '>_', 3)
    : (target.server?.type === 'remote' ? 'SSH' : 'LOC');

  const copy = document.createElement('span');
  copy.className = 'terminal-tab-picker-copy';

  const name = document.createElement('strong');
  name.className = 'terminal-tab-picker-name';
  name.textContent = target.label || target.profile?.name || target.server?.name || 'Terminal';

  const detail = document.createElement('small');
  detail.className = 'terminal-tab-picker-subtitle';
  detail.textContent = subtitle;
  detail.title = subtitle;

  copy.append(name, detail);
  item.append(icon, copy);

  item.addEventListener('click', () => {
    openSplitTarget(target).catch((error) => {
      showToast(`Split terminal failed: ${error.message}`, 7000, 'error');
    });
  });

  return item;
}

function addSplitPickerSection(menu, label, targets, subtitleBuilder) {
  if (!targets.length) {
    return;
  }

  const section = document.createElement('section');
  section.className = 'terminal-tab-picker-section';

  const heading = document.createElement('div');
  heading.className = 'terminal-tab-picker-heading';
  heading.textContent = label;
  section.appendChild(heading);

  targets.forEach((target) => {
    section.appendChild(splitPickerTargetItem(target, subtitleBuilder(target)));
  });

  menu.appendChild(section);
}

function showTerminalSplitPicker(button, preferredDirection = 'row') {
  const activeSession = state.terminals.get(state.activeTerminalId);
  const activeGroup = getTerminalGroupForSession(activeSession);

  if (!button || !activeSession || !activeGroup) {
    showToast('Open a terminal first before creating a split.', 3500, 'warning');
    return;
  }

  if (splitGroupTerminalIds(activeGroup).length >= 4) {
    showToast('This tab already has the maximum of 4 terminal panes.', 4500, 'warning');
    return;
  }

  closeTerminalSplitPicker();
  closeTerminalTabPicker();
  terminalSplitPickerDirection = preferredDirection === 'column' ? 'column' : 'row';

  const menu = document.createElement('div');
  menu.id = 'terminal-split-picker-menu';
  menu.className = 'terminal-tab-picker-menu terminal-split-picker-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Split terminal');

  const heading = document.createElement('div');
  heading.className = 'terminal-tab-picker-heading terminal-split-picker-title';
  heading.textContent = `Split "${activeSession.server?.name || 'Terminal'}"`;

  const directionRow = document.createElement('div');
  directionRow.className = 'terminal-split-direction-row';

  const right = document.createElement('button');
  right.type = 'button';
  right.className = 'terminal-split-direction-button';
  right.textContent = 'Split Right';
  right.title = 'Place the new terminal to the right';

  const down = document.createElement('button');
  down.type = 'button';
  down.className = 'terminal-split-direction-button';
  down.textContent = 'Split Down';
  down.title = 'Place the new terminal below';

  const syncDirectionButtons = () => {
    right.classList.toggle('active', terminalSplitPickerDirection === 'row');
    down.classList.toggle('active', terminalSplitPickerDirection === 'column');
    right.setAttribute('aria-pressed', terminalSplitPickerDirection === 'row' ? 'true' : 'false');
    down.setAttribute('aria-pressed', terminalSplitPickerDirection === 'column' ? 'true' : 'false');
  };

  right.addEventListener('click', () => {
    terminalSplitPickerDirection = 'row';
    syncDirectionButtons();
  });
  down.addEventListener('click', () => {
    terminalSplitPickerDirection = 'column';
    syncDirectionButtons();
  });
  syncDirectionButtons();
  directionRow.append(right, down);
  menu.append(heading, directionRow);

  const activeTarget = activeSplitTargetDescriptor();
  if (activeTarget) {
    const duplicateSection = document.createElement('section');
    duplicateSection.className = 'terminal-tab-picker-section';

    const duplicateHeading = document.createElement('div');
    duplicateHeading.className = 'terminal-tab-picker-heading';
    duplicateHeading.textContent = 'Active terminal';

    const duplicateTarget = {
      ...activeTarget,
      label: `Duplicate ${activeTarget.label || 'Active Terminal'}`,
      workingDirectory: normalizeTerminalLocation(activeSession.currentLocation || '')
    };

    duplicateSection.append(
      duplicateHeading,
      splitPickerTargetItem(duplicateTarget, 'Open an independent session using the active terminal configuration.')
    );
    menu.appendChild(duplicateSection);
  }

  const profiles = getTerminalProfiles().map((profile) => ({
    kind: 'profile',
    profile,
    label: profile.name || 'Terminal Profile'
  }));
  addSplitPickerSection(
    menu,
    'Terminal Profiles',
    profiles,
    (target) => commandPaletteText([
      terminalProfileKindLabel(target.profile.kind),
      target.profile.workingDirectory || ''
    ].filter(Boolean).join(' · '))
  );

  const servers = sortConnectionsForDisplay([...(state.settings?.servers || [])]);
  const localTargets = servers
    .filter((server) => server.type === 'local')
    .map((server) => ({ kind: 'connection', server, label: server.name || 'Local Terminal' }));
  const sshTargets = servers
    .filter((server) => server.type !== 'local')
    .map((server) => ({ kind: 'connection', server, label: server.name || 'SSH Connection' }));

  addSplitPickerSection(menu, 'Local Connections', localTargets, (target) => commandPaletteText(serverSubtitle(target.server)));
  addSplitPickerSection(menu, 'SSH Connections', sshTargets, (target) => commandPaletteText(serverSubtitle(target.server)));

  if (splitGroupTerminalIds(activeGroup).length > 1) {
    const divider = document.createElement('div');
    divider.className = 'terminal-profile-quick-divider';

    const paneActions = document.createElement('section');
    paneActions.className = 'terminal-tab-picker-section terminal-split-pane-actions';

    const focusNext = document.createElement('button');
    focusNext.type = 'button';
    focusNext.className = 'terminal-split-pane-action';
    focusNext.textContent = 'Focus Next Pane';
    focusNext.addEventListener('click', () => {
      closeTerminalSplitPicker();
      focusNextSplitPane();
    });

    const swap = document.createElement('button');
    swap.type = 'button';
    swap.className = 'terminal-split-pane-action';
    swap.textContent = 'Swap With Next Pane';
    swap.addEventListener('click', () => {
      closeTerminalSplitPicker();
      swapActiveSplitPaneWithNext();
    });

    const closePane = document.createElement('button');
    closePane.type = 'button';
    closePane.className = 'terminal-split-pane-action terminal-split-pane-action-danger';
    closePane.textContent = 'Close Active Pane';
    closePane.addEventListener('click', () => {
      const terminalId = state.activeTerminalId;
      closeTerminalSplitPicker();
      if (terminalId) closeTerminalSession(terminalId);
    });

    paneActions.append(focusNext, swap, closePane);
    menu.append(divider, paneActions);
  }

  terminalSplitPickerMenu = menu;
  terminalSplitPickerButton = button;
  button.setAttribute('aria-expanded', 'true');
  document.body.appendChild(menu);

  const rect = button.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuRect.width - 8));
  let top = rect.bottom + 6;

  if (top + menuRect.height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menuRect.height - 6);
  }

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
  menu.querySelector('button')?.focus();
}

function appendTerminalTabActions(tabs) {
  const actions = document.createElement('div');
  actions.className = 'terminal-tab-actions';

  const separator = document.createElement('span');
  separator.className = 'terminal-tab-end-separator';
  separator.setAttribute('aria-hidden', 'true');
  separator.textContent = '|';

  const addButton = document.createElement('button');
  addButton.id = 'terminal-tab-add-button';
  addButton.className = 'terminal-tab-add-button';
  addButton.type = 'button';
  addButton.title = 'Open a saved terminal';
  addButton.setAttribute('aria-label', 'Open a saved terminal');
  addButton.setAttribute('aria-haspopup', 'menu');
  addButton.setAttribute('aria-expanded', 'false');
  addButton.textContent = '+';

  addButton.addEventListener('click', (event) => {
    event.stopPropagation();
    closeTerminalSplitPicker();

    if (terminalTabPickerMenu) {
      closeTerminalTabPicker({ restoreFocus: true });
      return;
    }

    showTerminalTabPicker(addButton);
  });

  const splitButton = document.createElement('button');
  splitButton.id = 'terminal-tab-split-button';
  splitButton.className = 'terminal-tab-split-button';
  splitButton.type = 'button';
  splitButton.title = 'Split the active terminal pane';
  splitButton.setAttribute('aria-label', 'Split the active terminal pane');
  splitButton.setAttribute('aria-haspopup', 'menu');
  splitButton.setAttribute('aria-expanded', 'false');
  splitButton.textContent = '▦';

  const activeGroup = getTerminalGroup(state.activeTerminalGroupId);
  const paneCount = splitGroupTerminalIds(activeGroup).length;
  splitButton.disabled = !state.activeTerminalId || paneCount >= 4;

  if (paneCount >= 4) {
    splitButton.title = 'Maximum 4 terminal panes in a split tab';
  }

  splitButton.addEventListener('click', (event) => {
    event.stopPropagation();
    closeTerminalTabPicker();

    if (terminalSplitPickerMenu) {
      closeTerminalSplitPicker({ restoreFocus: true });
      return;
    }

    showTerminalSplitPicker(splitButton, 'row');
  });

  actions.append(separator, addButton, splitButton);
  tabs.appendChild(actions);
}

function renderTerminalTabs() {
  closeTerminalTabPicker();
  closeTerminalSplitPicker();

  const tabs = $('#terminal-tabs');
  if (!tabs) {
    return;
  }

  tabs.innerHTML = '';

  const groups = Array.from(state.terminalGroups.values())
    .filter((group) => splitGroupTerminalIds(group).some((terminalId) => state.terminals.has(terminalId)));
  tabs.classList.toggle('has-tabs', groups.length > 0);

  groups.forEach((group) => {
    const terminalIds = splitGroupTerminalIds(group).filter((terminalId) => state.terminals.has(terminalId));
    const preferredTerminalId = group.activeTerminalId && terminalIds.includes(group.activeTerminalId)
      ? group.activeTerminalId
      : terminalIds[0];
    const session = state.terminals.get(preferredTerminalId);

    if (!session) {
      return;
    }

    group.activeTerminalId = preferredTerminalId;
    const isActive = group.id === state.activeTerminalGroupId;
    const tab = document.createElement('div');
    tab.className = `terminal-tab ${isActive ? 'active' : ''}`;
    tab.dataset.groupId = group.id;
    tab.dataset.terminalId = preferredTerminalId;
    tab.draggable = false;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('tabindex', '0');
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.classList.toggle('pinned', group.pinned === true);

    const customColor = normalizeTerminalTabColor(group.color);
    if (customColor) {
      tab.classList.add('has-custom-color');
      tab.style.setProperty('--terminal-tab-custom-color', customColor);
    }

    const paneCount = terminalIds.length;
    const terminalTypes = terminalIds
      .map((terminalId) => state.terminals.get(terminalId)?.server?.type)
      .filter(Boolean);
    const terminalType = terminalTypes.every((type) => type === 'local') ? 'local' : 'ssh';
    const paneLabel = paneCount > 1 ? ` · ${paneCount} panes` : '';
    const displayTitle = getTerminalGroupDisplayTitle(group);
    const pinLabel = group.pinned ? ' · Pinned' : '';
    tab.title = `${session.server?.type === 'local' ? 'Local terminal' : 'SSH'}: ${displayTitle}${paneLabel}${pinLabel} - drag left or right to reorder · right-click for tab actions`;

    const inner = document.createElement('div');
    inner.className = 'terminal-tab-inner';

    const icon = document.createElement('span');
    icon.className = `terminal-tab-icon terminal-tab-icon-${terminalType}`;
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = terminalTabIconSvg(terminalType);

    const title = document.createElement('span');
    title.className = 'terminal-tab-title';
    title.textContent = displayTitle;

    inner.append(icon, title);

    if (paneCount > 1) {
      const badge = document.createElement('span');
      badge.className = 'terminal-tab-pane-count';
      badge.textContent = String(paneCount);
      badge.title = `${paneCount} terminal panes`;
      inner.appendChild(badge);
    }

    if (group.pinned) {
      const pin = document.createElement('span');
      pin.className = 'terminal-tab-pin';
      pin.textContent = 'PIN';
      pin.title = 'Pinned tab';
      inner.appendChild(pin);
    }

    const closeButton = document.createElement('button');
    closeButton.className = 'terminal-tab-close';
    closeButton.type = 'button';
    closeButton.draggable = false;
    closeButton.setAttribute('aria-label', `Close ${displayTitle} tab`);
    closeButton.title = group.pinned
      ? 'Pinned tab — unpin it before closing'
      : (paneCount > 1 ? `Close tab and all ${paneCount} panes` : 'Close tab');
    closeButton.textContent = '×';
    closeButton.disabled = group.pinned === true;
    closeButton.classList.toggle('hidden', group.pinned === true);

    tab.addEventListener('click', (event) => {
      if (tab.dataset.suppressClick === '1') {
        event.preventDefault();
        delete tab.dataset.suppressClick;
        return;
      }

      const targetTerminalId = group.activeTerminalId || getFirstTerminalIdInGroup(group);
      if (targetTerminalId) activateTerminalAndFocus(targetTerminalId);
    });

    tab.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const targetTerminalId = group.activeTerminalId || getFirstTerminalIdInGroup(group);
        if (targetTerminalId) activateTerminalAndFocus(targetTerminalId);
      }
    });

    tab.addEventListener('dblclick', (event) => {
      if (event.button === 0 && !event.target.closest('.terminal-tab-close')) {
        event.preventDefault();
        openTerminalTabRenameModal(group.id);
      }
    });

    tab.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      activateTerminal(group.activeTerminalId || getFirstTerminalIdInGroup(group));
      showTerminalTabContextMenu(group, event.clientX, event.clientY);
    });

    tab.addEventListener('pointerdown', (event) => beginTerminalTabSlideDrag(tab, group, event));
    tab.addEventListener('pointermove', updateTerminalTabSlideDrag);
    tab.addEventListener('pointerup', (event) => finishTerminalTabSlideDrag(event, true));
    tab.addEventListener('pointercancel', (event) => finishTerminalTabSlideDrag(event, false));
    tab.addEventListener('lostpointercapture', (event) => finishTerminalTabSlideDrag(event, false));

    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeTerminalGroup(group.id);
    });

    closeButton.addEventListener('dragstart', (event) => {
      event.preventDefault();
    });

    inner.appendChild(closeButton);
    tab.appendChild(inner);
    tabs.appendChild(tab);
  });

  if (groups.length > 0) {
    appendTerminalTabActions(tabs);
  }
}


function activateTerminal(terminalId) {
  const previousTerminalId = state.activeTerminalId;
  const previousGroupId = state.activeTerminalGroupId;
  const session = state.terminals.get(terminalId);

  if (!session) {
    return;
  }

  if (previousTerminalId && previousTerminalId !== terminalId && isTerminalSearchOpen()) {
    clearTerminalSearchSelection(state.terminals.get(previousTerminalId));
  }

  let group = getTerminalGroupForSession(session);

  if (!group) {
    group = createStandaloneTerminalGroup(session);
  }

  state.activeTerminalId = terminalId;
  state.activeTerminalGroupId = group?.id || null;

  if (group) {
    group.activeTerminalId = terminalId;
  }

  syncTerminalGroupVisibility();

  setTerminalHeaderTitle(session.server?.name || 'Terminal');
  setTerminalStatus(session.status || (session.closed ? 'disconnected' : 'connected'));
  updateTerminalLocationHeader(session);

  if (previousTerminalId && previousTerminalId !== terminalId) {
    appendActivityFeedEvent(
      previousGroupId === state.activeTerminalGroupId
        ? `Active split pane switched to ${session.server?.name || terminalId}.`
        : `Active terminal tab switched to ${session.server?.name || terminalId}.`,
      'action',
      { dedupeMs: 800 }
    );
  }

  renderTerminalTabs();
  renderTerminalToolbarActions();
  updateCurrentTabFooter();
  fitActiveTerminal();

  requestAnimationFrame(syncTerminalSearchToActiveSession);
}

function createTerminalPane(terminalId, server) {
  $('#terminal-empty').classList.add('hidden');

  $$('.terminal-pane').forEach((existingPane) => {
    existingPane.classList.remove('active');
  });

  const pane = document.createElement('div');
  pane.className = 'terminal-pane active';
  pane.dataset.terminalId = terminalId;
  $('#terminal-host').appendChild(pane);

  const term = new Terminal(getTerminalOptions());

  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(pane);

  const connectOverlay = document.createElement('div');
  connectOverlay.className = 'terminal-connect-overlay hidden';
  connectOverlay.setAttribute('aria-hidden', 'true');
  connectOverlay.innerHTML = `
    <div class="terminal-connect-card">
      <span class="terminal-connect-spinner" aria-hidden="true"></span>
      <div>
        <strong>Connecting...</strong>
        <p>Opening SSH session securely</p>
      </div>
    </div>
  `;
  pane.appendChild(connectOverlay);

  try {
    fitAddon.fit();
  } catch (_) {
    // Ignore early fit failure while the pane is being mounted.
  }

  const session = createTerminalSessionState({
    terminalId,
    server,
    term,
    fitAddon,
    pane,
    startedAt: Date.now(),
    startedLabel: reportTimestamp()
  });

  session.connectOverlay = connectOverlay;
  installTerminalClipboardShortcuts(session);
  session.cleanSshStartupActive = server?.type === 'remote';
  session.cleanSshStartupStartedAt = session.cleanSshStartupActive ? Date.now() : null;
  session.cleanSshStartupBuffer = '';
  session.sshTypedCommandBuffer = '';

  setSessionCurrentLocation(session, getInitialTerminalLocation(server));

  const terminalFocusHandler = () => {
    activateTerminalAndFocus(terminalId);
  };

  session.terminalFocusHandler = terminalFocusHandler;
  pane.addEventListener('pointerdown', terminalFocusHandler);
  pane.addEventListener('focusin', terminalFocusHandler);

  const inputDisposable = term.onData((data) => {
    if (handleSshLockedInteractiveInput(session, data)) {
      return;
    }

    recordTerminalInput(session, data);
    window.advanceTerminal.writeTerminal({ terminalId, data });
  });

  session.disposables = [inputDisposable];

  const contextMenuHandler = async (event) => {
    event.preventDefault();

    if (session.closed) {
      showToast('This terminal session is closed.', 'warning');
      return;
    }

    activateTerminalAndFocus(terminalId);

    try {
      if (session.term?.getSelection?.()) {
        await writeTerminalSelectionToClipboard(session, {
          focus: false,
          toastMessage: 'Copied highlighted terminal text.'
        });
        return;
      }

      const text = await navigator.clipboard.readText();

      if (!text) {
        showToast('Clipboard is empty.', 'warning');
        focusTerminal(session);
        return;
      }

      await writeClipboardTextToTerminal(session, text, 'Right-click clipboard', {
        autoEnter: getPasteProtectionSettings().rightClickAutoEnter
      });
    } catch (error) {
      focusTerminal(session);
      showToast(`Right-click clipboard action failed: ${error.message}`, 5000, 'error');
    }
  };

  session.contextMenuHandler = contextMenuHandler;
  pane.addEventListener('contextmenu', contextMenuHandler);

  state.terminals.set(terminalId, session);
  createStandaloneTerminalGroup(session);
  recordSessionEvent(session, `Opened terminal tab: ${server.name || terminalId}`, 'system');
  activateTerminal(terminalId);

  return session;
}

function getTerminalSize(session) {
  const cols = Math.max(10, Math.min(500, Number(session?.term?.cols || 120)));
  const rows = Math.max(4, Math.min(200, Number(session?.term?.rows || 32)));

  return {
    cols: Number.isFinite(cols) ? Math.floor(cols) : 120,
    rows: Number.isFinite(rows) ? Math.floor(rows) : 32
  };
}

function syncTerminalBackendSize(session) {
  if (!session || session.closed) {
    return;
  }

  const size = getTerminalSize(session);
  window.advanceTerminal.resizeTerminal({
    terminalId: session.terminalId,
    cols: size.cols,
    rows: size.rows
  });
}

function fitTerminalSessionNow(session, options = {}) {
  const notifyBackend = options.notifyBackend !== false;

  if (!session || session.closed || !isTerminalSessionVisible(session)) {
    return;
  }

  try {
    session.fitAddon.fit();

    if (notifyBackend) {
      syncTerminalBackendSize(session);
    }
  } catch (_) {
    // Ignore fit failure while UI is hidden.
  }
}

function fitTerminalSession(session, options = {}) {
  const delays = options.delays || [0, 80, 240];

  delays.forEach((delay) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        fitTerminalSessionNow(session, options);
      });
    }, delay);
  });
}

function fitActiveTerminal() {
  const group = getTerminalGroup(state.activeTerminalGroupId);
  const terminalIds = splitGroupTerminalIds(group);

  if (!terminalIds.length && state.activeTerminalId) {
    fitTerminalSession(state.terminals.get(state.activeTerminalId));
    return;
  }

  terminalIds.forEach((terminalId) => {
    fitTerminalSession(state.terminals.get(terminalId));
  });
}

function scheduleActiveTerminalFit() {
  scheduleActiveTerminalGroupFit();
}

function setupTerminalResizeObserver() {
  const host = $('#terminal-host');

  if (!host || typeof ResizeObserver !== 'function' || state.terminalHostResizeObserver) {
    return;
  }

  state.terminalHostResizeObserver = new ResizeObserver(() => {
    scheduleActiveTerminalFit();
  });

  state.terminalHostResizeObserver.observe(host);
}

function openSecretModal(kind, server) {
  return new Promise((resolve) => {
    const modal = $('#secret-modal');
    const input = $('#secret-modal-input');
    const title = $('#secret-modal-title');
    const message = $('#secret-modal-message');
    const rememberRow = $('#secret-remember-row');
    const rememberInput = $('#secret-remember-password');
    const actionButton = $('#secret-modal-connect');

    state.pendingSecret = resolve;
    state.pendingSecretMeta = {
      mode: 'connect-secret',
      kind,
      serverId: server?.id || null
    };

    input.value = '';
    rememberInput.checked = false;
    rememberRow.classList.add('hidden');
    actionButton.textContent = 'Connect';

    if (kind === 'password') {
      title.textContent = `Password for ${server.name}`;
      message.textContent = 'Enter SSH password. It will be used for this connection only.';
      input.placeholder = 'SSH password';
    } else {
      title.textContent = `Key Passphrase for ${server.name}`;
      message.textContent = 'Enter private-key passphrase, or leave empty if the key has no passphrase.';
      input.placeholder = 'Private-key passphrase';
    }

    modal.classList.remove('hidden');
    input.focus();
  });
}

function openTerminalPasswordPrompt(payload) {
  return new Promise((resolve) => {
    const modal = $('#secret-modal');
    const input = $('#secret-modal-input');
    const title = $('#secret-modal-title');
    const message = $('#secret-modal-message');
    const rememberRow = $('#secret-remember-row');
    const rememberInput = $('#secret-remember-password');
    const actionButton = $('#secret-modal-connect');
    const server = state.terminals.get(payload.terminalId)?.server
      || state.settings.servers.find((item) => item.id === payload.serverId)
      || {};

    state.pendingSecret = resolve;
    state.pendingSecretMeta = {
      mode: 'terminal-password',
      terminalId: payload.terminalId,
      serverId: payload.serverId || server.id || null
    };

    input.value = '';
    rememberInput.checked = Boolean(server.savePassword);
    rememberRow.classList.remove('hidden');
    actionButton.textContent = 'Send Password';

    title.textContent = `SSH Password Required`;
    message.textContent = `${server.name || payload.serverName || 'SSH server'} is asking for a password. Enter it to continue.`;
    input.placeholder = 'SSH password';

    modal.classList.remove('hidden');
    input.focus();
  });
}

function closeSecretModal(value) {
  const modal = $('#secret-modal');
  const rememberInput = $('#secret-remember-password');
  const meta = state.pendingSecretMeta;

  modal.classList.add('hidden');

  if (state.pendingSecret) {
    if (meta?.mode === 'terminal-password') {
      state.pendingSecret({
        password: value,
        remember: Boolean(rememberInput?.checked),
        terminalId: meta.terminalId,
        serverId: meta.serverId
      });
    } else {
      state.pendingSecret(value);
    }

    state.pendingSecret = null;
    state.pendingSecretMeta = null;
  }
}

async function saveRememberedPassword(serverId, password) {
  if (!serverId || !password) {
    return;
  }

  const server = state.settings.servers.find((item) => item.id === serverId);

  if (!server || server.type !== 'remote') {
    return;
  }

  server.authType = 'password';
  server.password = password;
  server.savePassword = true;

  state.settings = await window.advanceTerminal.saveSettings(state.settings);
  renderServerList();
  renderConnectionManageList();
  showToast('SSH password remembered locally.');
}

async function handleTerminalPasswordRequired(payload) {
  const session = state.terminals.get(payload.terminalId);

  if (!session || session.closed) {
    return;
  }

  if (state.pendingSecretMeta?.mode === 'terminal-password') {
    return;
  }

  appendLiveConsole(`${session.server?.name || 'SSH'} requested a password.`, 'security');
  recordSessionEvent(session, 'SSH requested a password.', 'security');

  const result = await openTerminalPasswordPrompt(payload);

  if (!result || result.password === null || result.password === undefined) {
    appendLiveConsole(`${session.server?.name || 'SSH'} password prompt was cancelled.`, 'warning');
    recordSessionEvent(session, 'SSH password prompt cancelled.', 'warning');
    return;
  }

  await window.advanceTerminal.writeTerminal({
    terminalId: payload.terminalId,
    data: `${result.password}\r`
  });

  if (result.remember) {
    await saveRememberedPassword(result.serverId || session.server?.id, result.password);
  }

  appendLiveConsole(`${session.server?.name || 'SSH'} password was sent.`, 'security');
  recordSessionEvent(session, 'SSH password was sent. Value not recorded.', 'security');
}

function getRemoteAuthenticationIssue(server) {
  if (!server || server.type !== 'remote') {
    return null;
  }

  const authType = String(server.authType || '').trim().toLowerCase();

  if (
    server.authTypeConfigured === false
    || !['password', 'key', 'private-key', 'private_key'].includes(authType)
  ) {
    return {
      code: 'SSH_AUTH_TYPE_MISSING',
      message: 'Authentication type is not configured. Open Add / Manage and select Password or Private Key.'
    };
  }

  if (['key', 'private-key', 'private_key'].includes(authType) && !String(server.privateKeyPath || '').trim()) {
    return {
      code: 'SSH_PRIVATE_KEY_PATH_MISSING',
      message: 'Private key path is not configured. Open Add / Manage and select a private key.'
    };
  }

  return null;
}

function showRemoteAuthenticationIssue(server, issue) {
  if (!issue) {
    return;
  }

  showToast(issue.message, 9000, 'error');
  appendLiveConsole(`${server?.name || 'SSH connection'}: ${issue.message}`, 'error');
}

async function connectSelectedServer(options = {}) {
  const configuredServer = getSelectedServer();
  const requestedWorkingDirectory = normalizeTerminalLocation(options?.workingDirectory || '');
  const server = configuredServer?.type === 'local' && requestedWorkingDirectory
    ? { ...configuredServer, workingDirectory: requestedWorkingDirectory }
    : configuredServer;

  if (!server) {
    showToast('Select a server first.');
    return;
  }

  const authenticationIssue = getRemoteAuthenticationIssue(server);

  if (authenticationIssue) {
    showRemoteAuthenticationIssue(server, authenticationIssue);
    return;
  }

  if (state.connectionHealthCheckInFlight) {
    showToast(
      `Connection check is still running for ${state.connectionHealthCheckInFlight.serverName}. Please wait for it to finish.`,
      5500,
      'warning'
    );
    return;
  }

  const connectingSession = getConnectingTerminalSession();

  if (connectingSession) {
    showConnectionAttemptBusyNotification(connectingSession, server);
    return;
  }

  if (state.connectionAttemptInFlight) {
    showToast('A connection request is already being prepared. Please wait.', 5000, 'warning');
    return;
  }

  state.connectionAttemptInFlight = true;
  updateTerminalInteractionState();

  const previousView = state.activeView;
  const terminalId = randomId('term');
  let session = null;

  try {
    session = createTerminalPane(terminalId, server);
    session.workspaceRestoreWorkingDirectory = server.type === 'remote'
      ? requestedWorkingDirectory
      : '';
    session.status = 'connecting';
    setTerminalStatus('connecting');
    showToast(
      `${server.type === 'remote' ? 'Connecting to' : 'Opening'} ${server.name || server.host || 'terminal'}...`,
      4200,
      'info'
    );

    if (server.type === 'remote') {
      showTerminalConnectingOverlay(session, `Connecting to ${server.name || server.host || 'SSH'}...`);
    }

    const secrets = {};
    const secretRequirement = needsSecret(server);

    if (secretRequirement === 'password') {
      const password = await openSecretModal('password', server);
      if (password === null) {
        closeTerminalSession(terminalId);
        setActiveView(previousView || 'terminal');
        showToast('Connection cancelled.', 3200, 'warning');
        return;
      }
      secrets.password = password;
    }

    if (secretRequirement === 'passphrase-optional') {
      const passphrase = await openSecretModal('passphrase', server);
      if (passphrase === null) {
        closeTerminalSession(terminalId);
        setActiveView(previousView || 'terminal');
        showToast('Connection cancelled.', 3200, 'warning');
        return;
      }
      secrets.passphrase = passphrase;
    }

    try {
      fitTerminalSessionNow(session, { notifyBackend: false });

      const initialSize = getTerminalSize(session);
      const result = await window.advanceTerminal.createTerminal({
        terminalId,
        serverId: configuredServer.id,
        workingDirectory: server.type === 'local' ? requestedWorkingDirectory : '',
        secrets,
        cols: initialSize.cols,
        rows: initialSize.rows
      });

      if (!result?.ok) {
        const busySession = result?.activeTerminalId
          ? state.terminals.get(result.activeTerminalId)
          : getConnectingTerminalSession(terminalId);

        if (['CONNECTION_BUSY', 'TERMINAL_BUSY'].includes(result?.code) && busySession) {
          showConnectionAttemptBusyNotification(busySession, server);
        }

        const connectionError = new Error(result?.error || 'Terminal session could not be started.');
        connectionError.code = result?.code || 'TERMINAL_CREATE_FAILED';
        throw connectionError;
      }

      fitTerminalSession(session, { delays: [0, 120, 360] });

      session.closed = false;
      session.manualClose = false;
      session.hasConnected = true;
      session.authFailed = false;
      session.reconnectAttemptsUsed = 0;
      session.status = server.type === 'remote' ? 'connecting' : 'connected';
      session.report = ensureSessionReport(session);
      session.report.connectedAt = session.report.connectedAt || Date.now();
      session.report.lastUsageCheckpointAt = session.report.lastUsageCheckpointAt || Date.now();
      setTerminalStatus(session.status);
      recordDailySessionStarted(session);
      recordSessionEvent(
        session,
        server.type === 'remote'
          ? `SSH engine started: ${server.name || server.host || terminalId}`
          : `Connected: ${server.name || terminalId}`,
        server.type === 'remote' ? 'system' : 'success'
      );
      updateConnectionHealthFromSession(
        server,
        server.type === 'remote' ? 'checking' : 'ready',
        server.type === 'remote' ? 'Waiting for the SSH prompt.' : 'Connection opened successfully.'
      );
      showTerminalSession(session);

      if (server.type !== 'remote') {
        session.connectionReadyNotified = true;
        showToast(`${server.name || 'Terminal'} is connected.`, 4000, 'success');
      }

      return session;
    } catch (error) {
      session.cleanSshStartupActive = false;
      hideTerminalConnectingOverlay(session);
      session.term.writeln(`Connection failed: ${error.message}`);
      recordSessionEvent(session, `Connection failed: ${error.message}`, 'error');
      appendLiveConsole(`Connection failed for ${server.name || server.host || terminalId}: ${error.message}`, 'error');
      updateConnectionHealthFromSession(server, 'error', error.message || 'Connection failed.');
      session.closed = true;
      session.status = 'error';
      setTerminalStatus('error');
      setActiveView(previousView || 'terminal');

      if (!['CONNECTION_BUSY', 'TERMINAL_BUSY'].includes(error.code)) {
        showToast(`Connection failed: ${error.message}`, 7000, 'error');
      }
    }
  } finally {
    state.connectionAttemptInFlight = false;
    updateTerminalInteractionState();
  }

  return null;
}

function scheduleAutoReconnect(session, payload = {}) {
  if (!shouldAutoReconnectSession(session)) {
    return false;
  }

  const reliability = getConnectionReliability(session.server);
  const nextAttempt = (session.reconnectAttemptsUsed || 0) + 1;
  const delaySeconds = reliability.reconnectDelay;

  session.reconnectAttemptsUsed = nextAttempt;
  session.closed = false;
  session.status = 'reconnecting';
  clearReconnectTimer(session.terminalId);

  const message = `Auto reconnect ${nextAttempt}/${reliability.reconnectAttempts} in ${delaySeconds}s...`;
  session.term.writeln(`\r\n[${message}]\r\n`);
  recordSessionEvent(session, `${message} Last exit code: ${payload.code ?? 'unknown'}.`, 'warning');
  appendLiveConsole(`${session.server?.name || 'Terminal'}: ${message}`, 'warning');

  if (state.activeTerminalId === session.terminalId) {
    setTerminalStatus('reconnecting');
  }

  renderTerminalTabs();

  const timer = setTimeout(() => {
    state.reconnectTimers.delete(session.terminalId);
    reconnectTerminalSession(session).catch((error) => {
      session.term.writeln(`\r\n[Auto reconnect error: ${error.message}]\r\n`);
      recordSessionEvent(session, `Auto reconnect error: ${error.message}`, 'error');

      if (!scheduleAutoReconnect(session, { code: 'retry-error' })) {
        session.closed = true;
        session.status = 'disconnected';
        if (state.activeTerminalId === session.terminalId) {
          setTerminalStatus('disconnected');
        }
        renderTerminalTabs();
      }
    });
  }, delaySeconds * 1000);

  state.reconnectTimers.set(session.terminalId, timer);
  return true;
}

async function reconnectTerminalSession(session) {
  if (!session || session.manualClose || !state.terminals.has(session.terminalId)) {
    return;
  }

  const server = session.server;
  session.status = 'connecting';
  session.connectionReadyNotified = false;

  if (server?.type === 'remote') {
    session.cleanSshStartupActive = true;
    session.cleanSshStartupStartedAt = Date.now();
    session.cleanSshStartupBuffer = '';
    showTerminalConnectingOverlay(session, `Reconnecting to ${server.name || server.host || 'SSH'}...`);
  }

  if (state.activeTerminalId === session.terminalId) {
    setTerminalStatus('connecting', 'Reconnecting');
  } else {
    updateTerminalInteractionState();
  }

  appendLiveConsole(`Reconnecting ${server?.name || session.terminalId}...`, 'system');
  recordSessionEvent(session, 'Auto reconnect started.', 'system');
  showToast(`Reconnecting ${server?.name || 'terminal'}...`, 4200, 'info');

  fitTerminalSessionNow(session, { notifyBackend: false });
  const reconnectSize = getTerminalSize(session);

  const result = await window.advanceTerminal.createTerminal({
    terminalId: session.terminalId,
    serverId: server.id,
    secrets: {},
    cols: reconnectSize.cols,
    rows: reconnectSize.rows
  });

  if (!result?.ok) {
    throw new Error(result?.error || 'Auto reconnect failed.');
  }

  fitTerminalSession(session, { delays: [0, 120, 360] });

  session.closed = false;
  session.manualClose = false;
  session.hasConnected = true;
  session.authFailed = false;
  session.reconnectAttemptsUsed = 0;
  session.status = server?.type === 'remote' ? 'connecting' : 'connected';
  session.report = ensureSessionReport(session);
  session.report.connectedAt = session.report.connectedAt || Date.now();
  session.report.lastUsageCheckpointAt = Date.now();

  session.term.writeln('\r\n[Auto reconnect started.]\r\n');
  recordDailyReconnect(session);
  recordSessionEvent(session, 'Auto reconnect engine started.', 'system');
  appendLiveConsole(`Reconnect started: ${server?.name || session.terminalId}`, 'system');
  updateConnectionHealthFromSession(
    server,
    server?.type === 'remote' ? 'checking' : 'ready',
    server?.type === 'remote' ? 'Waiting for the SSH prompt.' : 'Auto reconnect succeeded.'
  );

  if (state.activeTerminalId === session.terminalId) {
    setTerminalStatus(session.status);
  } else {
    updateTerminalInteractionState();
  }

  if (server?.type !== 'remote') {
    session.connectionReadyNotified = true;
    showToast(`${server?.name || 'Terminal'} is connected.`, 4000, 'success');
  }

  showTerminalSession(session);
  renderTerminalTabs();
}


function cleanupTerminalSessionResources(session) {
  if (!session) {
    return;
  }

  flushTerminalOutputActivity(session.terminalId);
  flushLiveConsoleTerminalOutput(session.terminalId);
  clearTerminalOutputBuffers(session.terminalId);
  clearReconnectTimer(session.terminalId);
  clearTimeout(session.processBusyTimer);
  session.processBusyTimer = null;
  session.processBusy = false;
  session.processLabel = '';

  (session.disposables || []).forEach((disposable) => {
    try {
      disposable?.dispose?.();
    } catch (_) {
      // Ignore terminal listener cleanup failure.
    }
  });

  session.disposables = [];

  if (session.contextMenuHandler && session.pane) {
    try {
      session.pane.removeEventListener('contextmenu', session.contextMenuHandler);
    } catch (_) {
      // Ignore DOM listener cleanup failure.
    }
  }

  if (session.terminalFocusHandler && session.pane) {
    try {
      session.pane.removeEventListener('pointerdown', session.terminalFocusHandler);
      session.pane.removeEventListener('focusin', session.terminalFocusHandler);
    } catch (_) {
      // Ignore DOM listener cleanup failure.
    }
  }

  session.contextMenuHandler = null;
  session.terminalFocusHandler = null;
}

function closeTerminalSession(terminalId) {
  const id = terminalId || state.activeTerminalId;
  const session = state.terminals.get(id);

  if (!session) {
    return Promise.resolve(null);
  }

  const groupId = session.groupId || '';
  const wasActive = state.activeTerminalId === id;
  const wasActiveGroup = state.activeTerminalGroupId === groupId;

  cleanupTerminalSessionResources(session);
  moveActiveSessionToHistory(session, 'Closed by user');
  session.manualClose = true;
  session.closed = true;
  session.status = 'disconnected';

  if (wasActive) {
    setTerminalStatus('disconnected');
  }

  recordSessionEvent(
    session,
    splitGroupTerminalIds(getTerminalGroup(groupId)).length > 1
      ? 'Terminal split pane closed by user.'
      : 'Terminal tab closed by user.',
    'system'
  );

  const closeRequest = Promise.resolve(window.advanceTerminal.closeTerminal({ terminalId: id }))
    .catch((error) => {
      appendActivityFeedEvent(`Terminal close cleanup warning: ${error.message}`, 'warning', { dedupeMs: 1200 });
      return null;
    });

  try {
    session.term.dispose();
  } catch (_) {
    // Ignore dispose failure.
  }

  try {
    session.pane.remove();
  } catch (_) {
    // Ignore pane removal failure.
  }

  state.terminals.delete(id);
  const remainingGroup = removeTerminalFromSplitGroup(id, groupId);

  let nextTerminalId = null;

  if (!wasActive && state.activeTerminalId && state.terminals.has(state.activeTerminalId)) {
    nextTerminalId = state.activeTerminalId;
  } else if (remainingGroup && wasActiveGroup) {
    nextTerminalId = remainingGroup.activeTerminalId || getFirstTerminalIdInGroup(remainingGroup);
  } else {
    const currentGroup = getTerminalGroup(state.activeTerminalGroupId);
    nextTerminalId = currentGroup?.activeTerminalId || getFirstTerminalIdInGroup(currentGroup);

    if (!nextTerminalId) {
      for (const group of state.terminalGroups.values()) {
        nextTerminalId = group.activeTerminalId || getFirstTerminalIdInGroup(group);
        if (nextTerminalId) break;
      }
    }
  }

  if (nextTerminalId && state.terminals.has(nextTerminalId)) {
    activateTerminal(nextTerminalId);
  } else {
    state.activeTerminalId = null;
    state.activeTerminalGroupId = null;
    $('#terminal-empty')?.classList.remove('hidden');
    setTerminalHeaderTitle('Advance Terminal');
    setTerminalStatus('idle');
    updateTerminalLocationHeader(null);
    renderTerminalTabs();
    renderTerminalToolbarActions();
    updateCurrentTabFooter();
    closeTerminalSearch({ focusActiveTerminal: false });
  }

  return closeRequest;
}

function getActiveTerminalSession(actionName = 'terminal action') {
  const session = state.terminals.get(state.activeTerminalId);

  if (!session || session.closed) {
    showToast(`Open or connect a terminal first before using ${actionName}.`);
    setActiveView('terminal');
    return null;
  }

  return session;
}

function focusTerminal(session) {
  try {
    session?.term?.focus();
  } catch (_) {
    // Ignore focus failure.
  }
}

function activateTerminalAndFocus(terminalId) {
  if (!terminalId) {
    return;
  }

  setActiveView('terminal', 'terminal');
  activateTerminal(terminalId);

  const session = state.terminals.get(terminalId);

  if (!session || session.closed) {
    return;
  }

  requestAnimationFrame(() => {
    fitActiveTerminal();
    focusTerminal(session);
  });
}

function clearActiveTerminal() {
  const session = getActiveTerminalSession('Clear Screen');

  if (session) {
    if (!guardTerminalAction(session, 'Clear Screen', 'clear')) {
      return;
    }

    try {
      session.term.clear();
      session.term.write('\x1b[3J\x1b[2J\x1b[H');
      window.advanceTerminal.writeTerminal({
        terminalId: session.terminalId,
        data: '\x0c'
      });
    } catch (_) {
      // Ignore clear failure for closed or resizing terminals.
    }

    recordSessionEvent(session, 'Terminal screen and scrollback cleared.', 'action');
    appendLiveConsole(`Terminal screen and scrollback cleared: ${session.server?.name || 'active terminal'}`, 'action');
    focusTerminal(session);
    showToast('Terminal screen cleared permanently.', 3500, 'success');
  }
}

async function copyAllActiveTerminal() {
  const session = getActiveTerminalSession('Copy All Screen');

  if (!session) {
    return;
  }

  if (!guardTerminalAction(session, 'Copy All Screen', 'copyAll')) {
    return;
  }

  const text = getTerminalBufferText(session.term);

  if (!text) {
    showToast('There is no terminal output to copy.');
    focusTerminal(session);
    return;
  }

  await navigator.clipboard.writeText(text);
  focusTerminal(session);
  showToast('Copied all terminal screen output.');
}

async function writeTerminalSelectionToClipboard(session, options = {}) {
  if (!session || session.closed) {
    return false;
  }

  const selectedText = session.term?.getSelection?.() || '';

  if (!selectedText) {
    if (options.showEmptyMessage !== false) {
      showToast('Select terminal text first.');
    }

    if (options.focus !== false) {
      focusTerminal(session);
    }

    return false;
  }

  await navigator.clipboard.writeText(selectedText);

  if (options.focus !== false) {
    focusTerminal(session);
  }

  if (options.showToast !== false) {
    showToast(options.toastMessage || 'Copied selected terminal text.', 2600, 'success');
  }

  return true;
}

function installTerminalClipboardShortcuts(session) {
  const term = session?.term;

  if (!term || typeof term.attachCustomKeyEventHandler !== 'function') {
    return;
  }

  term.attachCustomKeyEventHandler((event) => {
    if (!event || event.type !== 'keydown') {
      return true;
    }

    const modifierPressed = event.ctrlKey || event.metaKey;

    if (!modifierPressed || event.altKey) {
      return true;
    }

    const key = String(event.key || '').toLowerCase();

    if (key === 'c') {
      const hasSelection = Boolean(term.getSelection?.());

      if (hasSelection) {
        event.preventDefault();
        writeTerminalSelectionToClipboard(session, {
          focus: false,
          toastMessage: event.shiftKey ? 'Copied selection (Ctrl+Shift+C).' : 'Copied selection (Ctrl+C).'
        }).catch((error) => {
          showToast(`Copy failed: ${error.message}`, 5000, 'error');
        });
        return false;
      }

      // No selection: preserve the shell's real Ctrl+C interrupt behavior.
      return event.shiftKey ? false : true;
    }

    if (key === 'v') {
      event.preventDefault();

      navigator.clipboard.readText()
        .then(async (text) => {
          if (!text) {
            showToast('Clipboard is empty.', 3000, 'warning');
            focusTerminal(session);
            return;
          }

          await writeClipboardTextToTerminal(
            session,
            text,
            event.shiftKey ? 'Ctrl+Shift+V clipboard' : 'Ctrl+V clipboard'
          );
        })
        .catch((error) => {
          showToast(`Paste failed: ${error.message}`, 5000, 'error');
          focusTerminal(session);
        });

      return false;
    }

    return true;
  });
}

async function copySelectedTerminalText() {
  const session = getActiveTerminalSession('Copy Selection');

  if (!session) {
    return;
  }

  if (!guardTerminalAction(session, 'Copy Selection', 'copySelection')) {
    return;
  }

  await writeTerminalSelectionToClipboard(session);
}


function getPasteProtectionSettings() {
  return {
    confirmMultiline: state.settings?.ui?.pasteProtection?.confirmMultiline !== false,
    rightClickAutoEnter: state.settings?.ui?.pasteProtection?.rightClickAutoEnter === true,
    lockSshToStartFolder: state.settings?.ui?.pasteProtection?.lockSshToStartFolder !== false
  };
}

function updatePasteProtectionControls() {
  const protection = getPasteProtectionSettings();
  const terminalSafety = getTerminalSafetySettings();
  const multilineToggle = $('#safe-paste-multiline-toggle');
  const rightClickAutoEnterToggle = $('#right-click-auto-enter-toggle');
  const busyActionLockToggle = $('#terminal-busy-action-lock-toggle');
  const sshLockToggle = $('#ssh-lock-start-folder-toggle');

  if (multilineToggle) {
    multilineToggle.checked = protection.confirmMultiline;
  }

  if (rightClickAutoEnterToggle) {
    rightClickAutoEnterToggle.checked = protection.rightClickAutoEnter;
  }

  if (busyActionLockToggle) {
    busyActionLockToggle.checked = terminalSafety.lockActionsWhileCommandRunning;
  }

  if (sshLockToggle) {
    sshLockToggle.checked = protection.lockSshToStartFolder;
  }
}

function updateWindowsAdminControls() {
  const row = $('#windows-admin-mode-row');
  const status = $('#windows-admin-mode-status');
  const button = $('#restart-as-admin-button');
  const isWindows = state.appInfo?.platform === 'win32';
  const isElevated = state.appInfo?.isElevated === true;

  if (!row || !status || !button) {
    return;
  }

  row.classList.toggle('hidden', !isWindows);
  row.classList.toggle('is-elevated', isWindows && isElevated);

  if (!isWindows) {
    return;
  }

  if (isElevated) {
    status.textContent = 'Advance Terminal is running as Administrator. New local PowerShell/CMD sessions inherit this elevated privilege.';
    button.textContent = 'Running as Administrator';
    button.disabled = true;
    return;
  }

  status.textContent = 'Advance Terminal is running normally. Restart elevated when you need Administrator access in local terminal sessions.';
  button.textContent = 'Restart as Administrator';
  button.disabled = false;
}

async function restartAdvanceTerminalAsAdministrator() {
  if (!window.advanceTerminal?.restartAsAdministrator) {
    showToast('Administrator restart is not available in this build.', 6000, 'error');
    return;
  }

  if (state.appInfo?.isElevated) {
    showToast('Advance Terminal is already running as Administrator.', 4000, 'success');
    return;
  }

  const confirmed = await showConfirmDialog({
    title: 'Restart as Administrator?',
    message: 'Windows will show a UAC prompt. Open terminal sessions will close during restart. After elevation, new local terminal sessions inherit Administrator access.',
    confirmLabel: 'Restart as Administrator',
    cancelLabel: 'Cancel'
  });

  if (!confirmed) {
    return;
  }

  const button = $('#restart-as-admin-button');

  if (button) {
    button.disabled = true;
    button.textContent = 'Requesting UAC...';
  }

  const result = await window.advanceTerminal.restartAsAdministrator();

  if (!result?.ok) {
    updateWindowsAdminControls();
    showToast(result?.error || 'Administrator restart failed.', 7000, 'error');
    return;
  }

  if (result.alreadyElevated) {
    state.appInfo.isElevated = true;
    updateWindowsAdminControls();
    showToast('Advance Terminal is already running as Administrator.', 4000, 'success');
    return;
  }

  showToast('Administrator restart started. Approve the Windows UAC prompt.', 5000, 'success');
}

async function updatePasteProtectionSetting(key, enabled) {
  if (!state.settings) {
    return;
  }

  state.settings.ui = {
    ...(state.settings.ui || {}),
    pasteProtection: {
      ...(state.settings.ui?.pasteProtection || {}),
      [key]: Boolean(enabled)
    }
  };

  updatePasteProtectionControls();
  state.settings = await saveSettings({ toastMessage: '', debounce: true, refresh: false });
  updatePasteProtectionControls();
}

async function setTerminalBusyActionLock(enabled) {
  if (!state.settings) {
    return;
  }

  state.settings.ui = {
    ...(state.settings.ui || {}),
    terminalSafety: {
      ...(state.settings.ui?.terminalSafety || {}),
      lockActionsWhileCommandRunning: Boolean(enabled)
    }
  };

  updatePasteProtectionControls();
  updateTerminalInteractionState();
  state.settings = await saveSettings({ toastMessage: '', debounce: true, refresh: false });
  updatePasteProtectionControls();
  updateTerminalInteractionState();

  showToast(
    enabled
      ? 'Running-command action lock enabled. Paste and safe terminal actions stay available.'
      : 'Running-command action lock disabled. Command actions can be sent while a process is running.',
    4500,
    enabled ? 'success' : 'warning'
  );
}

async function setSafePasteMultilineProtection(enabled) {
  await updatePasteProtectionSetting('confirmMultiline', enabled);

  showToast(
    enabled
      ? 'Multi-line paste protection enabled.'
      : 'Multi-line paste protection disabled.',
    3500,
    enabled ? 'success' : 'warning'
  );
}

async function setRightClickAutoEnter(enabled) {
  await updatePasteProtectionSetting('rightClickAutoEnter', enabled);

  showToast(
    enabled
      ? 'Right-click paste auto-enter enabled.'
      : 'Right-click paste auto-enter disabled.',
    3500,
    enabled ? 'warning' : 'success'
  );
}

async function setSshStartFolderLock(enabled) {
  await updatePasteProtectionSetting('lockSshToStartFolder', enabled);

  if (!enabled) {
    state.terminals.forEach((session) => {
      session.sshTypedCommandBuffer = '';
    });
  }

  showToast(
    enabled
      ? 'SSH terminal start-folder lock enabled.'
      : 'SSH terminal start-folder lock disabled.',
    3500,
    enabled ? 'success' : 'warning'
  );
}

function getPasteLineCount(text) {
  if (!text) {
    return 0;
  }

  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').length;
}

function isMultilinePasteText(text) {
  return getPasteLineCount(text) > 1;
}

function collapsePasteToOneLine(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
}

function getPastePreviewText(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const maxLength = 4000;

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}\n\n... [preview truncated]`;
}

function openSafePasteDialog({ text, sourceLabel = 'clipboard' } = {}) {
  const modal = $('#safe-paste-modal');
  const message = $('#safe-paste-message');
  const preview = $('#safe-paste-preview');
  const cancelButton = $('#safe-paste-cancel');

  if (!modal || !message || !preview) {
    return Promise.resolve(null);
  }

  if (state.pendingSafePasteResolve) {
    state.pendingSafePasteResolve(null);
    state.pendingSafePasteResolve = null;
  }

  const lineCount = getPasteLineCount(text);
  const characterCount = String(text || '').length;

  message.textContent = `${sourceLabel} contains ${lineCount} lines and ${characterCount} characters. Line breaks can execute commands immediately in the terminal.`;
  preview.value = getPastePreviewText(text);

  modal.classList.remove('hidden');
  cancelButton?.focus();

  return new Promise((resolve) => {
    state.pendingSafePasteResolve = resolve;
  });
}

function closeSafePasteDialog(result) {
  const modal = $('#safe-paste-modal');

  if (modal) {
    modal.classList.add('hidden');
  }

  const resolve = state.pendingSafePasteResolve;
  state.pendingSafePasteResolve = null;

  if (resolve) {
    resolve(result || null);
  }
}

async function choosePasteAction(text, sourceLabel) {
  if (!getPasteProtectionSettings().confirmMultiline || !isMultilinePasteText(text)) {
    return 'execute';
  }

  return openSafePasteDialog({ text, sourceLabel });
}

function appendTerminalEnterIfMissing(data) {
  const value = String(data || '');

  if (!value) {
    return value;
  }

  return /[\r\n]$/.test(value) ? value : `${value}\r`;
}

async function writeClipboardTextToTerminal(session, text, sourceLabel, options = {}) {
  if (!session || session.closed) {
    showToast('This terminal session is closed.', 'warning');
    return false;
  }

  if (!guardTerminalAction(session, sourceLabel || 'Paste', 'paste')) {
    return false;
  }

  const action = await choosePasteAction(text, sourceLabel);

  if (!action) {
    focusTerminal(session);
    showToast('Paste cancelled.', 3000, 'warning');
    recordSessionEvent(session, `${sourceLabel} paste cancelled.`, 'warning');
    return false;
  }

  const data = action === 'single-line' ? collapsePasteToOneLine(text) : text;

  if (!data) {
    focusTerminal(session);
    showToast('Clipboard has no text to paste.', 'warning');
    return false;
  }

  const autoEnter = options?.autoEnter === true;
  const terminalData = autoEnter ? appendTerminalEnterIfMissing(data) : data;
  const sshLockResult = inspectSshLockedTerminalData(session, terminalData);

  if (sshLockResult.blocked) {
    showSshPathLockBlocked(session, sshLockResult.reason);
    return false;
  }

  applySshLockedLocationResult(session, sshLockResult);
  session.sshTypedCommandBuffer = sshLockResult.trailing || '';

  window.advanceTerminal.writeTerminal({
    terminalId: session.terminalId,
    data: terminalData
  });

  recordTerminalInput(session, terminalData);

  const modeLabel = action === 'single-line' ? 'as one line' : 'with original line breaks';
  const enterLabel = autoEnter ? ', then Enter' : '';
  recordSessionEvent(session, `${sourceLabel} paste (${data.length} characters, ${modeLabel}${enterLabel}).`, 'action');
  appendLiveConsole(`${sourceLabel} pasted into ${session.server?.name || 'active terminal'} (${data.length} characters, ${modeLabel}${enterLabel}).`, 'action');
  focusTerminal(session);
  showToast(
    autoEnter
      ? 'Pasted clipboard and sent Enter.'
      : action === 'single-line'
        ? 'Pasted clipboard as one line.'
        : 'Pasted clipboard into terminal.',
    'success'
  );

  return true;
}

async function typeTextToActiveTerminal(text, label = 'Type Text') {
  const session = getActiveTerminalSession(label);

  if (!session) {
    return false;
  }

  if (!guardTerminalAction(session, label, 'typeText')) {
    return false;
  }

  const payload = String(text || '').replace(/[\r\n]+/g, ' ');

  if (!payload) {
    showToast('Type Text action is empty.', 3500, 'warning');
    focusTerminal(session);
    return false;
  }

  const sshLockResult = inspectSshLockedTerminalData(session, payload);

  if (sshLockResult.blocked) {
    showSshPathLockBlocked(session, sshLockResult.reason);
    return false;
  }

  applySshLockedLocationResult(session, sshLockResult);
  session.sshTypedCommandBuffer = sshLockResult.trailing || '';

  window.advanceTerminal.writeTerminal({
    terminalId: session.terminalId,
    data: payload
  });

  recordTerminalInput(session, payload);
  recordSessionEvent(session, `${label} typed ${payload.length} characters without Enter.`, 'action');
  appendLiveConsole(`${label} typed into ${session.server?.name || 'active terminal'} without Enter.`, 'action');
  focusTerminal(session);
  showToast(`${label} typed without Enter.`, 3200, 'success');
  return true;
}

async function pasteClipboardToTerminal() {
  const session = getActiveTerminalSession('Paste');

  if (!session) {
    return;
  }

  const text = await navigator.clipboard.readText();

  if (!text) {
    showToast('Clipboard is empty.');
    focusTerminal(session);
    return;
  }

  await writeClipboardTextToTerminal(session, text, 'Toolbar clipboard');
}

function sendControlToActiveTerminal(sequence, label, explicitActionKind = '') {
  const session = getActiveTerminalSession(label);

  if (!session) {
    return;
  }

  const inferredActionKind = sequence === '\x03'
    ? 'ctrlC'
    : sequence === '\x0c'
      ? 'ctrlL'
      : sequence === '\x04'
        ? 'ctrlD'
        : 'sendText';
  const actionKind = explicitActionKind || inferredActionKind;

  if (!guardTerminalAction(session, label, actionKind)) {
    return;
  }

  window.advanceTerminal.writeTerminal({
    terminalId: session.terminalId,
    data: sequence
  });

  recordSessionEvent(session, `Sent ${label}.`, 'action');
  appendLiveConsole(`Sent ${label} to ${session.server?.name || 'active terminal'}.`, 'action');
  focusTerminal(session);
  showToast(`Sent ${label}.`);
}

function loadServerForm(serverId) {
  // The full Settings → Servers form was removed.
  // Keep this safe no-op for older calls that only need selection state.
  const server = state.settings.servers.find((item) => item.id === serverId);

  if (server) {
    state.editingServerId = server.id;
  }
}


function getServerFromForm() {
  const type = $('#server-type').value;
  const id = state.editingServerId || randomId('server');

  if (type === 'local') {
    return {
      id,
      type: 'local',
      name: $('#server-name').value.trim() || 'Local Terminal',
      description: $('#server-description').value.trim() || 'Local Terminal',
      shell: $('#server-shell').value.trim(),
      workingDirectory: $('#server-working-directory').value.trim()
    };
  }

  const savePassword = $('#server-save-password').checked;
  const savePassphrase = $('#server-save-passphrase').checked;

  return {
    id,
    type: 'remote',
    name: $('#server-name').value.trim() || $('#server-host').value.trim() || 'Remote SSH',
    description: $('#server-description').value.trim() || 'Remote SSH',
    host: $('#server-host').value.trim(),
    port: Number($('#server-port').value || 22),
    username: $('#server-username').value.trim(),
    authType: $('#server-auth-type').value,
    privateKeyPath: $('#server-private-key-path').value.trim(),
    workingDirectory: $('#server-working-directory').value.trim(),
    password: savePassword ? $('#server-password').value : '',
    savePassword,
    passphrase: savePassphrase ? $('#server-passphrase').value : '',
    savePassphrase
  };
}

function updateServerFormVisibility() {
  const type = $('#server-type').value;
  const authType = $('#server-auth-type').value;

  $$('.local-only').forEach((item) => item.classList.toggle('hidden', type !== 'local'));
  $$('.remote-only').forEach((item) => item.classList.toggle('hidden', type !== 'remote'));
  $$('.key-auth-only').forEach((item) => item.classList.toggle('hidden', type !== 'remote' || authType !== 'key'));
  $$('.password-auth-only').forEach((item) => item.classList.toggle('hidden', type !== 'remote' || authType !== 'password'));
}

async function saveSettings(options = {}) {
  const {
    toastMessage = 'Settings saved.',
    debounce = false,
    refresh = true
  } = options || {};

  if (debounce) {
    return scheduleSettingsSave({ toastMessage, refresh });
  }

  return saveSettingsNow({ toastMessage, refresh });
}

async function exportSettingsBackup() {
  return withBusyAction('exportSettings', 'Exporting...', async () => {
    try {
      await persistReportUsage();
      const result = await window.advanceTerminal.exportSettings({
        ...state.settings,
        selectedServerId: state.selectedServerId
      });

      if (!result || result.canceled) {
        showToast('Settings export cancelled.', 3500, 'warning');
        return;
      }

      if (!result.ok) {
        showToast(result.error || 'Settings export failed.', 7000, 'error');
        return;
      }

      showToast(`Settings exported to ${result.filePath}`, 7000, 'success');
      state.settings = await window.advanceTerminal.getSettings();
      renderAuditLog();
    } catch (error) {
      appendLiveConsole(`Settings export failed: ${error.message}`, 'error');
      showToast(`Settings export failed: ${error.message}`, 7000, 'error');
    }
  });
}


function refreshAppAfterSettingsImport() {
  state.settings.reportUsage = normalizeReportUsageClient(state.settings.reportUsage);
  state.settings.reportHistory = normalizeReportHistoryClient(state.settings.reportHistory);
  state.settings.reportOptions = normalizeReportOptionsClient(state.settings.reportOptions);
  state.selectedServerId = state.settings.selectedServerId || state.settings.servers[0]?.id || null;

  applyTheme(getUiTheme());
  applyNotificationPosition(getNotificationPosition());
  updatePasteProtectionControls();
  updateTerminalInteractionState();
  syncReportCustomRangeControls();
  ensureReportCustomRangeValues(state.currentReportDateFilter);
  renderTerminalToolbarActions();
  renderTerminalProfileQuickMenu();
  renderWorkspaceQuickMenu();
  updateConnectionFilterButtons();
  renderServerList();
  renderConnectionManageList();
  renderCommandList();
  renderManageCommandList();
  renderAuditLog();
  updateAboutInfo();

  if (state.selectedServerId) {
    selectServer(state.selectedServerId);
  }

  if (state.activeSettingsTab === 'restore') {
    renderSettingsRestorePoints();
  }

  if (!getWorkspaceById(state.editingWorkspaceId)) {
    state.editingWorkspaceId = null;
    state.workspaceDraftMode = false;
  }

  if (!getWorkspaceById(state.activeWorkspaceId)) {
    state.activeWorkspaceId = null;
  }

  if (state.activeSettingsTab === 'workspaces') {
    renderWorkspaceSettings();
  }

  if (state.activeSettingsTab === 'terminal-actions') {
    renderTerminalActionsSettings();
  }

  if (state.activeSettingsTab === 'terminal-profiles') {
    renderTerminalProfilesSettings();
  }

  if (state.activeSettingsTab === 'keys') {
    refreshSshKeys({ silent: true });
  }
}

async function importSettingsBackup() {
  return withBusyAction('importSettings', 'Importing...', async () => {
    try {
      const previewResult = await window.advanceTerminal.importSettingsPreview();

      if (!previewResult || previewResult.canceled) {
        showToast('Settings import cancelled.', 3500, 'warning');
        return;
      }

      if (!previewResult.ok) {
        showToast(previewResult.error || 'Settings import failed.', 7000, 'error');
        return;
      }

      const confirmed = await showConfirmDialog({
        title: 'Import Settings Backup?',
        message: buildSettingsImportPreviewMessage(previewResult.preview),
        confirmLabel: 'Import Settings',
        cancelLabel: 'Cancel'
      });

      if (!confirmed) {
        await window.advanceTerminal.cancelSettingsImport?.();
        showToast('Settings import cancelled.', 3500, 'warning');
        return;
      }

      const applyResult = await window.advanceTerminal.importSettingsApply();

      if (!applyResult?.ok) {
        showToast(applyResult?.error || 'Settings import failed.', 7000, 'error');
        return;
      }

      state.settings = applyResult.settings || await window.advanceTerminal.getSettings();
      refreshAppAfterSettingsImport();
      showToast('Settings imported successfully.', 6000, 'success');
    } catch (error) {
      appendLiveConsole(`Settings import failed: ${error.message}`, 'error');
      showToast(`Settings import failed: ${error.message}`, 7000, 'error');
    }
  });
}


function buildSettingsRepairPreviewMessage(preview) {
  const candidate = preview?.candidate || {};
  const current = preview?.current || {};
  const names = Array.isArray(candidate.serverNames) && candidate.serverNames.length
    ? candidate.serverNames.join(', ')
    : 'No names found';

  return [
    `Current settings: ${current.serverCount || 0} connection(s).`,
    `Repair backup: ${candidate.serverCount || 0} connection(s) from ${candidate.fileName || 'local backup'}.`,
    `Servers found: ${names}${candidate.serverCount > candidate.serverNames?.length ? ', ...' : ''}`,
    '',
    'The app will first create a backup of your current settings.json.',
    'Only valid readable JSON backups are considered; corrupt .broken files are ignored.',
    'Inline passwords/passphrases will not be copied; existing secure saved secrets are reused when server IDs match.'
  ].join('\n');
}


function formatRestorePointDate(value) {
  if (!value) {
    return 'Unknown time';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return date.toLocaleString();
}

function formatRestorePointSize(bytes) {
  const value = Number(bytes || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  if (value < 1024) {
    return `${Math.round(value)} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function summarizeRestorePointNames(point) {
  const names = Array.isArray(point?.serverNames)
    ? point.serverNames.filter(Boolean)
    : [];

  if (!names.length) {
    return 'No connection names found';
  }

  return `${names.join(', ')}${point.serverCount > names.length ? ', ...' : ''}`;
}

function renderRestorePointEmpty(message) {
  const list = $('#restore-points-list');

  if (!list) {
    return;
  }

  list.innerHTML = '';

  const item = document.createElement('div');
  item.className = 'restore-empty';
  item.textContent = message;
  list.appendChild(item);
}

function renderSettingsRestorePointList(points) {
  const list = $('#restore-points-list');

  if (!list) {
    return;
  }

  list.innerHTML = '';

  if (!points.length) {
    renderRestorePointEmpty('No valid restore points found yet.');
    return;
  }

  points.forEach((point) => {
    const item = document.createElement('div');
    item.className = 'restore-point-card';

    const details = document.createElement('div');
    details.className = 'restore-point-details';

    const title = document.createElement('div');
    title.className = 'restore-point-title';
    title.textContent = `${point.sourceLabel || 'Restore point'} · ${formatRestorePointDate(point.modifiedAt)}`;

    const meta = document.createElement('div');
    meta.className = 'restore-point-meta';
    meta.textContent = [
      `${point.serverCount || 0} connection(s)`,
      `${point.remoteConnections || 0} SSH`,
      `${point.localConnections || 0} local`,
      `${point.commandCount || 0} command(s)`,
      formatRestorePointSize(point.size)
    ].join(' · ');

    const names = document.createElement('div');
    names.className = 'restore-point-names';
    names.textContent = summarizeRestorePointNames(point);

    const fileName = document.createElement('div');
    fileName.className = 'restore-point-file';
    fileName.textContent = point.fileName || 'Unknown backup file';

    details.appendChild(title);
    details.appendChild(meta);
    details.appendChild(names);
    details.appendChild(fileName);

    const actions = document.createElement('div');
    actions.className = 'restore-point-actions';

    const restoreButton = document.createElement('button');
    restoreButton.className = 'primary-button';
    restoreButton.type = 'button';
    restoreButton.textContent = 'Restore';
    restoreButton.addEventListener('click', () => restoreSettingsPoint(point));

    actions.appendChild(restoreButton);

    item.appendChild(details);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

function renderRestoreCurrentSummary(summary, invalidCount = 0) {
  const target = $('#restore-current-summary');

  if (!target) {
    return;
  }

  const names = Array.isArray(summary?.serverNames) && summary.serverNames.length
    ? summary.serverNames.join(', ')
    : 'No names found';

  target.textContent = [
    `Current settings: ${summary?.serverCount || 0} connection(s).`,
    `First connections: ${names}${summary?.serverCount > summary?.serverNames?.length ? ', ...' : ''}`,
    invalidCount ? `${invalidCount} invalid/corrupt backup file(s) skipped.` : 'Only valid restore points are shown.'
  ].join(' ');
}

async function renderSettingsRestorePoints() {
  const list = $('#restore-points-list');

  if (!window.advanceTerminal.listSettingsRestorePoints) {
    renderRestorePointEmpty('Restore Points is not available in this build.');
    return;
  }

  if (list) {
    list.innerHTML = '<div class="restore-empty">Loading restore points...</div>';
  }

  try {
    const result = await window.advanceTerminal.listSettingsRestorePoints();

    if (!result?.ok) {
      renderRestorePointEmpty(result?.error || 'Could not load restore points.');
      return;
    }

    state.settingsRestoreSummary = result.current || null;
    state.settingsRestorePoints = Array.isArray(result.restorePoints) ? result.restorePoints : [];

    renderRestoreCurrentSummary(state.settingsRestoreSummary, result.invalidCount || 0);
    renderSettingsRestorePointList(state.settingsRestorePoints);
  } catch (error) {
    appendLiveConsole(`Restore point list failed: ${error.message}`, 'error');
    renderRestorePointEmpty(`Could not load restore points: ${error.message}`);
  }
}

function buildSettingsRestoreMessage(point) {
  return [
    `Restore point: ${point.sourceLabel || 'Backup'} from ${formatRestorePointDate(point.modifiedAt)}.`,
    `File: ${point.fileName || 'Unknown backup file'}.`,
    `Connections: ${point.serverCount || 0} total, ${point.remoteConnections || 0} SSH, ${point.localConnections || 0} local.`,
    `Servers found: ${summarizeRestorePointNames(point)}`,
    '',
    'Before restoring, the app will create a backup of your current settings.json.',
    'Only valid readable JSON restore points can be restored.',
    'Inline passwords/passphrases will not be copied; existing secure saved secrets are reused when server IDs match.'
  ].join('\n');
}

async function restoreSettingsPoint(point) {
  if (!point || !point.fileName) {
    showToast('Restore point is missing.', 5000, 'warning');
    return;
  }

  const confirmed = await showConfirmDialog({
    title: 'Restore This Settings Backup?',
    message: buildSettingsRestoreMessage(point),
    confirmLabel: 'Restore',
    cancelLabel: 'Cancel'
  });

  if (!confirmed) {
    showToast('Settings restore cancelled.', 3500, 'warning');
    return;
  }

  return withBusyAction('restoreSettings', 'Restoring...', async () => {
    try {
      const result = await window.advanceTerminal.restoreSettingsPoint({
        fileName: point.fileName
      });

      if (!result?.ok) {
        showToast(result?.error || 'Settings restore failed.', 7000, 'error');
        return;
      }

      state.settings = result.settings || await window.advanceTerminal.getSettings();
      refreshAppAfterSettingsImport();
      await renderSettingsRestorePoints();
      showToast(`Settings restored from ${result.sourceFileName || 'restore point'}.`, 7000, 'success');
    } catch (error) {
      appendLiveConsole(`Settings restore failed: ${error.message}`, 'error');
      showToast(`Settings restore failed: ${error.message}`, 7000, 'error');
    }
  });
}


async function repairSettingsFromLocalBackup() {
  return withBusyAction('repairSettings', 'Repairing...', async () => {
    try {
      const previewResult = await window.advanceTerminal.repairSettingsPreview();

      if (!previewResult?.ok) {
        showToast(previewResult?.error || 'No settings repair backup was found.', 7000, previewResult?.noRepairNeeded ? 'info' : 'warning');
        return;
      }

      const confirmed = await showConfirmDialog({
        title: 'Repair Settings From Local Backup?',
        message: buildSettingsRepairPreviewMessage(previewResult),
        confirmLabel: 'Repair Settings',
        cancelLabel: 'Cancel'
      });

      if (!confirmed) {
        showToast('Settings repair cancelled.', 3500, 'warning');
        return;
      }

      const repairResult = await window.advanceTerminal.repairSettingsApply();

      if (!repairResult?.ok) {
        showToast(repairResult?.error || 'Settings repair failed.', 7000, 'error');
        return;
      }

      state.settings = repairResult.settings || await window.advanceTerminal.getSettings();
      refreshAppAfterSettingsImport();
      showToast(`Settings repaired. Restored ${repairResult.restoredServerCount || state.settings.servers.length} connection(s).`, 7000, 'success');
    } catch (error) {
      appendLiveConsole(`Settings repair failed: ${error.message}`, 'error');
      showToast(`Settings repair failed: ${error.message}`, 7000, 'error');
    }
  });
}


async function saveServerFromForm() {
  const server = getServerFromForm();

  if (server.type === 'remote') {
    if (!server.host || !server.username) {
      showToast('Remote SSH needs host and username.');
      return;
    }

    if (server.authType === 'key' && !server.privateKeyPath) {
      showToast('Private-key SSH needs a private key path.');
      return;
    }
  }

  const index = state.settings.servers.findIndex((item) => item.id === server.id);

  if (index >= 0) {
    state.settings.servers[index] = server;
  } else {
    state.settings.servers.push(server);
  }

  state.selectedServerId = server.id;
  state.settings.selectedServerId = server.id;
  await saveSettings();
  selectServer(server.id);
  showToast('Server saved.');
}

async function deleteSelectedServer() {
  if (!state.editingServerId) {
    return;
  }

  if (state.settings.servers.length <= 1) {
    showToast('At least one server is required.');
    return;
  }

  const server = state.settings.servers.find((item) => item.id === state.editingServerId);
  const confirmed = confirm(`Delete server "${server?.name || 'selected server'}"?`);

  if (!confirmed) {
    return;
  }

  state.settings.servers = state.settings.servers.filter((item) => item.id !== state.editingServerId);
  state.selectedServerId = state.settings.servers[0].id;
  await saveSettings();
  selectServer(state.selectedServerId);
}

function newServer(type = 'remote') {
  openAddConnectionModal(type === 'local' ? 'local' : 'remote', true);
}


function showConfirmDialog(options = {}) {
  const modal = $('#confirm-modal');
  const title = $('#confirm-modal-title');
  const message = $('#confirm-modal-message');
  const confirmButton = $('#confirm-modal-confirm');
  const cancelButton = $('#confirm-modal-cancel');

  if (!modal || !title || !message || !confirmButton || !cancelButton) {
    return Promise.resolve(window.confirm(options.message || 'Continue?'));
  }

  if (state.pendingConfirmResolve) {
    state.pendingConfirmResolve(false);
    state.pendingConfirmResolve = null;
  }

  title.textContent = options.title || 'Confirm';
  message.textContent = options.message || 'Continue?';
  confirmButton.textContent = options.confirmLabel || 'OK';
  cancelButton.textContent = options.cancelLabel || 'Cancel';

  modal.classList.remove('hidden');
  confirmButton.focus();

  return new Promise((resolve) => {
    state.pendingConfirmResolve = resolve;
  });
}

function closeConfirmDialog(result) {
  const modal = $('#confirm-modal');

  if (modal) {
    modal.classList.add('hidden');
  }

  const resolve = state.pendingConfirmResolve;
  state.pendingConfirmResolve = null;

  if (resolve) {
    resolve(Boolean(result));
  }
}


function updateConnectionReliabilityUi() {
  const autoReconnectInput = $('#add-connection-auto-reconnect');
  const attemptsInput = $('#add-connection-reconnect-attempts');
  const delayInput = $('#add-connection-reconnect-delay');

  const enabled = Boolean(autoReconnectInput?.checked);

  if (attemptsInput) {
    attemptsInput.disabled = !enabled;
  }

  if (delayInput) {
    delayInput.disabled = !enabled;
  }
}

function updateAddConnectionFormVisibility() {
  const typeInput = $('#add-connection-type');
  const authTypeInput = $('#add-connection-auth-type');
  const startFolderInput = $('#add-connection-start-folder');
  const nameLabel = $('#add-connection-name-label');
  const warning = $('#add-connection-root-warning');

  if (!typeInput || !startFolderInput || !nameLabel || !warning) {
    return;
  }

  const isRemote = typeInput.value !== 'local';
  const authType = String(authTypeInput?.value || '').trim().toLowerCase();
  const startFolder = startFolderInput.value.trim();

  nameLabel.textContent = isRemote ? 'SSH Name' : 'Name';

  $$('.remote-add-only').forEach((item) => {
    item.classList.toggle('hidden', !isRemote);
  });

  $$('.local-add-only').forEach((item) => {
    item.classList.toggle('hidden', isRemote);
  });

  if (!isRemote) {
    populateLocalProfileDropdown($('#add-connection-profile')?.value || '');
  }

  $$('.password-add-only').forEach((item) => {
    item.classList.toggle('hidden', !isRemote || authType !== 'password');
  });

  $$('.key-add-only').forEach((item) => {
    item.classList.toggle('hidden', !isRemote || authType !== 'key');
  });

  if (!startFolder) {
    warning.classList.remove('hidden');
    warning.textContent = isRemote
      ? 'Warning: Start Folder is empty. SSH terminal will open root folder (/).'
      : 'Warning: Start Folder is empty. Local terminal will open the drive root.';
  } else {
    warning.classList.add('hidden');
  }

  updateSelectedPrivateKeyPathInfo();
  updateConnectionReliabilityUi();
}


function updateSelectedPrivateKeyPathInfo() {
  const select = $('#add-connection-private-key-path');
  const help = $('#selected-private-key-path');

  if (!select || !help) {
    return;
  }

  const selectedPath = String(select.value || '').trim();
  const selectedKey = state.sshKeys.find((key) => key.privateKeyPath === selectedPath);

  help.classList.toggle('warning', Boolean(selectedKey && !selectedKey.hasPublicKey));

  if (!selectedPath) {
    help.textContent = state.sshKeys.length
      ? 'Select a private key. Public key must be added to your hosting/server first.'
      : 'No private keys found. Go to Settings → SSH Keys to generate one.';
    return;
  }

  if (selectedKey) {
    help.textContent = selectedKey.hasPublicKey
      ? selectedKey.privateKeyPath
      : `${selectedKey.privateKeyPath} · matching .pub file is missing`;
    return;
  }

  help.textContent = selectedPath;
}

function populatePrivateKeyDropdown(selectedPath = null) {
  const select = $('#add-connection-private-key-path');

  if (!select) {
    return;
  }

  const currentPath = selectedPath !== null && selectedPath !== undefined
    ? String(selectedPath || '')
    : String(select.value || '');

  select.innerHTML = '';

  if (!state.sshKeys.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No SSH private keys found';
    select.appendChild(option);
    select.value = '';
    updateSelectedPrivateKeyPathInfo();
    return;
  }

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a private key';
  select.appendChild(placeholder);

  state.sshKeys.forEach((key) => {
    const option = document.createElement('option');
    option.value = key.privateKeyPath;
    option.textContent = getSshKeyLabel(key);
    select.appendChild(option);
  });

  if (currentPath && !state.sshKeys.some((key) => key.privateKeyPath === currentPath)) {
    const customOption = document.createElement('option');
    customOption.value = currentPath;
    customOption.textContent = `Current saved path — ${getPathFileName(currentPath)}`;
    select.appendChild(customOption);
  }

  select.value = currentPath || '';
  updateSelectedPrivateKeyPathInfo();
}

function renderSshKeyList() {
  const list = $('#ssh-key-list');

  if (!list) {
    return;
  }

  list.innerHTML = '';

  if (!state.sshKeys.length) {
    const empty = document.createElement('div');
    empty.className = 'ssh-key-empty';
    empty.innerHTML = `
      <strong>No SSH private keys found.</strong>
      <span>Generate a new key above, or place an existing private key in your Windows .ssh folder.</span>
    `;
    list.appendChild(empty);
    return;
  }

  state.sshKeys.forEach((key) => {
    const row = document.createElement('div');
    row.className = 'ssh-key-row';

    const info = document.createElement('div');
    info.className = 'ssh-key-info';

    const title = document.createElement('div');
    title.className = 'ssh-key-title';

    const name = document.createElement('strong');
    name.textContent = key.name;

    const status = document.createElement('span');
    status.className = key.hasPublicKey ? 'ssh-key-status ok' : 'ssh-key-status warning';
    status.textContent = key.hasPublicKey ? 'Public key ready' : 'Public key missing';

    title.appendChild(name);
    title.appendChild(status);

    const pathLine = document.createElement('div');
    pathLine.className = 'ssh-key-path';
    pathLine.textContent = key.privateKeyPath;

    const meta = document.createElement('div');
    meta.className = 'ssh-key-meta';
    meta.textContent = `${key.locationLabel} · Modified ${formatSshKeyDate(key.modifiedAt)}`;

    info.appendChild(title);
    info.appendChild(pathLine);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'ssh-key-actions';

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'secondary-button';
    copyButton.dataset.keyAction = 'copy-public';
    copyButton.dataset.keyPath = key.privateKeyPath;
    copyButton.disabled = !key.hasPublicKey;
    copyButton.textContent = 'Copy Public Key';

    const revealButton = document.createElement('button');
    revealButton.type = 'button';
    revealButton.className = 'secondary-button';
    revealButton.dataset.keyAction = 'reveal';
    revealButton.dataset.keyPath = key.privateKeyPath;
    revealButton.textContent = 'Reveal File';

    const archiveButton = document.createElement('button');
    archiveButton.type = 'button';
    archiveButton.className = 'danger-button ssh-key-archive-button';
    archiveButton.dataset.keyAction = 'archive';
    archiveButton.dataset.keyPath = key.privateKeyPath;
    archiveButton.textContent = 'Archive Key';

    actions.appendChild(copyButton);
    actions.appendChild(revealButton);
    actions.appendChild(archiveButton);

    row.appendChild(info);
    row.appendChild(actions);
    list.appendChild(row);
  });
}

async function refreshSshKeys(options = {}) {
  try {
    const result = await window.advanceTerminal.listSshKeys();

    state.sshKeys = Array.isArray(result?.keys) ? result.keys : [];
    state.sshKeyLocations = Array.isArray(result?.locations) ? result.locations : [];

    renderSshKeyList();
    populatePrivateKeyDropdown(options.selectedPath);

    if (!options.silent) {
      showToast('SSH key list refreshed.', 'success');
    }

    return state.sshKeys;
  } catch (error) {
    if (!options.silent) {
      showToast(`Could not load SSH keys: ${error.message}`, 7000);
    }

    state.sshKeys = [];
    renderSshKeyList();
    populatePrivateKeyDropdown(options.selectedPath);
    return [];
  }
}

async function copyPublicKeyForPrivateKey(privateKeyPath) {
  const result = await window.advanceTerminal.readPublicKey(privateKeyPath);

  if (!result?.ok) {
    showToast(result?.error || 'Public key could not be read.', 7000);
    return;
  }

  await navigator.clipboard.writeText(result.publicKey);
  showToast('Public key copied. Add it to your hosting SSH Keys or authorized_keys.', 5000, 'success');
}

async function openSshKeyFolder(payload) {
  const result = await window.advanceTerminal.openSshKeyFolder(payload || {});

  if (!result?.ok) {
    showToast(result?.error || 'Could not open SSH key folder.', 7000);
  }
}

async function archiveSshKey(privateKeyPath) {
  const selectedPath = String(privateKeyPath || '').trim();
  const key = state.sshKeys.find((item) => item.privateKeyPath === selectedPath);
  const keyName = key?.name || getPathFileName(selectedPath) || 'selected key';

  const confirmed = await showConfirmDialog({
    title: 'Archive SSH Key?',
    message: `This will move "${keyName}" and its matching .pub file into a local archive folder. It will disappear from the key list and private key dropdown, but it can still be recovered from the archive folder. Continue?`,
    confirmLabel: 'Archive Key',
    cancelLabel: 'Cancel'
  });

  if (!confirmed) {
    return;
  }

  const result = await window.advanceTerminal.archiveSshKey(selectedPath);

  if (!result?.ok) {
    showToast(result?.error || 'Could not archive SSH key.', 7000, 'error');
    return;
  }

  const dropdown = $('#add-connection-private-key-path');
  const archivedPath = result.privateKeyPath || selectedPath;

  await refreshSshKeys({ silent: true });

  if (dropdown && dropdown.value === archivedPath) {
    dropdown.value = '';
    updateSelectedPrivateKeyPathInfo();
  }

  const archivedCount = Array.isArray(result.archivedFiles) ? result.archivedFiles.length : 1;
  showToast(`SSH key archived safely. ${archivedCount} file${archivedCount === 1 ? '' : 's'} moved to backup folder.`, 7000, 'success');
}

async function archiveAllSshKeys() {
  if (!state.sshKeys.length) {
    showToast('No SSH private keys found to archive.', 5000, 'warning');
    return;
  }

  const confirmed = await showConfirmDialog({
    title: 'Archive All SSH Keys?',
    message: `This will move ${state.sshKeys.length} private key${state.sshKeys.length === 1 ? '' : 's'} and matching .pub files into local archive folders. known_hosts and config will stay untouched. Continue?`,
    confirmLabel: 'Archive All Keys',
    cancelLabel: 'Cancel'
  });

  if (!confirmed) {
    return;
  }

  const result = await window.advanceTerminal.archiveAllSshKeys();

  if (!result?.ok) {
    showToast(result?.error || 'Could not archive SSH keys.', 7000, 'error');
    return;
  }

  await refreshSshKeys({ silent: true });

  const dropdown = $('#add-connection-private-key-path');
  if (dropdown) {
    dropdown.value = '';
    updateSelectedPrivateKeyPathInfo();
  }

  if (result.failures?.length) {
    showToast(`Archived ${result.archivedCount || 0} key(s). ${result.failures.length} key(s) could not be archived.`, 8000, 'warning');
    return;
  }

  showToast(`Archived ${result.archivedCount || 0} SSH key(s). You can now generate a fresh key.`, 7000, 'success');
}


function getModalSelectedServer() {
  return state.settings?.servers?.find((server) => server.id === state.editingServerId) || null;
}

function renderConnectionManageList() {
  const list = $('#manage-connection-list');

  if (!list || !state.settings) {
    return;
  }

  list.innerHTML = '';

  const servers = Array.isArray(state.settings.servers) ? state.settings.servers : [];

  if (!servers.length) {
    const empty = document.createElement('div');
    empty.className = 'manage-connection-empty';
    empty.textContent = 'No connections saved.';
    list.appendChild(empty);
    return;
  }

  servers.forEach((server) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `manage-connection-item ${server.id === state.editingServerId ? 'active' : ''}`;
    item.innerHTML = `
      <span class="manage-connection-name"></span>
      <span class="manage-connection-meta"></span>
    `;

    item.querySelector('.manage-connection-name').textContent = server.name || 'Unnamed Connection';
    const group = getServerGroup(server);
    item.querySelector('.manage-connection-meta').textContent = server.type === 'local'
      ? `${group} · Local Terminal${server.workingDirectory ? ` · ${server.workingDirectory}` : ''}`
      : `${group} · SSH · ${server.username || 'user'}@${server.host || 'host'}:${server.port || 22}`;

    item.addEventListener('click', () => {
      populateConnectionModalFromServer(server);
    });

    list.appendChild(item);
  });
}

function clearConnectionModalForm(defaultType = 'remote') {
  const type = defaultType === 'local' ? 'local' : 'remote';

  state.editingServerId = null;

  $('#add-connection-type').value = type;
  $('#add-connection-name').value = type === 'local' ? 'Local Terminal' : 'Advance Terminal';
  $('#add-connection-group').value = type === 'local' ? 'Local' : 'Ungrouped';
  updateConnectionGroupDatalist();
  populateLocalProfileDropdown('');
  $('#add-connection-host').value = '';
  $('#add-connection-port').value = 22;
  $('#add-connection-username').value = '';
  $('#add-connection-auth-type').value = type === 'remote' ? '' : 'password';
  $('#add-connection-password').value = '';
  $('#add-connection-password').placeholder = 'SSH password';
  $('#add-connection-save-password').checked = false;
  $('#add-connection-private-key-path').value = '';
  populatePrivateKeyDropdown('');
  $('#add-connection-passphrase').value = '';
  $('#add-connection-passphrase').placeholder = 'Private-key passphrase';
  $('#add-connection-save-passphrase').checked = false;
  $('#add-connection-start-folder').value = '';
  $('#add-connection-keep-alive').checked = true;
  $('#add-connection-auto-reconnect').checked = false;
  $('#add-connection-reconnect-attempts').value = 3;
  $('#add-connection-reconnect-delay').value = 5;

  updateAddConnectionFormVisibility();
  renderConnectionManageList();
}

function populateConnectionModalFromServer(server) {
  if (!server) {
    clearConnectionModalForm('remote');
    return;
  }

  state.editingServerId = server.id;

  const type = server.type === 'local' ? 'local' : 'remote';

  $('#add-connection-type').value = type;
  $('#add-connection-name').value = server.name || (type === 'local' ? 'Local Terminal' : 'SSH Connection');
  $('#add-connection-group').value = getServerGroup(server);
  updateConnectionGroupDatalist();
  populateLocalProfileDropdown(server.profileId || '');
  $('#add-connection-host').value = server.host || '';
  $('#add-connection-port').value = server.port || 22;
  $('#add-connection-username').value = server.username || '';
  $('#add-connection-auth-type').value = server.authTypeConfigured === false
    ? ''
    : (server.authType === 'key' ? 'key' : 'password');
  $('#add-connection-password').value = '';
  $('#add-connection-password').placeholder = server.savePassword
    ? 'Saved securely - leave blank to keep'
    : 'SSH password';
  $('#add-connection-save-password').checked = server.authType === 'password'
    ? Boolean(server.savePassword || server.password)
    : false;
  $('#add-connection-private-key-path').value = server.privateKeyPath || '';
  populatePrivateKeyDropdown(server.privateKeyPath || '');
  $('#add-connection-passphrase').value = '';
  $('#add-connection-passphrase').placeholder = server.savePassphrase
    ? 'Saved securely - leave blank to keep'
    : 'Private-key passphrase';
  $('#add-connection-save-passphrase').checked = Boolean(server.savePassphrase || server.passphrase);
  $('#add-connection-start-folder').value = server.workingDirectory || '';

  const reliability = getConnectionReliability(server);
  $('#add-connection-keep-alive').checked = reliability.keepAlive;
  $('#add-connection-auto-reconnect').checked = reliability.autoReconnect;
  $('#add-connection-reconnect-attempts').value = reliability.reconnectAttempts;
  $('#add-connection-reconnect-delay').value = reliability.reconnectDelay;

  updateAddConnectionFormVisibility();
  renderConnectionManageList();
}

function openAddConnectionModal(defaultType = 'remote', forceNew = false) {
  const modal = $('#add-connection-modal');

  if (!modal) {
    return;
  }

  const servers = Array.isArray(state.settings?.servers) ? state.settings.servers : [];
  const selected = servers.find((server) => server.id === state.selectedServerId);

  modal.classList.remove('hidden');

  if (!forceNew && selected) {
    populateConnectionModalFromServer(selected);
  } else {
    clearConnectionModalForm(defaultType === 'local' ? 'local' : 'remote');
  }

  refreshSshKeys({
    silent: true,
    selectedPath: $('#add-connection-private-key-path')?.value || ''
  });

  $('#add-connection-name').focus();
  $('#add-connection-name').select();
}

function closeAddConnectionModal() {
  $('#add-connection-modal')?.classList.add('hidden');
}

function getConnectionFromModal() {
  const type = $('#add-connection-type').value === 'local' ? 'local' : 'remote';
  const name = $('#add-connection-name').value.trim();
  const startFolder = $('#add-connection-start-folder').value.trim();
  const group = normalizeConnectionGroupName($('#add-connection-group')?.value || '', type);

  const server = {
    id: state.editingServerId || randomId('server'),
    type,
    name: name || (type === 'local' ? 'Local Terminal' : 'SSH Connection'),
    description: type === 'local' ? 'Local Terminal' : 'Remote SSH',
    group,
    workingDirectory: startFolder
  };
  const existingServer = Array.isArray(state.settings?.servers)
    ? state.settings.servers.find((item) => item.id === server.id)
    : null;

  if (type === 'local') {
    server.shell = '';
    server.profileId = String($('#add-connection-profile')?.value || getDefaultTerminalProfileId() || '');
    return server;
  }

  const host = $('#add-connection-host').value.trim();
  const port = Number($('#add-connection-port').value || 22);
  const username = $('#add-connection-username').value.trim();
  const authType = String($('#add-connection-auth-type').value || '').trim().toLowerCase();
  const password = $('#add-connection-password').value;
  const savePassword = $('#add-connection-save-password').checked;
  const privateKeyPath = $('#add-connection-private-key-path').value.trim();
  const passphrase = $('#add-connection-passphrase').value;
  const savePassphrase = $('#add-connection-save-passphrase').checked;
  const keepAlive = $('#add-connection-keep-alive').checked;
  const autoReconnect = $('#add-connection-auto-reconnect').checked;
  const reconnectAttempts = clampInteger($('#add-connection-reconnect-attempts').value, 3, 1, 20);
  const reconnectDelay = clampInteger($('#add-connection-reconnect-delay').value, 5, 1, 300);

  if (!host) {
    showToast('Host/IP is required for SSH.');
    $('#add-connection-host').focus();
    return null;
  }

  if (!username) {
    showToast('SSH Username is required.');
    $('#add-connection-username').focus();
    return null;
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    showToast('Port must be between 1 and 65535.');
    $('#add-connection-port').focus();
    return null;
  }

  if (!['password', 'key'].includes(authType)) {
    showToast('Select Password or Private Key authentication.', 7000, 'error');
    $('#add-connection-auth-type').focus();
    return null;
  }

  if (authType === 'key' && !privateKeyPath) {
    showToast('Private Key Path is required for private-key login.');
    $('#add-connection-private-key-path').focus();
    return null;
  }

  server.host = host;
  server.port = port;
  server.username = username;
  server.authType = authType;
  server.authTypeConfigured = true;
  server.privateKeyPath = authType === 'key' ? privateKeyPath : '';
  server.password = authType === 'password' && savePassword && password ? password : '';
  server.savePassword = authType === 'password'
    ? Boolean(savePassword && (password || existingServer?.savePassword))
    : false;
  server.passphrase = authType === 'key' && savePassphrase && passphrase ? passphrase : '';
  server.savePassphrase = authType === 'key'
    ? Boolean(savePassphrase && (passphrase || existingServer?.savePassphrase))
    : false;
  server.keepAlive = type === 'remote' ? keepAlive : false;
  server.autoReconnect = type === 'remote' ? autoReconnect : false;
  server.reconnectAttempts = type === 'remote' ? reconnectAttempts : 3;
  server.reconnectDelay = type === 'remote' ? reconnectDelay : 5;

  return server;
}

async function saveConnectionFromModal() {
  const server = getConnectionFromModal();

  if (!server) {
    return;
  }

  if (!Array.isArray(state.settings.servers)) {
    state.settings.servers = [];
  }

  const index = state.settings.servers.findIndex((item) => item.id === server.id);
  const isEdit = index >= 0;
  const confirmed = await showConfirmDialog({
    title: isEdit ? 'Do you want to save edit?' : 'Do you want to save?',
    message: isEdit
      ? `Save changes to "${server.name}"?`
      : `Save new connection "${server.name}"?`,
    confirmLabel: isEdit ? 'Save Edit' : 'Save'
  });

  if (!confirmed) {
    return;
  }

  if (isEdit) {
    state.settings.servers[index] = server;
  } else {
    state.settings.servers.push(server);
  }

  state.selectedServerId = server.id;
  state.settings.selectedServerId = server.id;
  state.settings = await window.advanceTerminal.saveSettings(state.settings);
  state.selectedServerId = server.id;
  state.editingServerId = server.id;

  setLeftTab('connections');
  updateConnectionGroupDatalist();
  renderConnectionManageList();
  renderServerList();
  selectServer(server.id);
  showToast(`Connection "${server.name}" saved.`);
}

async function duplicateConnectionFromModal() {
  const source = getModalSelectedServer();

  if (!source) {
    showToast('Select a connection to duplicate.');
    return;
  }

  const copy = {
    ...source,
    id: randomId('server')
  };

  state.settings.servers.push(copy);
  state.selectedServerId = copy.id;
  state.settings.selectedServerId = copy.id;
  state.settings = await window.advanceTerminal.saveSettings(state.settings);
  state.selectedServerId = copy.id;
  state.editingServerId = copy.id;

  populateConnectionModalFromServer(copy);
  setLeftTab('connections');
  updateConnectionGroupDatalist();
  renderConnectionManageList();
  renderServerList();
  selectServer(copy.id);
  showToast(`Duplicated "${copy.name}". Duplicate names are allowed.`);
}

async function deleteConnectionFromModal() {
  const server = getModalSelectedServer();

  if (!server) {
    showToast('Select a connection to delete.');
    return;
  }

  if (state.settings.servers.length <= 1) {
    showToast('At least one connection is required.');
    return;
  }

  const confirmed = confirm(`Delete connection "${server.name || 'selected connection'}"?`);

  if (!confirmed) {
    return;
  }

  state.settings.servers = state.settings.servers.filter((item) => item.id !== server.id);
  state.selectedServerId = state.settings.servers[0]?.id || null;
  state.settings.selectedServerId = state.selectedServerId;
  state.settings = await window.advanceTerminal.saveSettings(state.settings);
  state.editingServerId = state.selectedServerId;

  const next = state.settings.servers.find((item) => item.id === state.selectedServerId);
  if (next) {
    populateConnectionModalFromServer(next);
    selectServer(next.id);
  } else {
    clearConnectionModalForm('remote');
  }

  updateConnectionGroupDatalist();
  renderConnectionManageList();
  renderServerList();
  showToast('Connection deleted.');
}


async function generateKey() {
  const keyName = $('#key-name').value.trim() || 'advance-terminal';
  const passphrase = $('#key-passphrase').value;

  try {
    const result = await window.advanceTerminal.generateSshKey({ keyName, passphrase });

    $('#key-result').classList.remove('hidden');
    $('#generated-public-key').value = result.publicKey;
    $('#generated-private-path').value = result.privateKeyPath;
    $('#generated-fingerprint').value = result.fingerprint;

    await refreshSshKeys({
      silent: true,
      selectedPath: result.privateKeyPath
    });

    if ($('#add-connection-private-key-path')) {
      $('#add-connection-private-key-path').value = result.privateKeyPath;
      $('#add-connection-auth-type').value = 'key';
      updateAddConnectionFormVisibility();
    }

    state.settings = await window.advanceTerminal.getSettings();
    renderAuditLog();
    showToast('SSH key generated. Copy the public key and add it to your hosting SSH Keys.', 7000, 'success');
  } catch (error) {
    showToast(error.message, 7000);
  }
}

function renderSettings() {
  if (!state.selectedServerId && state.settings.servers.length) {
    state.selectedServerId = state.settings.servers[0].id;
  }

  if (state.activeSettingsTab === 'servers' || state.activeSettingsTab === 'appearance' || state.activeSettingsTab === 'reports' || state.activeSettingsTab === 'audit' || state.activeSettingsTab === 'about') {
    state.activeSettingsTab = 'safety';
  }

  setSettingsTab(state.activeSettingsTab || 'safety');
  updateNotificationPositionControls(getNotificationPosition());
  renderReportOptionsSettings();
  updateAiSettingsControls();
  renderTerminalToolbarActions();
  updateAboutInfo();
}

function renderAuditLog() {
  const list = $('#audit-list');
  const rows = (state.settings.auditLog || []).slice().reverse();

  list.innerHTML = '';

  if (!rows.length) {
    list.innerHTML = '<div class="audit-row"><div class="audit-message">No audit events yet.</div></div>';
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement('div');
    item.className = 'audit-row';
    item.innerHTML = `
      <div class="audit-action"></div>
      <div class="audit-message"></div>
      <div class="audit-time"></div>
    `;

    item.querySelector('.audit-action').textContent = row.action;
    item.querySelector('.audit-message').textContent = row.message;
    item.querySelector('.audit-time').textContent = new Date(row.createdAt).toLocaleString();

    list.appendChild(item);
  });
}


function getUpdateStatusLabel(status) {
  const labels = {
    idle: 'Idle',
    checking: 'Checking',
    available: 'Available',
    downloading: 'Downloading',
    downloaded: 'Ready',
    installing: 'Installing',
    current: 'Up to date',
    unavailable: 'Unavailable',
    error: 'Error'
  };

  return labels[String(status || 'idle')] || 'Update';
}

function updateUpdaterUi(payload = state.updateStatus) {
  const status = payload || {};
  const statusName = String(status.status || 'idle');
  const pill = $('#update-status-pill');
  const message = $('#update-status-message');
  const currentVersion = $('#update-current-version');
  const progressWrap = $('#update-progress-wrap');
  const progressBar = $('#update-progress-bar');
  const installButton = $('#install-update-button');
  const checkButton = $('#check-updates-button');

  if (currentVersion) {
    currentVersion.textContent = status.currentVersion || state.appInfo?.version || state.appInfo?.displayVersion || 'Advance Terminal V6';
  }

  if (message) {
    message.textContent = status.message || 'Update checker is idle.';
  }

  if (pill) {
    pill.textContent = getUpdateStatusLabel(statusName);
    pill.className = `update-status-pill update-status-${statusName}`;
  }

  const progress = Number(status.progressPercent || 0);
  const showProgress = statusName === 'downloading' || statusName === 'downloaded';

  if (progressWrap) {
    progressWrap.classList.toggle('hidden', !showProgress);
    progressWrap.setAttribute('aria-hidden', showProgress ? 'false' : 'true');
  }

  if (progressBar) {
    progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }

  if (installButton) {
    const hasDownloadedUpdate = statusName === 'downloaded' && status.downloaded;
    const hasManualDownload = statusName === 'available' && Boolean(status.manualDownloadUrl);

    installButton.classList.toggle('hidden', !hasDownloadedUpdate && !hasManualDownload);
    installButton.textContent = hasManualDownload && !hasDownloadedUpdate
      ? 'Download Installer'
      : 'Install and Restart';
  }

  if (checkButton) {
    checkButton.disabled = statusName === 'checking' || statusName === 'downloading' || statusName === 'installing';
  }
}

function handleUpdateStatus(payload) {
  state.updateStatus = payload || {};
  updateUpdaterUi(state.updateStatus);

  if (state.updateStatus.message) {
    const level = state.updateStatus.ok === false || state.updateStatus.status === 'error'
      ? 'warning'
      : 'action';

    appendActivityFeedEvent(`Update: ${state.updateStatus.message}`, level, { dedupeMs: 2500 });
  }
}

async function refreshUpdateStatus() {
  if (!window.advanceTerminal.getUpdateStatus) {
    return;
  }

  try {
    handleUpdateStatus(await window.advanceTerminal.getUpdateStatus());
  } catch (error) {
    handleUpdateStatus({
      ok: false,
      status: 'error',
      message: `Could not read update status: ${error.message}`
    });
  }
}

async function checkForAppUpdates() {
  if (!window.advanceTerminal.checkForUpdates) {
    showToast('Update checker is not available in this build.', 5000, 'warning');
    return;
  }

  try {
    handleUpdateStatus({
      ok: true,
      status: 'checking',
      message: 'Manual update check started...',
      currentVersion: state.appInfo?.version || null
    });

    const result = await window.advanceTerminal.checkForUpdates({ manual: true });
    handleUpdateStatus(result);
  } catch (error) {
    handleUpdateStatus({
      ok: false,
      status: 'error',
      message: `Update check failed: ${error.message}`
    });
    showToast(`Update check failed: ${error.message}`, 7000, 'error');
  }
}

async function installDownloadedUpdate() {
  if (!window.advanceTerminal.installUpdateAndRestart) {
    showToast('Update installer is not available in this build.', 5000, 'warning');
    return;
  }

  try {
    const result = await window.advanceTerminal.installUpdateAndRestart();
    handleUpdateStatus(result);
  } catch (error) {
    handleUpdateStatus({
      ok: false,
      status: 'error',
      message: `Could not install update: ${error.message}`
    });
    showToast(`Could not install update: ${error.message}`, 7000, 'error');
  }
}

function updateAboutInfo() {
  if (!state.appInfo) {
    return;
  }

  const settingsPath = $('#about-settings-path');
  const userDataPath = $('#about-userdata-path');

  if (settingsPath) {
    settingsPath.textContent = state.appInfo.settingsFilePath;
  }

  if (userDataPath) {
    userDataPath.textContent = state.appInfo.userDataPath;
  }

  const displayVersion = state.appInfo.displayVersion || 'Advance Terminal V6';
  const developer = state.appInfo.developer || 'Artlie Digital';
  const website = state.appInfo.website || 'www.artliedigital.com';

  if ($('#about-version')) {
    $('#about-version').textContent = displayVersion;
  }

  if ($('#about-help-version')) {
    $('#about-help-version').textContent = displayVersion;
  }

  if ($('#about-developer')) {
    $('#about-developer').textContent = developer;
  }

  if ($('#about-website')) {
    $('#about-website').textContent = website;
  }

  if ($('#about-help-developer')) {
    $('#about-help-developer').textContent = developer;
  }

  if ($('#about-help-website')) {
    $('#about-help-website').textContent = website;
  }
}


function getCurrentTabLabel() {
  const group = getTerminalGroup(state.activeTerminalGroupId);
  const customTitle = normalizeTerminalTabTitle(group?.title);

  if (customTitle) {
    return customTitle;
  }

  const session = state.terminals.get(state.activeTerminalId);

  if (session?.server?.name) {
    return session.server.name;
  }

  return 'No active tab';
}

function updateCurrentTabFooter() {
  const currentTab = $('#runtime-current-tab');

  if (!currentTab) {
    return;
  }

  const label = getCurrentTabLabel();
  currentTab.textContent = label;
  currentTab.title = label;
}

function setRuntimeFooterOffline() {
  const uptime = $('#runtime-uptime');
  const memory = $('#runtime-memory');

  if (uptime) {
    uptime.textContent = 'Offline';
  }

  if (memory) {
    memory.textContent = '—';
  }

  updateCurrentTabFooter();
}

function updateRuntimeFooter(stats) {
  if (!stats) {
    return;
  }

  const uptime = $('#runtime-uptime');
  const memory = $('#runtime-memory');

  if (uptime) {
    uptime.textContent = formatRuntimeDuration(stats.uptimeSeconds);
  }

  if (memory) {
    memory.textContent = formatRuntimeMemory(stats.memoryRssBytes);
  }

  updateCurrentTabFooter();
}

async function refreshRuntimeFooter() {
  try {
    if (!window.advanceTerminal.getRuntimeStats) {
      updateRuntimeFooter({
        uptimeSeconds: 0,
        memoryRssBytes: 0
      });
      return;
    }

    const stats = await window.advanceTerminal.getRuntimeStats();
    updateRuntimeFooter(stats);
  } catch (error) {
    setRuntimeFooterOffline();
  }
}

function startRuntimeFooter() {
  refreshRuntimeFooter();

  if (state.runtimeStatsTimer) {
    clearInterval(state.runtimeStatsTimer);
  }

  state.runtimeStatsTimer = setInterval(refreshRuntimeFooter, 1000);
}



function getCommandPaletteRecentIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMMAND_PALETTE_RECENTS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.map((value) => String(value || '').trim()).filter(Boolean).slice(0, COMMAND_PALETTE_MAX_RECENTS)
      : [];
  } catch (_) {
    return [];
  }
}

function rememberCommandPaletteEntry(entryId) {
  const normalizedId = String(entryId || '').trim();

  if (!normalizedId) {
    return;
  }

  const next = [
    normalizedId,
    ...getCommandPaletteRecentIds().filter((id) => id !== normalizedId)
  ].slice(0, COMMAND_PALETTE_MAX_RECENTS);

  try {
    localStorage.setItem(COMMAND_PALETTE_RECENTS_STORAGE_KEY, JSON.stringify(next));
  } catch (_) {
    // Command Palette history is optional and must never block an action.
  }
}

function commandPaletteText(value, maxLength = 180) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function commandPaletteEntrySearchText(entry) {
  return [
    entry.title,
    entry.subtitle,
    entry.category,
    entry.keywords,
    entry.shortcut
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

function commandPaletteSubsequenceScore(query, text) {
  let queryIndex = 0;
  let firstMatch = -1;
  let lastMatch = -1;

  for (let textIndex = 0; textIndex < text.length && queryIndex < query.length; textIndex += 1) {
    if (text[textIndex] !== query[queryIndex]) {
      continue;
    }

    if (firstMatch < 0) {
      firstMatch = textIndex;
    }

    lastMatch = textIndex;
    queryIndex += 1;
  }

  if (queryIndex !== query.length) {
    return null;
  }

  const span = lastMatch - firstMatch + 1;
  return 180 - Math.min(120, firstMatch) - Math.min(50, Math.max(0, span - query.length));
}

function scoreCommandPaletteEntry(entry, rawQuery) {
  const query = String(rawQuery || '').trim().toLocaleLowerCase();

  if (!query) {
    return 0;
  }

  const title = String(entry.title || '').toLocaleLowerCase();
  const category = String(entry.category || '').toLocaleLowerCase();
  const haystack = commandPaletteEntrySearchText(entry);
  const tokens = query.split(/\s+/).filter(Boolean);

  if (!tokens.every((token) => haystack.includes(token))) {
    const compactQuery = query.replace(/\s+/g, '');

    if (!compactQuery) {
      return null;
    }

    const subsequence = commandPaletteSubsequenceScore(compactQuery, haystack.replace(/\s+/g, ''));

    if (subsequence === null) {
      return null;
    }

    return subsequence;
  }

  let score = 300;

  if (title === query) {
    score += 900;
  } else if (title.startsWith(query)) {
    score += 650;
  } else if (title.includes(query)) {
    score += 450;
  }

  if (category === query || category.startsWith(query)) {
    score += 180;
  }

  tokens.forEach((token) => {
    const titleIndex = title.indexOf(token);
    const haystackIndex = haystack.indexOf(token);

    if (titleIndex === 0) {
      score += 120;
    } else if (titleIndex > 0) {
      score += Math.max(20, 85 - Math.min(65, titleIndex));
    } else if (haystackIndex >= 0) {
      score += Math.max(5, 35 - Math.min(30, haystackIndex));
    }
  });

  return score;
}

function openPaletteSettingsTab(tab) {
  setActiveView('settings', 'settings');
  setSettingsTab(tab);
}

function openPaletteHelpTab(tab) {
  setActiveView('about', 'help');
  setHelpTab(tab);
}

function buildCommandPaletteEntries() {
  const entries = [];
  const add = (entry) => {
    if (!entry?.id || !entry?.title || typeof entry.run !== 'function') {
      return;
    }

    entries.push({
      icon: '⌘',
      category: 'Action',
      subtitle: '',
      keywords: '',
      shortcut: '',
      ...entry,
      id: String(entry.id),
      title: String(entry.title),
      category: String(entry.category || 'Action')
    });
  };

  add({
    id: 'navigation:terminal',
    icon: '>_',
    category: 'Navigation',
    title: 'Go to Terminal',
    subtitle: 'Open the main terminal workspace.',
    keywords: 'home console shell',
    run: () => setActiveView('terminal', 'terminal')
  });

  add({
    id: 'navigation:connections',
    icon: 'PC',
    category: 'Navigation',
    title: 'Show Connections',
    subtitle: 'Open the Terminal view and show saved Local / SSH connections.',
    keywords: 'servers sidebar local ssh',
    run: () => {
      setActiveView('terminal', 'terminal');
      setLeftTab('connections');
      setConnectionsPanelCollapsed(false);
    }
  });

  add({
    id: 'navigation:commands',
    icon: 'CMD',
    category: 'Navigation',
    title: 'Show Saved Commands',
    subtitle: 'Open the command shortcuts panel.',
    keywords: 'shortcuts scripts saved commands sidebar',
    run: () => {
      setActiveView('terminal', 'terminal');
      setLeftTab('commands');
      setConnectionsPanelCollapsed(false);
    }
  });

  add({
    id: 'connection:new-ssh',
    icon: 'SSH',
    category: 'Connection',
    title: 'New SSH Connection',
    subtitle: 'Create a new saved SSH connection.',
    keywords: 'remote server add connection',
    run: () => openAddConnectionModal('remote', true)
  });

  add({
    id: 'connection:new-local',
    icon: 'LOC',
    category: 'Connection',
    title: 'New Local Connection',
    subtitle: 'Create a new saved local terminal connection.',
    keywords: 'shell powershell cmd add connection',
    run: () => openAddConnectionModal('local', true)
  });

  add({
    id: 'commands:manage',
    icon: 'CMD',
    category: 'Commands',
    title: 'Manage Saved Commands',
    subtitle: 'Create, edit, duplicate, or delete command shortcuts.',
    keywords: 'command manager shortcuts scripts',
    run: () => openCommandManagerModal()
  });

  add({
    id: 'terminal:find',
    icon: '⌕',
    category: 'Terminal',
    title: 'Find in Active Terminal',
    subtitle: 'Search output in the currently active terminal.',
    keywords: 'search output buffer find',
    shortcut: 'Ctrl+F',
    run: () => {
      setActiveView('terminal', 'terminal');
      openTerminalSearch();
    }
  });

  add({
    id: 'terminal:split-right',
    icon: '▦',
    category: 'Terminal',
    title: 'Split Terminal Right',
    subtitle: 'Choose a profile or connection for a new pane to the right of the active terminal.',
    keywords: 'split pane right side by side terminal profile ssh local',
    run: () => {
      setActiveView('terminal', 'terminal');
      requestAnimationFrame(() => {
        const button = $('#terminal-tab-split-button');
        if (button) showTerminalSplitPicker(button, 'row');
        else showToast('Open a terminal first before creating a split.', 3500, 'warning');
      });
    }
  });

  add({
    id: 'terminal:split-down',
    icon: '▤',
    category: 'Terminal',
    title: 'Split Terminal Down',
    subtitle: 'Choose a profile or connection for a new pane below the active terminal.',
    keywords: 'split pane down below horizontal terminal profile ssh local',
    run: () => {
      setActiveView('terminal', 'terminal');
      requestAnimationFrame(() => {
        const button = $('#terminal-tab-split-button');
        if (button) showTerminalSplitPicker(button, 'column');
        else showToast('Open a terminal first before creating a split.', 3500, 'warning');
      });
    }
  });

  add({
    id: 'terminal:focus-next-pane',
    icon: '→',
    category: 'Terminal',
    title: 'Focus Next Split Pane',
    subtitle: 'Move keyboard focus to the next terminal pane in the active tab.',
    keywords: 'split pane next focus terminal',
    run: () => focusNextSplitPane()
  });

  add({
    id: 'terminal:swap-next-pane',
    icon: '⇄',
    category: 'Terminal',
    title: 'Swap Active Pane With Next',
    subtitle: 'Move the active terminal session to the next pane position.',
    keywords: 'split pane move swap reorder terminal',
    run: () => swapActiveSplitPaneWithNext()
  });

  add({
    id: 'view:activity-feed',
    icon: 'LOG',
    category: 'View',
    title: 'Toggle Activity Feed',
    subtitle: 'Open or close the Activity Feed.',
    keywords: 'logs events console activity dock',
    run: () => toggleLiveConsole()
  });

  add({
    id: 'view:appearance',
    icon: 'UI',
    category: 'View',
    title: 'Open Appearance',
    subtitle: 'Open View and appearance controls.',
    keywords: 'theme dark light notifications interface',
    run: () => setActiveView('view', 'view')
  });

  [
    ['safety', 'Terminal Safety', 'Paste protection, busy-action locking, SSH folder lock and Administrator controls.', 'SAFE'],
    ['restore', 'Restore Points', 'View and restore safe local settings snapshots.', '↶'],
    ['workspaces', 'Workspaces', 'Save and restore terminal tabs, split panes, folders, toolbar layout and window placement.', 'WS'],
    ['terminal-profiles', 'Terminal Profiles', 'Manage PowerShell, CMD, Git Bash, WSL and custom local shell profiles.', '>_'],
    ['terminal-actions', 'Terminal Actions', 'Manage the customizable terminal action toolbar.', 'ACT'],
    ['ai', 'AI Settings', 'Configure AI-assisted report settings.', 'AI'],
    ['keys', 'SSH Keys', 'Manage SSH keys and key locations.', 'KEY'],
    ['updates', 'Updates', 'Check for Advance Terminal updates.', 'UP']
  ].forEach(([tab, title, subtitle, icon]) => {
    add({
      id: `settings:${tab}`,
      icon,
      category: 'Settings',
      title: `Open ${title}`,
      subtitle,
      keywords: `settings ${title}`,
      run: () => openPaletteSettingsTab(tab)
    });
  });

  add({
    id: 'workspace:save-current',
    icon: 'WS',
    category: 'Workspace',
    title: state.activeWorkspaceId && getWorkspaceById(state.activeWorkspaceId)
      ? `Update Workspace: ${getWorkspaceById(state.activeWorkspaceId).name}`
      : 'Save Current Workspace',
    subtitle: 'Capture the current terminal tabs, working folders, toolbar layout and window placement.',
    keywords: 'workspace save capture layout tabs folders toolbar window',
    run: () => saveCurrentWorkspaceQuick()
  });

  getWorkspaces().forEach((workspace) => {
    const missing = (workspace.sessions || []).filter((item) => !workspaceSessionTarget(item)).length;

    add({
      id: `workspace:${workspace.id}`,
      icon: 'WS',
      category: 'Workspace',
      title: `Open Workspace: ${workspace.name}`,
      subtitle: commandPaletteText([
        `${workspaceSavedTabCount(workspace)} saved tab${workspaceSavedTabCount(workspace) === 1 ? '' : 's'} · ${workspaceSavedPaneCount(workspace)} pane${workspaceSavedPaneCount(workspace) === 1 ? '' : 's'}`,
        state.settings?.startupWorkspaceId === workspace.id ? 'Startup workspace' : '',
        missing ? `${missing} missing target${missing === 1 ? '' : 's'}` : ''
      ].filter(Boolean).join(' · ')),
      keywords: `workspace restore open layout ${workspace.name}`,
      run: () => restoreWorkspace(workspace.id)
    });
  });

  add({
    id: 'windows:restart-admin',
    icon: 'UAC',
    category: 'Windows',
    title: state.appInfo?.isElevated ? 'Running as Administrator' : 'Restart as Administrator',
    subtitle: state.appInfo?.isElevated
      ? 'Advance Terminal is already elevated.'
      : 'Restart Advance Terminal elevated using the standard Windows UAC prompt.',
    keywords: 'admin administrator elevated privilege uac windows',
    run: () => restartAdvanceTerminalAsAdministrator()
  });

  add({
    id: 'report:open',
    icon: 'REP',
    category: 'Navigation',
    title: 'Open Reports',
    subtitle: 'Open activity report options and history.',
    keywords: 'reports audit work activity history',
    run: () => setActiveView('report', 'report')
  });

  add({
    id: 'help:quick-start',
    icon: '?',
    category: 'Help',
    title: 'Open Quick Start',
    subtitle: 'Open the built-in Advance Terminal quick-start guide.',
    keywords: 'help guide documentation getting started',
    run: () => openPaletteHelpTab('quick-start')
  });

  add({
    id: 'help:about',
    icon: 'i',
    category: 'Help',
    title: 'About Advance Terminal',
    subtitle: 'Open version and application information.',
    keywords: 'help version about info',
    run: () => openPaletteHelpTab('about')
  });


  const activeTabGroup = getTerminalGroup(state.activeTerminalGroupId);

  if (activeTabGroup) {
    add({
      id: 'tab:rename-active',
      icon: 'TAB',
      category: 'Tab',
      title: 'Rename Active Tab',
      subtitle: `Current tab: ${getTerminalGroupDisplayTitle(activeTabGroup)}`,
      keywords: 'tab rename title label',
      run: () => openTerminalTabRenameModal(activeTabGroup.id)
    });

    add({
      id: 'tab:pin-active',
      icon: 'PIN',
      category: 'Tab',
      title: activeTabGroup.pinned ? 'Unpin Active Tab' : 'Pin Active Tab',
      subtitle: activeTabGroup.pinned
        ? 'Allow the active tab to be closed or moved with normal tabs.'
        : 'Keep the active tab protected and grouped with pinned tabs.',
      keywords: 'tab pin unpin protect',
      run: () => setTerminalGroupPinned(activeTabGroup.id, !activeTabGroup.pinned)
    });

    add({
      id: 'tab:duplicate-active',
      icon: 'TAB',
      category: 'Tab',
      title: 'Duplicate Active Tab',
      subtitle: 'Open a new copy of this tab, including its split-pane layout.',
      keywords: 'tab duplicate clone copy split',
      run: () => duplicateTerminalGroup(activeTabGroup.id)
    });

    add({
      id: 'tab:close-others',
      icon: '×',
      category: 'Tab',
      title: 'Close Other Tabs',
      subtitle: 'Close all unpinned tabs except the active tab.',
      keywords: 'tab close others',
      run: () => closeOtherTerminalGroups(activeTabGroup.id)
    });

    add({
      id: 'tab:close-right',
      icon: '×',
      category: 'Tab',
      title: 'Close Tabs to the Right',
      subtitle: 'Close unpinned tabs positioned to the right of the active tab.',
      keywords: 'tab close right',
      run: () => closeTerminalGroupsToRight(activeTabGroup.id)
    });
  }

  if (state.closedTerminalTabs?.length) {
    add({
      id: 'tab:reopen-closed',
      icon: '↶',
      category: 'Tab',
      title: 'Reopen Last Closed Tab',
      subtitle: 'Restore the most recently closed tab and its split-pane layout.',
      keywords: 'tab reopen restore closed undo',
      run: () => reopenLastClosedTerminalTab()
    });
  }

  getTerminalProfiles().forEach((profile) => {
    add({
      id: `profile:${profile.id}`,
      icon: commandPaletteText(profile.icon || '>_', 4) || '>_',
      category: 'Terminal Profile',
      title: `New Terminal: ${profile.name}`,
      subtitle: commandPaletteText([
        terminalProfileKindLabel(profile.kind),
        profile.executable,
        profile.workingDirectory ? `Start: ${profile.workingDirectory}` : ''
      ].filter(Boolean).join(' · ')),
      keywords: `profile shell ${profile.kind} ${profile.executable} ${profile.workingDirectory || ''}`,
      run: () => launchTerminalProfile(profile.id)
    });
  });

  sortConnectionsForDisplay([...(state.settings?.servers || [])]).forEach((server) => {
    const isLocal = server.type === 'local';

    add({
      id: `connection:${server.id}`,
      icon: isLocal ? 'LOC' : 'SSH',
      category: isLocal ? 'Local Connection' : 'SSH Connection',
      title: server.name || (isLocal ? 'Local Terminal' : 'SSH Connection'),
      subtitle: commandPaletteText(serverSubtitle(server)),
      keywords: [
        'connection',
        isLocal ? 'local terminal shell' : 'ssh remote server',
        server.host,
        server.username,
        server.group,
        server.description
      ].filter(Boolean).join(' '),
      run: () => openTerminalFromTabPicker(server)
    });
  });

  Array.from(state.terminals.values())
    .filter((session) => session && !session.closed)
    .forEach((session) => {
      const isActive = session.terminalId === state.activeTerminalId;
      const isLocal = session.server?.type === 'local';

      add({
        id: `tab:${session.terminalId}`,
        icon: 'TAB',
        category: 'Open Tab',
        title: session.server?.name || 'Terminal',
        subtitle: commandPaletteText([
          isActive ? 'Current tab' : 'Switch to open tab',
          isLocal ? 'Local' : 'SSH',
          session.status || ''
        ].filter(Boolean).join(' · ')),
        keywords: `tab terminal ${isLocal ? 'local' : 'ssh'} ${session.server?.host || ''}`,
        run: () => {
          setActiveView('terminal', 'terminal');
          activateTerminalAndFocus(session.terminalId);
        }
      });
    });

  getCommands().forEach((command) => {
    add({
      id: `command:${command.id}`,
      icon: 'CMD',
      category: 'Saved Command',
      title: command.name || 'Saved Command',
      subtitle: commandPaletteText(redactSecrets(command.command)),
      keywords: [
        'saved command shortcut run',
        command.category,
        command.description,
        redactSecrets(command.command)
      ].filter(Boolean).join(' '),
      run: () => sendCommandToActiveTerminal(command)
    });
  });

  getTerminalToolbarActions()
    .filter((action) => action.enabled !== false)
    .filter((action) => action.itemType !== 'separator')
    .filter((action) => terminalToolbarItemMatchesContext(action))
    .forEach((action) => {
      const normalized = normalizeTerminalToolbarAction(action);
      const shortcut = normalizeTerminalToolbarShortcut(normalized.shortcut);

      add({
        id: `terminal-action:${normalized.id}`,
        icon: commandPaletteText(normalized.customIcon || normalized.icon || 'ACT', 4) || 'ACT',
        category: 'Terminal Action',
        title: normalized.name || terminalActionKindLabel(normalized.action),
        subtitle: commandPaletteText([
          terminalActionKindLabel(normalized.action),
          shortcut,
          normalized.dropdown ? `Dropdown: ${normalized.dropdown}` : '',
          normalized.group ? `Group: ${normalized.group}` : '',
          redactSecrets(normalized.text || '')
        ].filter(Boolean).join(' · ')),
        keywords: `toolbar action ${normalized.action} ${shortcut} ${normalized.group} ${normalized.dropdown} ${redactSecrets(normalized.text || '')}`,
        run: () => executeTerminalToolbarAction(normalized)
      });
    });

  return entries;
}

function filterCommandPaletteEntries(query) {
  const recentIds = getCommandPaletteRecentIds();
  const recentRank = new Map(recentIds.map((id, index) => [id, index]));
  const trimmedQuery = String(query || '').trim();

  return state.commandPaletteEntries
    .map((entry) => ({
      entry,
      score: scoreCommandPaletteEntry(entry, trimmedQuery),
      recentIndex: recentRank.has(entry.id) ? recentRank.get(entry.id) : Number.POSITIVE_INFINITY
    }))
    .filter((item) => item.score !== null)
    .sort((left, right) => {
      if (!trimmedQuery && left.recentIndex !== right.recentIndex) {
        return left.recentIndex - right.recentIndex;
      }

      if (trimmedQuery && right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.recentIndex !== right.recentIndex) {
        return left.recentIndex - right.recentIndex;
      }

      const categoryCompare = left.entry.category.localeCompare(right.entry.category);

      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      return left.entry.title.localeCompare(right.entry.title);
    })
    .slice(0, COMMAND_PALETTE_MAX_RESULTS)
    .map((item) => ({
      ...item.entry,
      isRecent: Number.isFinite(item.recentIndex)
    }));
}

function setCommandPaletteSelectedIndex(index, { scroll = true } = {}) {
  const count = state.commandPaletteResults.length;

  if (!count) {
    state.commandPaletteSelectedIndex = 0;
    $('#command-palette-input')?.removeAttribute('aria-activedescendant');
    return;
  }

  const normalized = ((Number(index) || 0) % count + count) % count;
  state.commandPaletteSelectedIndex = normalized;

  $$('.command-palette-result').forEach((item, itemIndex) => {
    const selected = itemIndex === normalized;
    item.classList.toggle('selected', selected);
    item.setAttribute('aria-selected', selected ? 'true' : 'false');

    if (selected && scroll) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });

  const selectedItem = $$('.command-palette-result')[normalized];

  if (selectedItem?.id) {
    $('#command-palette-input')?.setAttribute('aria-activedescendant', selectedItem.id);
  }
}

function renderCommandPaletteResults() {
  const input = $('#command-palette-input');
  const results = $('#command-palette-results');
  const summary = $('#command-palette-summary');

  if (!input || !results) {
    return;
  }

  const query = input.value || '';
  state.commandPaletteResults = filterCommandPaletteEntries(query);

  if (state.commandPaletteSelectedIndex >= state.commandPaletteResults.length) {
    state.commandPaletteSelectedIndex = 0;
  }

  results.innerHTML = '';

  if (!state.commandPaletteResults.length) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.innerHTML = '<strong>No matching actions</strong><span>Try a command name, profile, connection, tab, or Settings page.</span>';
    results.appendChild(empty);

    if (summary) {
      summary.textContent = query.trim() ? `No results for “${commandPaletteText(query, 48)}”.` : 'No actions are currently available.';
    }

    input.removeAttribute('aria-activedescendant');
    return;
  }

  state.commandPaletteResults.forEach((entry, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.id = `command-palette-result-${index}`;
    item.className = 'command-palette-result';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', index === state.commandPaletteSelectedIndex ? 'true' : 'false');
    item.dataset.paletteIndex = String(index);

    const icon = document.createElement('span');
    icon.className = 'command-palette-result-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = commandPaletteText(entry.icon || '⌘', 4);

    const copy = document.createElement('span');
    copy.className = 'command-palette-result-copy';

    const titleRow = document.createElement('span');
    titleRow.className = 'command-palette-result-title-row';

    const title = document.createElement('strong');
    title.className = 'command-palette-result-title';
    title.textContent = entry.title;
    titleRow.appendChild(title);

    if (entry.isRecent) {
      const recent = document.createElement('span');
      recent.className = 'command-palette-recent';
      recent.textContent = 'Recent';
      titleRow.appendChild(recent);
    }

    const subtitle = document.createElement('span');
    subtitle.className = 'command-palette-result-subtitle';
    subtitle.textContent = entry.subtitle || entry.keywords || entry.category;

    copy.appendChild(titleRow);
    copy.appendChild(subtitle);

    const meta = document.createElement('span');
    meta.className = 'command-palette-result-meta';

    const category = document.createElement('span');
    category.className = 'command-palette-result-category';
    category.textContent = entry.category;
    meta.appendChild(category);

    if (entry.shortcut) {
      const shortcut = document.createElement('kbd');
      shortcut.textContent = entry.shortcut;
      meta.appendChild(shortcut);
    }

    item.appendChild(icon);
    item.appendChild(copy);
    item.appendChild(meta);

    item.addEventListener('mousemove', () => {
      if (state.commandPaletteSelectedIndex !== index) {
        setCommandPaletteSelectedIndex(index, { scroll: false });
      }
    });

    item.addEventListener('click', () => {
      runCommandPaletteEntry(entry).catch((error) => {
        showToast(`Command Palette action failed: ${error.message}`, 7000, 'error');
      });
    });

    results.appendChild(item);
  });

  if (summary) {
    const count = state.commandPaletteResults.length;
    summary.textContent = query.trim()
      ? `${count} result${count === 1 ? '' : 's'} for “${commandPaletteText(query, 48)}”.`
      : `${count} action${count === 1 ? '' : 's'} available · recent actions are shown first.`;
  }

  setCommandPaletteSelectedIndex(state.commandPaletteSelectedIndex, { scroll: false });
}

function refreshCommandPalette() {
  state.commandPaletteEntries = buildCommandPaletteEntries();
  state.commandPaletteSelectedIndex = 0;
  renderCommandPaletteResults();
}

function openCommandPalette(initialQuery = '') {
  const modal = $('#command-palette-modal');
  const input = $('#command-palette-input');

  if (!modal || !input) {
    return;
  }

  const blockingModal = Array.from(document.querySelectorAll('.modal:not(.hidden)'))
    .find((item) => item.id !== 'command-palette-modal');

  if (blockingModal) {
    showToast('Finish or close the current dialog before opening Command Palette.', 3500, 'warning');
    return;
  }

  closeQuickActionsMenu();
  closeTerminalProfileQuickMenu();
  closeWorkspaceQuickMenu();
  closeTerminalTabPicker();
  closeTerminalSplitPicker();

  state.commandPalettePreviousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  state.commandPaletteOpen = true;
  input.value = String(initialQuery || '');

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  refreshCommandPalette();

  appendActivityFeedEvent('Command Palette opened.', 'action', { dedupeMs: 800 });

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function closeCommandPalette({ restoreFocus = true } = {}) {
  const modal = $('#command-palette-modal');

  if (!modal || modal.classList.contains('hidden')) {
    state.commandPaletteOpen = false;
    return;
  }

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  state.commandPaletteOpen = false;
  state.commandPaletteResults = [];
  $('#command-palette-input')?.removeAttribute('aria-activedescendant');

  const previousFocus = state.commandPalettePreviousFocus;
  state.commandPalettePreviousFocus = null;

  if (!restoreFocus) {
    return;
  }

  requestAnimationFrame(() => {
    if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
      return;
    }

    const session = state.terminals.get(state.activeTerminalId);

    if (state.activeView === 'terminal' && session && !session.closed) {
      focusTerminal(session);
    }
  });
}

function toggleCommandPalette() {
  if (state.commandPaletteOpen) {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}

async function runCommandPaletteEntry(entry) {
  if (!entry || typeof entry.run !== 'function') {
    return;
  }

  rememberCommandPaletteEntry(entry.id);
  closeCommandPalette({ restoreFocus: false });
  appendActivityFeedEvent(`Command Palette: ${entry.title}.`, 'action', { dedupeMs: 500 });

  await Promise.resolve(entry.run());
}

function runSelectedCommandPaletteEntry() {
  const entry = state.commandPaletteResults[state.commandPaletteSelectedIndex];

  if (!entry) {
    return;
  }

  runCommandPaletteEntry(entry).catch((error) => {
    showToast(`Command Palette action failed: ${error.message}`, 7000, 'error');
  });
}

function handleCommandPaletteShortcut(event) {
  const isPaletteShortcut = (event.ctrlKey || event.metaKey)
    && event.shiftKey
    && !event.altKey
    && String(event.key || '').toLocaleLowerCase() === 'p';

  if (!isPaletteShortcut) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  toggleCommandPalette();
}

function handleCommandPaletteInputKeydown(event) {
  if (!state.commandPaletteOpen) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeCommandPalette();
    return;
  }

  if (!state.commandPaletteResults.length) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setCommandPaletteSelectedIndex(state.commandPaletteSelectedIndex + 1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    setCommandPaletteSelectedIndex(state.commandPaletteSelectedIndex - 1);
    return;
  }

  if (event.key === 'Home') {
    event.preventDefault();
    setCommandPaletteSelectedIndex(0);
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    setCommandPaletteSelectedIndex(state.commandPaletteResults.length - 1);
    return;
  }

  if (event.key === 'PageDown') {
    event.preventDefault();
    setCommandPaletteSelectedIndex(state.commandPaletteSelectedIndex + 8);
    return;
  }

  if (event.key === 'PageUp') {
    event.preventDefault();
    setCommandPaletteSelectedIndex(state.commandPaletteSelectedIndex - 8);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    runSelectedCommandPaletteEntry();
  }
}


function bindEvents() {
  document.addEventListener('keydown', handleCommandPaletteShortcut, true);
  document.addEventListener('keydown', handleTerminalSearchShortcut, true);
  document.addEventListener('keydown', handleTerminalToolbarShortcut, true);

  $('#tool-command-palette')?.addEventListener('click', toggleCommandPalette);
  $('#command-palette-close')?.addEventListener('click', () => closeCommandPalette());
  $('#command-palette-input')?.addEventListener('input', () => {
    state.commandPaletteSelectedIndex = 0;
    renderCommandPaletteResults();
  });
  $('#command-palette-input')?.addEventListener('keydown', handleCommandPaletteInputKeydown);
  $('#command-palette-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'command-palette-modal') {
      closeCommandPalette();
    }
  });
  $('#command-palette-modal')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.commandPaletteOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeCommandPalette();
    }
  });

  $('.about-logo-image')?.addEventListener('error', (event) => {
    event.currentTarget.classList.add('hidden');
  });

  $('#toast')?.addEventListener('click', dismissToast);
  $('#toast')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
      event.preventDefault();
      dismissToast();
    }
  });

  $('#terminal-search-input')?.addEventListener('input', () => {
    runTerminalSearch(0, { reset: true });
  });

  $('#terminal-search-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runTerminalSearch(event.shiftKey ? -1 : 1);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeTerminalSearch();
    }
  });

  $('#terminal-search-previous')?.addEventListener('click', () => {
    runTerminalSearch(-1);
  });

  $('#terminal-search-next')?.addEventListener('click', () => {
    runTerminalSearch(1);
  });

  $('#terminal-search-close')?.addEventListener('click', () => {
    closeTerminalSearch();
  });

  $$('.window-button').forEach((button) => {
    button.addEventListener('click', () => {
      window.advanceTerminal.windowAction(button.dataset.windowAction);
    });
  });

  $('#tool-open-terminal')?.addEventListener('click', () => {
    setActiveView('terminal', 'terminal');

    const session = state.terminals.get(state.activeTerminalId);

    requestAnimationFrame(() => {
      fitActiveTerminal();

      if (session && !session.closed) {
        focusTerminal(session);
      }
    });
  });

  $$('.menu-item').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.menuAction;

      if (action === 'terminal') {
        setActiveView('terminal', 'terminal');
        return;
      }

      if (action === 'view') {
        setActiveView('view', 'view');
        return;
      }

      if (action === 'settings') {
        setActiveView('settings', 'settings');
        return;
      }

      if (action === 'report') {
        setActiveView('report', 'report');
        return;
      }

      if (action === 'help') {
        setActiveView('about', 'help');
        return;
      }

      setActiveToolbarPanel('terminal');
    });
  });

  $('#server-search').addEventListener('input', renderServerList);
  $('#command-search').addEventListener('input', renderCommandList);

  $$('.connection-filter-button').forEach((button) => {
    button.addEventListener('click', () => setConnectionFilter(button.dataset.connectionFilter));
  });

  $('#connection-group-filter')?.addEventListener('change', (event) => {
    setConnectionGroupFilter(event.target.value);
  });

  $('#command-category-filter')?.addEventListener('change', (event) => {
    setCommandCategoryFilter(event.target.value);
  });

  $$('.left-tab').forEach((button) => {
    button.addEventListener('click', () => setLeftTab(button.dataset.leftTab));
  });

  $$('.collapsed-left-tab').forEach((button) => {
    button.addEventListener('click', () => {
      setLeftTab(button.dataset.leftTab);
      setConnectionsPanelCollapsed(false);
    });
  });

  $('#left-tab-commands')?.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.command-card, button, input, select, textarea, label')) {
      return;
    }

    showCommandsPanelContextMenu(event);
  });

  $('#add-manage-button').addEventListener('click', () => openAddConnectionModal('remote', true));
  $('#add-command-button').addEventListener('click', () => openCommandManagerModal());
  $('#modal-new-command').addEventListener('click', clearCommandManagerForm);
  $('#modal-duplicate-command').addEventListener('click', duplicateCommandFromManager);
  $('#modal-delete-command').addEventListener('click', deleteCommandFromManager);
  $('#command-manager-cancel').addEventListener('click', closeCommandManagerModal);
  $('#command-manager-save').addEventListener('click', saveCommandFromManager);
  $('#command-manager-modal').addEventListener('click', (event) => {
    if (event.target.id === 'command-manager-modal') {
      closeCommandManagerModal();
    }
  });

  $('#add-connection-type').addEventListener('change', () => {
    const type = $('#add-connection-type').value === 'local' ? 'local' : 'remote';
    const groupInput = $('#add-connection-group');

    if (groupInput && (!groupInput.value.trim() || ['Local', 'Ungrouped'].includes(groupInput.value.trim()))) {
      groupInput.value = type === 'local' ? 'Local' : 'Ungrouped';
    }

    updateAddConnectionFormVisibility();
  });
  $('#add-connection-auth-type').addEventListener('change', updateAddConnectionFormVisibility);
  $('#add-connection-start-folder').addEventListener('input', updateAddConnectionFormVisibility);
  $('#add-connection-auto-reconnect')?.addEventListener('change', updateConnectionReliabilityUi);
  $('#modal-new-ssh').addEventListener('click', () => clearConnectionModalForm('remote'));
  $('#modal-new-local').addEventListener('click', () => clearConnectionModalForm('local'));
  $('#modal-duplicate').addEventListener('click', duplicateConnectionFromModal);
  $('#modal-delete').addEventListener('click', deleteConnectionFromModal);
  $('#add-connection-private-key-path')?.addEventListener('change', updateSelectedPrivateKeyPathInfo);
  $('#add-connection-manage-keys')?.addEventListener('click', () => {
    closeAddConnectionModal();
    setActiveView('settings', 'settings');
    setSettingsTab('keys');
  });
  $('#add-connection-cancel').addEventListener('click', closeAddConnectionModal);
  $('#add-connection-save').addEventListener('click', saveConnectionFromModal);
  $('#add-connection-modal').addEventListener('click', (event) => {
    if (event.target.id === 'add-connection-modal') {
      closeAddConnectionModal();
    }
  });
  $('#tool-quick-menu')?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleQuickActionsMenu();
  });
  $('#quick-actions-menu')?.addEventListener('click', (event) => {
    const item = event.target.closest('[data-quick-action]');

    if (!item) {
      return;
    }

    event.stopPropagation();
    runQuickActionsMenuItem(item.dataset.quickAction);
  });
  $('#connections-panel-toggle')?.addEventListener('click', toggleConnectionsPanelCollapsed);

  $('#tool-save-settings').addEventListener('click', exportSettingsBackup);
  $('#settings-save-main').addEventListener('click', exportSettingsBackup);
  $('#tool-import-settings')?.addEventListener('click', importSettingsBackup);
  $('#settings-import-main')?.addEventListener('click', importSettingsBackup);
  $('#tool-repair-settings')?.addEventListener('click', repairSettingsFromLocalBackup);
  $('#settings-repair-main')?.addEventListener('click', repairSettingsFromLocalBackup);
  $('#tool-restore-settings')?.addEventListener('click', () => {
    setActiveView('settings', 'settings');
    setSettingsTab('restore');
  });
  $('#settings-restore-main')?.addEventListener('click', () => {
    setActiveView('settings', 'settings');
    setSettingsTab('restore');
  });

  $('#tool-file-settings')?.addEventListener('click', () => setActiveView('settings', 'settings'));
  $('#tool-file-about')?.addEventListener('click', () => setActiveView('about', 'help'));

  $('#tool-view-live-console')?.addEventListener('click', toggleLiveConsole);
  $('#tool-view-notification')?.addEventListener('click', () => {
    setActiveView('view', 'view');
    previewNotification();
  });

  $('#view-open-activity-feed')?.addEventListener('click', toggleLiveConsole);
  $('#view-preview-notification')?.addEventListener('click', () => {
    setActiveView('view', 'view');
    previewNotification();
  });
  $('#tool-view-terminal')?.addEventListener('click', () => setActiveView('terminal', 'terminal'));
  $('#tool-view-settings')?.addEventListener('click', () => setActiveView('settings', 'settings'));

  $('#tool-settings-appearance')?.addEventListener('click', () => {
    setActiveView('view', 'view');
  });

  $('#restore-refresh-button')?.addEventListener('click', renderSettingsRestorePoints);

  $('#tool-settings-workspaces')?.addEventListener('click', () => {
    setActiveView('settings', 'settings');
    setSettingsTab('workspaces');
  });

  $('#tool-settings-terminal-profiles')?.addEventListener('click', () => {
    setActiveView('settings', 'settings');
    setSettingsTab('terminal-profiles');
  });

  $('#tool-settings-terminal-actions')?.addEventListener('click', () => {
    setActiveView('settings', 'settings');
    setSettingsTab('terminal-actions');
  });

  $('#tool-settings-keys')?.addEventListener('click', () => {
    setActiveView('settings', 'settings');
    setSettingsTab('keys');
  });

  $('#tool-settings-updates')?.addEventListener('click', () => {
    setActiveView('settings', 'settings');
    setSettingsTab('updates');
  });

  $('#tool-settings-audit')?.addEventListener('click', () => {
    setActiveView('report', 'report');
    setReportTab('audit');
  });

  $('#tool-settings-about')?.addEventListener('click', () => {
    setActiveView('about', 'help');
    setHelpTab('about');
  });

  $('#workspace-capture-header')?.addEventListener('click', () => {
    saveCurrentWorkspaceQuick().catch((error) => {
      showToast(`Workspace save failed: ${error.message}`, 7000, 'error');
    });
  });

  $('#workspace-new')?.addEventListener('click', newWorkspaceFromManager);
  $('#workspace-duplicate')?.addEventListener('click', () => {
    duplicateWorkspaceFromManager().catch((error) => showToast(`Workspace duplicate failed: ${error.message}`, 7000, 'error'));
  });
  $('#workspace-delete')?.addEventListener('click', () => {
    deleteWorkspaceFromManager().catch((error) => showToast(`Workspace delete failed: ${error.message}`, 7000, 'error'));
  });
  $('#workspace-save-details')?.addEventListener('click', () => {
    saveWorkspaceDetailsFromManager().catch((error) => showToast(`Workspace save failed: ${error.message}`, 7000, 'error'));
  });
  $('#workspace-capture')?.addEventListener('click', () => {
    captureWorkspaceFromManager().catch((error) => showToast(`Workspace capture failed: ${error.message}`, 7000, 'error'));
  });
  $('#workspace-open')?.addEventListener('click', () => {
    if (!state.editingWorkspaceId) {
      return;
    }

    restoreWorkspace(state.editingWorkspaceId).catch((error) => {
      showToast(`Workspace restore failed: ${error.message}`, 7000, 'error');
    });
  });

  $$('.help-tab').forEach((button) => {
    button.addEventListener('click', () => {
      setActiveView('about', 'help');
      setHelpTab(button.dataset.helpTab);
    });
  });

  $$('[data-help-toolbar]').forEach((button) => {
    button.addEventListener('click', () => {
      setActiveView('about', 'help');
      setHelpTab(button.dataset.helpToolbar);
    });
  });

  $$('.help-link').forEach((button) => {
    button.addEventListener('click', () => navigateFromHelpLink(button));
  });

  $('#tool-help-settings')?.addEventListener('click', () => setActiveView('settings', 'settings'));
  $('#live-console-tab')?.addEventListener('click', toggleLiveConsole);
  $('#live-console-dismiss')?.addEventListener('click', (event) => {
    event.stopPropagation();
    dismissLiveConsole();
  });
  $('#live-process-box')?.addEventListener('click', toggleLiveConsole);
  setupLiveConsoleResize();
  $('#live-console-clear')?.addEventListener('click', clearLiveConsole);
  $('#live-console-copy')?.addEventListener('click', () => {
    copyLiveConsole().catch((error) => showToast(`Copy failed: ${error.message}`, 5000));
  });
  $('#session-report-close').addEventListener('click', closeSessionReportModal);
  $('#session-report-copy').addEventListener('click', () => {
    copySessionReport().catch((error) => showToast(`Copy failed: ${error.message}`, 5000));
  });
  $('#session-report-download').addEventListener('click', downloadSessionReport);
  $('#session-report-save-history')?.addEventListener('click', () => {
    saveCurrentReportToHistory({ silent: false }).catch((error) => showToast(`History save failed: ${error.message}`, 5000, 'error'));
  });
  $('#session-report-modal').addEventListener('click', (event) => {
    if (event.target.id === 'session-report-modal') {
      closeSessionReportModal();
    }
  });

  $('#connection-health-close')?.addEventListener('click', closeConnectionHealthModal);
  $('#connection-health-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'connection-health-modal') {
      closeConnectionHealthModal();
    }
  });

  $('#tool-clear-terminal')?.addEventListener('click', clearActiveTerminal);
  $('#tool-copy-all-terminal')?.addEventListener('click', () => {
    copyAllActiveTerminal().catch((error) => showToast(`Copy failed: ${error.message}`, 5000));
  });
  $('#tool-copy-all-terminal-terminal')?.addEventListener('click', () => {
    copyAllActiveTerminal().catch((error) => showToast(`Copy failed: ${error.message}`, 5000));
  });
  $('#tool-generate-report').addEventListener('click', openSessionReportModal);
  $('#tool-generate-ai-report')?.addEventListener('click', () => {
    generateAiProjectReport().catch((error) => showToast(`AI report failed: ${error.message}`, 7000, 'error'));
  });
  $('#session-report-ai-generate')?.addEventListener('click', () => {
    generateAiProjectReport().catch((error) => showToast(`AI report failed: ${error.message}`, 7000, 'error'));
  });
  $('#report-scope-select')?.addEventListener('change', () => {
    state.currentReportScope = getReportScope();
    if (!$('#session-report-modal')?.classList.contains('hidden')) {
      openSessionReportModal();
    }
  });
  $('#report-date-filter-select')?.addEventListener('change', () => {
    syncReportCustomRangeControls();

    if ($('#report-date-filter-select')?.value === 'custom') {
      ensureReportCustomRangeValues(state.currentReportDateFilter);
      return;
    }

    state.currentReportDateFilter = getReportDateFilter();

    if (!$('#session-report-modal')?.classList.contains('hidden')) {
      openSessionReportModal();
    }
  });

  $('#report-range-apply')?.addEventListener('click', () => {
    const filter = getReportCustomRangeFilter({ showError: true });

    if (!filter) {
      return;
    }

    state.currentReportDateFilter = filter;
    openSessionReportModal();
  });

  ['#report-range-from', '#report-range-to'].forEach((selector) => {
    $(selector)?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      $('#report-range-apply')?.click();
    });
  });
  $('#tool-copy-last-report')?.addEventListener('click', () => {
    copySessionReport().catch((error) => showToast(`Copy failed: ${error.message}`, 5000));
  });
  $('#tool-save-last-report')?.addEventListener('click', downloadSessionReport);
  $('#tool-report-history')?.addEventListener('click', openReportHistoryModal);
  $('#report-generate-main')?.addEventListener('click', openSessionReportModal);
  $('#report-copy-last-main')?.addEventListener('click', () => {
    copySessionReport().catch((error) => showToast(`Copy failed: ${error.message}`, 5000));
  });
  $('#report-open-history-main')?.addEventListener('click', openReportHistoryModal);
  $$('.report-tab').forEach((button) => {
    button.addEventListener('click', () => setReportTab(button.dataset.reportTab));
  });
  $('#report-history-close')?.addEventListener('click', closeReportHistoryModal);
  $('#report-history-delete-all')?.addEventListener('click', () => {
    clearReportHistory().catch((error) => showToast(`Could not clear history: ${error.message}`, 5000, 'error'));
  });
  $('#report-history-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'report-history-modal') {
      closeReportHistoryModal();
    }
  });
  $('#tool-copy-selection-terminal')?.addEventListener('click', () => {
    copySelectedTerminalText().catch((error) => showToast(`Copy failed: ${error.message}`, 5000));
  });
  $('#tool-paste-terminal')?.addEventListener('click', () => {
    pasteClipboardToTerminal().catch((error) => showToast(`Paste failed: ${error.message}`, 5000));
  });
  $('#tool-paste-terminal-terminal')?.addEventListener('click', () => {
    pasteClipboardToTerminal().catch((error) => showToast(`Paste failed: ${error.message}`, 5000));
  });
  $('#tool-send-ctrl-c')?.addEventListener('click', () => sendControlToActiveTerminal('\x03', 'Ctrl+C'));
  $('#tool-send-ctrl-l')?.addEventListener('click', () => sendControlToActiveTerminal('\x0c', 'Ctrl+L'));
  $('#tool-send-ctrl-d')?.addEventListener('click', () => sendControlToActiveTerminal('\x04', 'Ctrl+D'));
  $('#tool-close-terminal')?.addEventListener('click', () => closeTerminalSession());
  $('#tool-toggle-theme').addEventListener('click', toggleTheme);

  // Legacy full server form is no longer shown in Settings.
  // Server creation now happens from the left panel popup.
  $('#server-type')?.addEventListener('change', updateServerFormVisibility);
  $('#server-auth-type')?.addEventListener('change', updateServerFormVisibility);
  $('#save-server-button')?.addEventListener('click', saveServerFromForm);
  $('#delete-server-button')?.addEventListener('click', deleteSelectedServer);

  $('#browse-private-key')?.addEventListener('click', async () => {
    const file = await window.advanceTerminal.selectPrivateKey();
    if (file && $('#server-private-key-path')) {
      $('#server-private-key-path').value = file;
    }
  });


  $('#terminal-profile-new')?.addEventListener('click', newTerminalProfileFromManager);
  $('#terminal-profile-duplicate')?.addEventListener('click', () => {
    duplicateTerminalProfileFromManager().catch((error) => showToast(`Profile duplicate failed: ${error.message}`, 7000, 'error'));
  });
  $('#terminal-profile-delete')?.addEventListener('click', () => {
    deleteTerminalProfileFromManager().catch((error) => showToast(`Profile delete failed: ${error.message}`, 7000, 'error'));
  });
  $('#terminal-profile-save')?.addEventListener('click', () => {
    saveTerminalProfileFromManager().catch((error) => showToast(`Profile save failed: ${error.message}`, 7000, 'error'));
  });
  $('#terminal-profile-save-bottom')?.addEventListener('click', () => {
    saveTerminalProfileFromManager().catch((error) => showToast(`Profile save failed: ${error.message}`, 7000, 'error'));
  });
  $('#terminal-profile-launch')?.addEventListener('click', () => {
    const profileId = state.editingTerminalProfileId;
    if (profileId) {
      launchTerminalProfile(profileId).catch((error) => showToast(`Profile launch failed: ${error.message}`, 7000, 'error'));
    }
  });
  $('#terminal-profile-detect')?.addEventListener('click', () => {
    detectTerminalShellsForProfiles().catch((error) => showToast(`Shell detection failed: ${error.message}`, 7000, 'error'));
  });
  $('#terminal-profile-browse-executable')?.addEventListener('click', async () => {
    const selected = await window.advanceTerminal?.selectTerminalExecutable?.();
    if (selected && $('#terminal-profile-executable')) {
      $('#terminal-profile-executable').value = selected;
    }
  });
  $('#terminal-profile-browse-folder')?.addEventListener('click', async () => {
    const selected = await window.advanceTerminal?.selectTerminalFolder?.();
    if (selected && $('#terminal-profile-working-directory')) {
      $('#terminal-profile-working-directory').value = selected;
    }
  });
  $('#terminal-profile-kind')?.addEventListener('change', (event) => {
    const kind = String(event.target.value || 'custom');
    const executable = $('#terminal-profile-executable');
    const icon = $('#terminal-profile-icon');
    const currentExecutable = String(executable?.value || '').trim();
    const knownDefaults = new Set(['powershell.exe', 'cmd.exe', 'wsl.exe', 'C:\\Program Files\\Git\\bin\\bash.exe', '']);

    if (executable && knownDefaults.has(currentExecutable)) {
      executable.value = terminalProfileDefaultExecutable(kind);
    }

    if (icon && (!String(icon.value || '').trim() || ['PS', 'CMD', 'GIT', 'WSL', 'TERM'].includes(String(icon.value || '').trim().toUpperCase()))) {
      icon.value = terminalProfileDefaultIcon(kind);
    }

    if (kind === 'git-bash' && !String($('#terminal-profile-args')?.value || '').trim()) {
      $('#terminal-profile-args').value = '--login\n-i';
    }
  });
  $('#terminal-profile-color')?.addEventListener('input', (event) => {
    if ($('#terminal-profile-color-text')) {
      $('#terminal-profile-color-text').value = String(event.target.value || '#58a6ff').toLowerCase();
    }
  });
  $('#terminal-profile-color-text')?.addEventListener('input', (event) => {
    const value = String(event.target.value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(value) && $('#terminal-profile-color')) {
      $('#terminal-profile-color').value = value;
    }
  });

  $('#terminal-action-new')?.addEventListener('click', newTerminalActionFromManager);
  $('#terminal-action-new-separator')?.addEventListener('click', newTerminalSeparatorFromManager);
  $('#terminal-action-duplicate')?.addEventListener('click', duplicateTerminalActionFromManager);
  $('#terminal-action-delete')?.addEventListener('click', deleteTerminalActionFromManager);
  $('#terminal-action-move-up')?.addEventListener('click', () => moveTerminalActionFromManager(-1));
  $('#terminal-action-move-down')?.addEventListener('click', () => moveTerminalActionFromManager(1));
  $('#terminal-action-reset')?.addEventListener('click', resetTerminalActionsToDefault);
  $('#terminal-action-save')?.addEventListener('click', () => saveTerminalActionFromManager());
  $('#terminal-toolbar-save')?.addEventListener('click', saveTerminalToolbarFromManager);
  $('#terminal-action-item-type')?.addEventListener('change', () => {
    updateTerminalActionFormVisibility();
    updateTerminalActionCustomizationControls();
  });
  $('#terminal-action-kind')?.addEventListener('change', updateTerminalActionFormVisibility);
  $('#terminal-action-visibility')?.addEventListener('change', updateTerminalActionFormVisibility);
  $('#terminal-action-shortcut')?.addEventListener('input', updateTerminalActionShortcutHelp);
  $('#terminal-action-color-enabled')?.addEventListener('change', updateTerminalActionCustomizationControls);
  $('#terminal-action-color')?.addEventListener('input', updateTerminalActionCustomizationControls);

  $$('.settings-tab').forEach((button) => {
    button.addEventListener('click', () => setSettingsTab(button.dataset.settingsTab));
  });

  $('#check-updates-button')?.addEventListener('click', () => {
    checkForAppUpdates().catch((error) => {
      showToast(`Update check failed: ${error.message}`, 7000, 'error');
    });
  });

  $('#install-update-button')?.addEventListener('click', () => {
    installDownloadedUpdate().catch((error) => {
      showToast(`Install update failed: ${error.message}`, 7000, 'error');
    });
  });

  $('#safe-paste-multiline-toggle')?.addEventListener('change', (event) => {
    setSafePasteMultilineProtection(event.target.checked).catch((error) => {
      showToast(`Paste safety save failed: ${error.message}`, 5000, 'error');
      updatePasteProtectionControls();
    });
  });

  $('#right-click-auto-enter-toggle')?.addEventListener('change', (event) => {
    setRightClickAutoEnter(event.target.checked).catch((error) => {
      showToast(`Right-click paste setting save failed: ${error.message}`, 5000, 'error');
      updatePasteProtectionControls();
    });
  });

  $('#terminal-busy-action-lock-toggle')?.addEventListener('change', (event) => {
    setTerminalBusyActionLock(event.target.checked).catch((error) => {
      showToast(`Running-command lock setting save failed: ${error.message}`, 5000, 'error');
      updatePasteProtectionControls();
      updateTerminalInteractionState();
    });
  });

  $('#restart-as-admin-button')?.addEventListener('click', () => {
    restartAdvanceTerminalAsAdministrator().catch((error) => {
      updateWindowsAdminControls();
      showToast(`Administrator restart failed: ${error.message}`, 7000, 'error');
    });
  });

  $('#ssh-lock-start-folder-toggle')?.addEventListener('change', (event) => {
    setSshStartFolderLock(event.target.checked).catch((error) => {
      showToast(`SSH folder lock setting save failed: ${error.message}`, 5000, 'error');
      updatePasteProtectionControls();
    });
  });

  $('#ai-save-settings')?.addEventListener('click', () => {
    saveAiSettingsFromControls().catch((error) => showToast(`AI settings save failed: ${error.message}`, 7000, 'error'));
  });

  $('#ai-test-status')?.addEventListener('click', () => {
    refreshAiStatus({ silent: false }).catch((error) => showToast(`AI status failed: ${error.message}`, 7000, 'error'));
  });

  $('#ai-clear-api-key')?.addEventListener('click', () => {
    clearAiApiKey().catch((error) => showToast(`Clear AI key failed: ${error.message}`, 7000, 'error'));
  });

  $('#ai-reports-enabled-toggle')?.addEventListener('change', () => {
    saveAiSettingsFromControls().catch((error) => showToast(`AI settings save failed: ${error.message}`, 7000, 'error'));
  });

  $('#ai-include-commands-toggle')?.addEventListener('change', () => {
    saveAiSettingsFromControls().catch((error) => showToast(`AI settings save failed: ${error.message}`, 7000, 'error'));
  });

  $('#ai-include-git-diff-toggle')?.addEventListener('change', () => {
    saveAiSettingsFromControls().catch((error) => showToast(`AI settings save failed: ${error.message}`, 7000, 'error'));
  });

  $('#ai-openai-model')?.addEventListener('change', () => {
    saveAiSettingsFromControls().catch((error) => showToast(`AI settings save failed: ${error.message}`, 7000, 'error'));
  });

  $$('[data-report-option]').forEach((input) => {
    input.addEventListener('change', (event) => {
      updateReportOptionFromInput(event).catch((error) => showToast(`Report option save failed: ${error.message}`, 5000, 'error'));
    });
  });

  $('#activity-feed-terminal-output-select')?.addEventListener('change', (event) => {
    setActivityFeedTerminalOutputMode(event.target.value).catch((error) => {
      showToast(`Activity Feed setting save failed: ${error.message}`, 5000, 'error');
      updateActivityFeedOutputControls();
    });
  });

  $('#appearance-theme-select')?.addEventListener('change', async (event) => {
    await setTheme(event.target.value);
    showToast(`${event.target.value === 'dark' ? 'Dark' : 'Light'} mode enabled.`);
  });

  $('#notification-position-select')?.addEventListener('change', async (event) => {
    await setNotificationPosition(event.target.value);
    previewNotification();
  });

  $('#notification-preview-button')?.addEventListener('click', previewNotification);

  $('#generate-key-button').addEventListener('click', generateKey);
  $('#refresh-ssh-keys')?.addEventListener('click', () => refreshSshKeys());
  $('#open-system-ssh-folder')?.addEventListener('click', () => openSshKeyFolder({ locationId: 'system' }));
  $('#open-app-ssh-folder')?.addEventListener('click', () => openSshKeyFolder({ locationId: 'app' }));
  $('#archive-all-ssh-keys')?.addEventListener('click', () => archiveAllSshKeys().catch((error) => {
    showToast(`Archive all keys failed: ${error.message}`, 7000, 'error');
  }));

  $('#ssh-key-list')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-key-action]');

    if (!button) {
      return;
    }

    const privateKeyPath = button.dataset.keyPath || '';

    if (button.dataset.keyAction === 'copy-public') {
      copyPublicKeyForPrivateKey(privateKeyPath).catch((error) => {
        showToast(`Copy public key failed: ${error.message}`, 7000);
      });
      return;
    }

    if (button.dataset.keyAction === 'reveal') {
      openSshKeyFolder({ privateKeyPath }).catch((error) => {
        showToast(`Reveal key failed: ${error.message}`, 7000);
      });
      return;
    }

    if (button.dataset.keyAction === 'archive') {
      archiveSshKey(privateKeyPath).catch((error) => {
        showToast(`Archive key failed: ${error.message}`, 7000, 'error');
      });
    }
  });

  $('#copy-public-key').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('#generated-public-key').value);
    showToast('Public key copied. Add it to your hosting SSH Keys.', 5000, 'success');
  });

  $('#secret-modal-cancel').addEventListener('click', () => closeSecretModal(null));
  $('#secret-modal-connect').addEventListener('click', () => closeSecretModal($('#secret-modal-input').value));
  $('#secret-modal-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      closeSecretModal($('#secret-modal-input').value);
    }

    if (event.key === 'Escape') {
      closeSecretModal(null);
    }
  });

  $('#confirm-modal-cancel')?.addEventListener('click', () => closeConfirmDialog(false));
  $('#confirm-modal-confirm')?.addEventListener('click', () => closeConfirmDialog(true));
  $('#confirm-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'confirm-modal') {
      closeConfirmDialog(false);
    }
  });
  $('#confirm-modal')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      closeConfirmDialog(true);
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeConfirmDialog(false);
    }
  });


  $('#terminal-tab-rename-cancel')?.addEventListener('click', () => closeTerminalTabRenameModal(false));
  $('#terminal-tab-rename-save')?.addEventListener('click', () => closeTerminalTabRenameModal(true));
  $('#terminal-tab-rename-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'terminal-tab-rename-modal') {
      closeTerminalTabRenameModal(false);
    }
  });
  $('#terminal-tab-rename-modal')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      closeTerminalTabRenameModal(true);
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeTerminalTabRenameModal(false);
    }
  });

  $('#safe-paste-cancel')?.addEventListener('click', () => closeSafePasteDialog(null));
  $('#safe-paste-single-line')?.addEventListener('click', () => closeSafePasteDialog('single-line'));
  $('#safe-paste-execute')?.addEventListener('click', () => closeSafePasteDialog('execute'));
  $('#safe-paste-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'safe-paste-modal') {
      closeSafePasteDialog(null);
    }
  });
  $('#safe-paste-modal')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSafePasteDialog(null);
    }
  });

  $('#session-report-modal')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSessionReportModal();
    }
  });

  $('#connection-health-modal')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeConnectionHealthModal();
    }
  });


  $('#add-connection-modal').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAddConnectionModal();
    }

    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
      event.preventDefault();
      saveConnectionFromModal();
    }
  });

  document.addEventListener('click', (event) => {
    hideSidebarContextMenu();

    if (!event.target.closest('#quick-actions-menu, #tool-quick-menu')) {
      closeQuickActionsMenu();
    }

    if (!event.target.closest('#terminal-profile-quick-menu, #tool-quick-menu')) {
      closeTerminalProfileQuickMenu();
    }

    if (!event.target.closest('#workspace-quick-menu, #tool-quick-menu')) {
      closeWorkspaceQuickMenu();
    }

    if (!event.target.closest('.terminal-toolbar-dropdown-menu, .terminal-toolbar-dropdown-toggle')) {
      closeTerminalToolbarDropdown();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (
      terminalTabPickerMenu
      && !terminalTabPickerMenu.contains(event.target)
      && !terminalTabPickerButton?.contains(event.target)
    ) {
      closeTerminalTabPicker();
    }

    if (
      terminalSplitPickerMenu
      && !terminalSplitPickerMenu.contains(event.target)
      && !terminalSplitPickerButton?.contains(event.target)
    ) {
      closeTerminalSplitPicker();
    }

    if (
      terminalTabContextMenu
      && !terminalTabContextMenu.contains(event.target)
      && !event.target.closest('.terminal-tab')
    ) {
      closeTerminalTabContextMenu();
    }
  });
  document.addEventListener('contextmenu', (event) => {
    if (!event.target.closest('.server-card, .command-card, #sidebar-context-menu')) {
      hideSidebarContextMenu();
    }

    if (!event.target.closest('.terminal-tab, .terminal-tab-context-menu')) {
      closeTerminalTabContextMenu();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideSidebarContextMenu();
      closeQuickActionsMenu();
      closeTerminalProfileQuickMenu();
      closeWorkspaceQuickMenu();
      closeTerminalTabPicker({ restoreFocus: true });
      closeTerminalSplitPicker({ restoreFocus: true });
      closeTerminalTabContextMenu();
      closeTerminalToolbarDropdown();
    }
  });

  window.addEventListener('resize', () => {
    hideSidebarContextMenu();
    closeQuickActionsMenu();
    closeTerminalProfileQuickMenu();
    closeWorkspaceQuickMenu();
    closeTerminalTabPicker();
    closeTerminalSplitPicker();
    closeTerminalTabContextMenu();
    closeTerminalToolbarDropdown();
    scheduleActiveTerminalFit();
  });

  window.advanceTerminal.onTerminalData((payload) => {
    const session = state.terminals.get(payload.terminalId);
    if (session) {
      markAuthenticationFailure(session, payload.data);
      updateSessionLocationFromTerminalData(session, payload.data);
      maybeReleaseTerminalProcessBusy(session, payload.data);

      if (handleCleanSshStartupData(session, payload.data)) {
        return;
      }

      session.term.write(payload.data);
      scheduleTerminalSearchRefresh(payload.terminalId);
      queueTerminalOutputActivity(payload);
      maybeQueueLiveConsoleTerminalOutput(payload, session);
    }
  });

  window.advanceTerminal.onTerminalPasswordRequired((payload) => {
    handleTerminalPasswordRequired(payload).catch((error) => {
      showToast(`Password prompt error: ${error.message}`, 7000);
    });
  });

  window.advanceTerminal.onTerminalExit((payload) => {
    const session = state.terminals.get(payload.terminalId);
    if (session) {
      const errorMessage = String(payload.errorMessage || '').trim();
      const errorCode = String(payload.errorCode || '').trim();
      const authenticationFailed = Boolean(payload.authFailure)
        || errorCode === 'SSH_AUTH_FAILED'
        || errorCode.startsWith('SSH_AUTH_')
        || errorCode.startsWith('SSH_PRIVATE_KEY_');

      state.connectionAttemptInFlight = false;
      session.cleanSshStartupActive = false;
      session.cleanSshStartupBuffer = '';
      session.cleanSshStartupStartedAt = null;
      hideTerminalConnectingOverlay(session);

      if (authenticationFailed) {
        session.authFailed = true;
      }

      flushTerminalOutputActivity(payload.terminalId);
      flushLiveConsoleTerminalOutput(payload.terminalId);
      checkpointDailyUsage({ persist: false });
      recordDailyDisconnect(session);
      recordSessionEvent(
        session,
        errorMessage || `Process exited with code ${payload.code}.`,
        Number(payload.code) ? 'error' : 'warning'
      );
      finishActiveReportJob(
        session,
        Number(payload.code) ? 'failed' : 'interrupted',
        { note: errorMessage || `Terminal process exited with code ${payload.code}.` }
      );
      session.term.writeln(`\r\n[process exited with code ${payload.code}]\r\n`);
      setTerminalProcessBusy(session, false);

      if (errorMessage) {
        updateConnectionHealthFromSession(session.server, 'error', errorMessage);
      }

      if (scheduleAutoReconnect(session, payload)) {
        renderServerList();
        updateTerminalInteractionState();
        showToast(`${session.server?.name || 'Terminal'} disconnected. Auto reconnect is scheduled.`, 6000, 'warning');
        return;
      }

      moveActiveSessionToHistory(session, Number(payload.code) ? 'Connection failed' : 'Disconnected');
      session.closed = true;
      session.status = Number(payload.code) ? 'error' : 'disconnected';
      cleanupTerminalSessionResources(session);

      if (state.activeTerminalId === payload.terminalId) {
        setTerminalStatus(session.status);
      }

      renderTerminalTabs();
      renderServerList();
      updateTerminalInteractionState();

      showToast(
        errorMessage
          ? `${session.server?.name || 'SSH connection'}: ${errorMessage}`
          : `${session.server?.name || 'Terminal'} disconnected${Number(payload.code) ? ` with code ${payload.code}` : ''}.`,
        errorMessage ? 9000 : 6000,
        Number(payload.code) ? 'error' : 'warning'
      );
    }
  });
}

async function init() {
  bindEvents();
  setupTerminalResizeObserver();

  state.appInfo = await window.advanceTerminal.getAppInfo();
  updateWindowsAdminControls();

  if (window.advanceTerminal.onUpdateStatus) {
    window.advanceTerminal.onUpdateStatus(handleUpdateStatus);
  }

  await refreshUpdateStatus();

  state.settings = await window.advanceTerminal.getSettings();
  state.settings.reportUsage = normalizeReportUsageClient(state.settings.reportUsage);
  state.settings.reportHistory = normalizeReportHistoryClient(state.settings.reportHistory);
  state.pinnedConnectionIds = readPinnedConnectionIds();
  clearStaleActiveSessionsForNewRun();
  markUsageDirty(true);
  state.selectedServerId = state.settings.selectedServerId || state.settings.servers[0]?.id || null;
  await refreshSshKeys({ silent: true });

  applyTheme(getUiTheme());
  applyNotificationPosition(getNotificationPosition());
  updatePasteProtectionControls();
  updateActivityFeedOutputControls();
  await refreshAiStatus({ silent: true });
  setConnectionsPanelCollapsed(readConnectionsPanelCollapsedPreference(), false);
  setLiveConsoleDock('right');
  setLiveConsoleSize('closed');
  renderLiveProcessBox();
  renderTerminalToolbarActions();
  renderTerminalProfileQuickMenu();
  renderWorkspaceQuickMenu();
  populateLocalProfileDropdown();
  updateConnectionFilterButtons();

  $('#mode-label').textContent = state.appInfo?.displayVersion || 'Advance Terminal V6';

  appendLiveConsole('Advance Terminal started.', 'system');
  startRuntimeFooter();
  startDailyUsageTracking();

  renderServerList();
  renderCommandList();
  renderAuditLog();
  updateAboutInfo();

  if (state.selectedServerId) {
    selectServer(state.selectedServerId);
  }

  setLeftTab(state.activeLeftTab);
  setTerminalStatus('idle');
  setActiveView('terminal');
  state.activityFeedReady = true;

  window.setTimeout(() => {
    maybeRestoreStartupWorkspace().catch((error) => {
      appendActivityFeedEvent(`Startup workspace failed: ${error.message}`, 'error', { dedupeMs: 1500 });
      showToast(`Startup workspace failed: ${error.message}`, 8000, 'error');
    });
  }, 180);
}

init().catch((error) => {
  showToast(`Startup error: ${error.message}`, 9000);
});
