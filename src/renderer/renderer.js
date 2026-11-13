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
  editingTerminalActionId: null,
  terminals: new Map(),
  activeTerminalId: null,
  closedTerminalTabs: [],
  pendingSecret: null,
  pendingSecretMeta: null,
  pendingConfirmResolve: null,
  pendingSafePasteResolve: null,
  liveConsoleOpen: false,
  liveConsoleSize: 'closed',
  liveConsoleHeight: 320,
  liveConsoleResize: null,
  liveConsoleDock: 'right',
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
  usageRevision: 0,
  usageLastSavedAt: 0,
  settingsSaveTimer: null,
  settingsSaveInFlight: false,
  settingsSaveBatch: null,
  busyActions: new Set(),
  connectionAttemptInFlight: false,
  connectionHealthCheckInFlight: null,
  terminalActionInFlightSessionIds: new Set(),
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
const USAGE_SAVE_DEBOUNCE_MS = 8000;
const USAGE_SAVE_MIN_INTERVAL_MS = 30000;
const SETTINGS_SAVE_DEBOUNCE_MS = 800;
const CONNECTIONS_PANEL_COLLAPSED_STORAGE_KEY = 'advanceTerminal.connectionsPanelCollapsed';
const PINNED_CONNECTIONS_STORAGE_KEY = 'advanceTerminal.pinnedConnections';

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
  // Do not duplicate or inspect terminal output for a removed panel.
  return 'off';
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

// In-app messages are separate from native Windows command-completion notifications.
// Store this UI preference locally, without touching server/SSH settings.
const IN_APP_TOAST_MODE_STORAGE_KEY = 'advanceTerminal.ui.inAppToastMode';
const IN_APP_TOAST_DEFAULT_MODE = 'important';
const IN_APP_TOAST_MODES = new Set(['all', 'important', 'errors', 'off']);
const inAppToastDedupe = new Map();

function normalizeInAppToastMode(value) {
  return IN_APP_TOAST_MODES.has(value) ? value : IN_APP_TOAST_DEFAULT_MODE;
}

function getInAppToastMode() {
  try {
    return normalizeInAppToastMode(localStorage.getItem(IN_APP_TOAST_MODE_STORAGE_KEY));
  } catch (_error) {
    return IN_APP_TOAST_DEFAULT_MODE;
  }
}

function updateInAppToastModeControl() {
  const select = $('#in-app-toast-mode-select');
  if (select) select.value = getInAppToastMode();
}

function setInAppToastMode(value) {
  const mode = normalizeInAppToastMode(value);
  try {
    localStorage.setItem(IN_APP_TOAST_MODE_STORAGE_KEY, mode);
  } catch (_error) {
    // Private/blocked storage: keep the application working with quiet defaults.
  }
  inAppToastDedupe.clear();
  dismissToast();
  updateInAppToastModeControl();
}

function shouldDisplayInAppToast(level, { force = false } = {}) {
  if (force) return true; // Explicitly requested settings preview.
  const mode = getInAppToastMode();
  if (mode === 'all') return true;
  if (mode === 'important') return level === 'warning' || level === 'error';
  if (mode === 'errors') return level === 'error';
  return false;
}

function previewNotification() {
  const label = getNotificationPosition()
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  showToast(`Notification preview: ${label}`, 4500, 'info', { force: true });
}


function appendActivityFeedEvent(_message, _level = 'info', _options = {}) {
  // Activity Feed retired from v5. Keep old call sites harmless.
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

function showToast(message, timeout = 3200, type = null, options = {}) {
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
  if (!shouldDisplayInAppToast(toastType, options)) return;

  // Prevent repeated identical warnings/errors from obscuring the terminal.
  // Different messages still appear. Settings preview deliberately bypasses dedupe.
  if (!options.force && (toastType === 'warning' || toastType === 'error')) {
    const now = Date.now();
    const key = `${toastType}:${String(message)}`;
    const windowMs = toastType === 'error' ? 6000 : 20000;
    const previous = inAppToastDedupe.get(key);
    if (previous !== undefined && now - previous < windowMs) return;
    inAppToastDedupe.set(key, now);
    if (inAppToastDedupe.size > 64) {
      for (const [oldKey, seenAt] of inAppToastDedupe) {
        if (now - seenAt > 30000) inAppToastDedupe.delete(oldKey);
      }
      if (inAppToastDedupe.size > 64) inAppToastDedupe.clear();
    }
  }

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


// Prompt-only terminals (including ordinary SSH shells) do not expose a
// reliable child-process completion event. Wait for a stable shell prompt
// instead of treating one incoming output chunk as proof of completion.
const TERMINAL_PROCESS_COMPLETION_QUIET_MS = 900;
// Connection setup is restricted, but command execution must not lock the toolbar.
const TERMINAL_BUSY_ALLOWED_ACTIONS = new Set(['clear', 'copyAll', 'copySelection', 'ctrlC', 'closeSession']);

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

  // A running command is not an unavailable terminal. Only connection setup
  // prevents sending new input; Ctrl+C and local view actions remain available.
  return ['connecting', 'reconnecting'].includes(status);
}

function terminalActionAllowedWhileProcessing(action) {
  return TERMINAL_BUSY_ALLOWED_ACTIONS.has(String(action || ''));
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

  // Never steal focus from the tab the user is browsing.
}

function updateTerminalInteractionState() {
  const activeSession = state.terminals.get(state.activeTerminalId) || null;
  const activeProcessing = isTerminalSessionProcessing(activeSession)
    || state.terminalActionInFlightSessionIds.has(activeSession?.terminalId);
  const connectingSession = getConnectingTerminalSession();
  const connectionOperationBusy = Boolean(connectingSession || state.connectionHealthCheckInFlight || state.connectionAttemptInFlight);

  $$('.terminal-action-button').forEach((button) => {
    const action = button.dataset.terminalAction || '';
    const disabled = activeProcessing && !terminalActionAllowedWhileProcessing(action);
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

    const disabled = activeProcessing && !terminalActionAllowedWhileProcessing(action);
    button.disabled = disabled;
    button.classList.toggle('is-busy', disabled);
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  });

  $$('.command-run-button').forEach((button) => {
    button.disabled = Boolean(activeProcessing);
    button.classList.toggle('is-busy', Boolean(activeProcessing));
    button.setAttribute('aria-disabled', activeProcessing ? 'true' : 'false');
    button.title = activeProcessing ? 'Wait for the active terminal process to finish.' : 'Run command';
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
  syncV7CommandComposer();
}

function isTerminalTabWorking(session) {
  return Boolean(session && !session.closed && (
    ['connecting', 'reconnecting'].includes(String(session.status || '').toLowerCase())
    || session.processBusy === true
  ));
}

function updateTerminalTabWorkingIndicator(session) {
  if (!session?.terminalId) return;
  // Only update this session's existing DOM node, avoiding a tab-strip rebuild
  // whenever terminal output or command state changes.
  const tab = Array.from($('#terminal-tabs')?.children || [])
    .find((node) => node.dataset?.terminalId === session.terminalId);
  if (!tab) return;
  const working = isTerminalTabWorking(session);
  tab.classList.toggle('is-working', working);
  tab.setAttribute('aria-busy', working ? 'true' : 'false');
  const status = ['connecting', 'reconnecting'].includes(String(session.status || '').toLowerCase())
    ? 'Connecting'
    : working ? 'Command running' : session.closed ? 'Disconnected' : 'Ready';
  tab.title = `${session.server?.type === 'local' ? 'Local terminal' : 'SSH'}: ${getTerminalTabTitle(session)} — ${status} — right-click for tab actions`;
  const indicator = tab.querySelector('.terminal-tab-work-indicator');
  if (indicator) indicator.setAttribute('aria-label', status);
  const sessionRow = Array.from($('#v7-session-list')?.children || [])
    .find((node) => node.dataset?.terminalId === session.terminalId);
  if (sessionRow) {
    sessionRow.classList.toggle('is-working', working);
    sessionRow.setAttribute('aria-busy', working ? 'true' : 'false');
    const subtitle = sessionRow.querySelector('.v7-session-name small');
    if (subtitle) subtitle.textContent = getV7SessionStatus(session);
  }
}

function notifyTerminalProcessCompleted(session, source) {
  // A command must have been submitted in this live tab. Never send the
  // command text, remote host, terminal output or credentials to Windows.
  if (!session || session.closed || !session.processCompletionSequence) return;
  if (typeof window.advanceTerminal?.notifyTerminalActivityComplete !== 'function') return;
  window.advanceTerminal.notifyTerminalActivityComplete({
    terminalId: session.terminalId,
    runId: session.processCompletionSequence,
    source
  });
}

function setTerminalProcessBusy(session, busy, label = '') {
  if (!session) return;

  // No arbitrary age-based expiry: silent builds, SSH jobs and interactive
  // readers can legitimately stay busy for longer than an hour.
  clearTimeout(session.processBusyTimer);
  session.processBusyTimer = null;
  if (busy && !session.processBusy) {
    session.processCompletionSequence = (session.processCompletionSequence || 0) + 1;
  }
  session.processBusy = Boolean(busy);
  session.processLabel = busy ? String(label || 'A terminal command is still running').slice(0, 180) : '';
  session.processBusySince = busy ? Date.now() : null;
  session.processActivityGeneration = (session.processActivityGeneration || 0) + 1;
  session.processOutputTail = '';
  updateTerminalTabWorkingIndicator(session);
  updateTerminalInteractionState();
}

function terminalOutputLooksReady(data) {
  const cleaned = stripTerminalControlText(data)
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .pop();

  if (!cleaned || cleaned.length > 260) return false;

  return /^(?:PS\s+)?[A-Za-z]:[\\/].*>\s*$/.test(cleaned)
    || /^(?:\([^)]+\)\s*)?(?:[\w.-]+@[\w.-]+(?::[^$#\r\n]*)?|[~/.][^$#\r\n]*)[$#%❯➜]\s*$/.test(cleaned)
    || /^\[[^\]\r\n]+@[^\]\r\n]+\][#$%]\s*$/.test(cleaned)
    || /^[$#%❯➜]\s*$/.test(cleaned)
    || /^[A-Za-z0-9_.-]{1,80}[$#%❯➜]\s*$/.test(cleaned);
}

// Read the terminal's current cursor line as a fallback for PowerShell.
// PTY output can split ANSI/control sequences across IPC events; the raw
// output tail may not match the prompt even when xterm shows it correctly.
// Only use this for local PowerShell, and only after output has been quiet.
function terminalVisiblePowerShellPromptLooksReady(session) {
  if (session?.server?.type !== 'local') return false;
  const buffer = session.term?.buffer?.active;
  if (!buffer || !Number.isInteger(buffer.baseY) || !Number.isInteger(buffer.cursorY)) return false;
  const line = buffer.getLine?.(buffer.baseY + buffer.cursorY);
  const visibleLine = line?.translateToString?.(true);
  if (typeof visibleLine !== 'string') return false;
  const cleaned = visibleLine.trimEnd();
  // A cursor on a prompt (rather than on a printed log line) is required.
  if (!/^PS\s+[A-Za-z]:[\\/].*>$/.test(cleaned)) return false;
  return Number.isInteger(buffer.cursorX) && buffer.cursorX >= cleaned.length;
}

function terminalOutputHasCompletionMarker(data) {
  // Optional shell-integration signal (OSC 133/633 "command finished").
  // The marker must be terminated, including if split across IPC chunks.
  return /\x1b\](?:133|633);D(?:;[^\x07\x1b]*)?(?:\x07|\x1b\\)/.test(data);
}

function maybeReleaseTerminalProcessBusy(session, data) {
  if (!session?.processBusy || !data || session.closed) return;

  // Every incoming output chunk invalidates the prior completion candidate.
  // In particular, a line of streamed command output resembling a prompt
  // must not immediately stop the loading indicator.
  clearTimeout(session.processBusyTimer);
  session.processBusyTimer = null;
  session.processOutputTail = `${session.processOutputTail || ''}${String(data)}`.slice(-1536);

  if (terminalOutputHasCompletionMarker(session.processOutputTail)) {
    setTerminalProcessBusy(session, false);
    notifyTerminalProcessCompleted(session, 'shell-marker');
    return;
  }

  // Even if the raw tail is inconclusive, give the rendered PowerShell prompt
  // a chance to settle before deciding. Never equate silence with completion.
  const observedTail = session.processOutputTail;
  const observedGeneration = session.processActivityGeneration;
  session.processBusyTimer = setTimeout(() => {
    session.processBusyTimer = null;
    if (!session.closed && state.terminals.get(session.terminalId) === session
        && session.processBusy && session.processActivityGeneration === observedGeneration
        && session.processOutputTail === observedTail
        && (terminalOutputLooksReady(observedTail)
          || terminalVisiblePowerShellPromptLooksReady(session))) {
      setTerminalProcessBusy(session, false);
      notifyTerminalProcessCompleted(session, 'prompt-quiet');
    }
  }, TERMINAL_PROCESS_COMPLETION_QUIET_MS);
}

function guardTerminalAction(session, actionName, actionKind = '') {
  if (!session) {
    return false;
  }

  if (isTerminalSessionProcessing(session) && !terminalActionAllowedWhileProcessing(actionKind)) {
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
  // This notification belongs next to the rejected command, not over the
  // application chrome. Never type these bytes into the remote shell.
  const message = String(reason || 'SSH folder lock blocked this command.')
    .replace(/[\x00-\x1f\x7f]/g, ' ').trim();
  const now = Date.now();
  const previousNotice = session?.sshLockLastInlineNotice;
  const repeated = previousNotice?.message === message
    && now - previousNotice.at >= 0
    && now - previousNotice.at < 3000;

  if (session?.term && !repeated) {
    // ANSI truecolor affects this local xterm note only; reset after both spans.
    const prefix = '\x1b[38;2;210;162;79m[Advance Terminal]\x1b[0m';
    const body = `\x1b[38;2;219;215;204m${message}\x1b[0m`;
    session.term.write(`\r\n${prefix} ${body}\r\n`);
    session.sshLockLastInlineNotice = { message, at: now };
  }

  // Preserve one audit entry for *every* rejected attempt, even if the
  // duplicate visual notice is suppressed for three seconds.
  appendLiveConsole(`SSH folder lock: ${message}`, 'warning');
  recordSessionEvent(session, message, 'warning');
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

function finishCleanSshStartup(session, prompt) {
  session.cleanSshStartupActive = false;
  session.cleanSshStartupBuffer = '';
  session.cleanSshStartupStartedAt = null;
  hideTerminalConnectingOverlay(session);
  session.status = 'connected';
  updateTerminalTabWorkingIndicator(session);
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

  if (state.activeTerminalId === session.terminalId && state.activeView === 'terminal') focusTerminal(session);
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

function appendLiveConsole(_message, _level = 'info') {
  // Activity Feed retired. No in-memory feed entries or redraw work.
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

function maybeQueueLiveConsoleTerminalOutput(_payload, _session = null) {
  // Terminal output remains in xterm; Activity Feed collection is disabled.
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

  const provider = source.provider === 'openai' ? 'openai' : 'lmstudio';
  const defaultModel = provider === 'openai' ? 'gpt-5.5' : 'qwen/qwen3.5-9b';
  return {
    enabled: source.enabled === true,
    provider,
    model: String(source.model || defaultModel).trim().replace(/\s+/g, '') || defaultModel,
    includeGitDiff: source.includeGitDiff === true,
    includeRecentCommands: source.includeRecentCommands !== false
  };
}

function updateAiSettingsControls() {
  const settings = getAiSettingsClient();
  const isLocal = settings.provider === 'lmstudio';
  const enabledToggle = $('#ai-reports-enabled-toggle');
  const modelInput = $('#ai-openai-model');
  const providerSelect = $('#ai-provider-select');
  const commandsToggle = $('#ai-include-commands-toggle');
  const diffToggle = $('#ai-include-git-diff-toggle');
  const statusEl = $('#ai-openai-key-status');

  if (enabledToggle) enabledToggle.checked = settings.enabled;
  if (providerSelect) providerSelect.value = settings.provider;
  if (modelInput) modelInput.value = settings.model;
  if (commandsToggle) commandsToggle.checked = settings.includeRecentCommands;
  if (diffToggle) diffToggle.checked = settings.includeGitDiff;
  $('#ai-openai-key-row')?.toggleAttribute('hidden', isLocal);
  $('#ai-clear-api-key')?.toggleAttribute('hidden', isLocal);
  const modelsList = $('#ai-local-models');
  if (modelsList) {
    modelsList.replaceChildren();
    if (isLocal) (state.aiStatus?.availableModels || []).forEach((model) => {
      const option = document.createElement('option');
      option.value = model;
      modelsList.appendChild(option);
    });
  }

  const hasKey = state.aiStatus?.hasApiKey === true;
  const available = isLocal
    ? state.aiStatus?.connected === true && state.aiStatus?.modelAvailable === true
    : hasKey;
  if (statusEl) {
    const models = state.aiStatus?.availableModels || [];
    statusEl.textContent = isLocal
      ? !state.aiStatus?.connected
        ? (state.aiStatus?.connectionError || 'LM Studio offline. Start Local Server at 127.0.0.1:1234.')
        : available
          ? `LM Studio connected at 127.0.0.1:1234. Model ${settings.model} available (${models.length} listed).`
          : `LM Studio connected. Model ${settings.model} not listed. Select a loaded model (${models.join(', ') || 'none'}).`
      : hasKey
        ? 'OpenAI API key saved locally.'
        : 'OpenAI API key not saved. Choose LM Studio for free local inference.';
    statusEl.classList.toggle('ok', available);
    statusEl.classList.toggle('warning', !available);
  }

  const aiButtonsDisabled = !settings.enabled || !available;
  $('#tool-generate-ai-report')?.toggleAttribute('disabled', aiButtonsDisabled);
  $('#session-report-ai-generate')?.toggleAttribute('disabled', aiButtonsDisabled);
  $('#ai-project-inspect')?.toggleAttribute('disabled', !settings.enabled || !isLocal || !available);
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
      const local = getAiSettingsClient().provider === 'lmstudio';
      const ready = local ? state.aiStatus?.connected && state.aiStatus?.modelAvailable : state.aiStatus?.hasApiKey;
      showToast(ready ? (local ? 'LM Studio model ready.' : 'OpenAI key saved.') : (local ? 'LM Studio model is not available.' : 'Add an OpenAI API key.'), 4500, ready ? 'success' : 'warning');
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

  const provider = $('#ai-provider-select')?.value === 'openai' ? 'openai' : 'lmstudio';
  const apiKey = provider === 'openai' ? ($('#ai-openai-api-key')?.value.trim() || '') : '';
  const fallbackModel = provider === 'openai' ? 'gpt-5.5' : 'qwen/qwen3.5-9b';
  const model = ($('#ai-openai-model')?.value || fallbackModel).trim().replace(/\s+/g, '') || fallbackModel;

  state.settings.ai = {
    enabled: $('#ai-reports-enabled-toggle')?.checked === true,
    provider,
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

    const ready = aiSettings.provider === 'lmstudio'
      ? state.aiStatus?.connected === true && state.aiStatus?.modelAvailable === true
      : state.aiStatus?.hasApiKey === true;
    if (!ready) {
      showToast(aiSettings.provider === 'lmstudio' ? 'Load the selected model in LM Studio, then check AI status.' : 'Add your OpenAI API key in Settings → AI first.', 7000, 'warning');
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
        `Generated by ${aiSettings.provider === 'lmstudio' ? 'local LM Studio' : 'OpenAI'} (${result.model || aiSettings.model})`,
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

async function inspectActiveProjectWithLocalAi() {
  const button = $('#ai-project-inspect');
  const answer = $('#ai-project-answer');
  const question = $('#ai-project-question')?.value.trim() || '';
  const session = getActiveAiReportSession();
  if (!session) {
    showToast('Select a local or SSH terminal session first.', 6000, 'warning');
    return;
  }
  if (!question) {
    showToast('Enter a question for the project inspector.', 4500, 'warning');
    return;
  }
  if (getAiSettingsClient().provider !== 'lmstudio') {
    showToast('Select LM Studio as your AI provider first.', 4500, 'warning');
    return;
  }
  button.disabled = true;
  answer.value = 'Reading available project evidence and asking LM Studio...';
  try {
    const payload = collectAiProjectReportPayload();
    // Send no report text; backend only needs the selected terminal and command context.
    delete payload.baseReport;
    payload.question = question;
    payload.sourcePaths = $('#ai-project-paths')?.value || '';
    const result = await window.advanceTerminal.inspectAiProject(payload);
    if (!result?.ok) throw new Error(result?.error || 'No analysis was returned.');
    answer.value = result.text;
    if (result.remoteLimited) {
      showToast('Analysis completed using terminal activity only; remote source files were not read.', 6500, 'warning');
    } else {
      showToast('Read-only project analysis completed.', 3500, 'success');
    }
  } catch (error) {
    answer.value = `LM Studio analysis failed: ${error.message}`;
    showToast(`LM Studio: ${error.message}`, 8500, 'error');
  } finally {
    button.disabled = false;
    updateAiSettingsControls();
  }
}

function getTodayUsageDay() {
  if (!state.settings) return createEmptyReportDay();
  const today = todayReportDateKey();
  const usage = state.settings.reportUsage;
  // This is called for terminal output and input. Normalizing 90 days of
  // report history on every chunk was unnecessary and became costly over time.
  if (!usage || typeof usage !== 'object' || !usage.days || !usage.days[today]) {
    state.settings.reportUsage = normalizeReportUsageClient(usage);
    if (!state.settings.reportUsage.days[today]) {
      state.settings.reportUsage.days[today] = createEmptyReportDay(today);
    }
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

function scheduleUsagePersist() {
  if (state.usagePersistTimer || state.usagePersistInFlight) {
    if (state.usagePersistInFlight) state.usagePersistAgain = true;
    return;
  }
  const sinceLastSave = Date.now() - Number(state.usageLastSavedAt || 0);
  const delay = Math.max(USAGE_SAVE_DEBOUNCE_MS, USAGE_SAVE_MIN_INTERVAL_MS - sinceLastSave);
  state.usagePersistTimer = setTimeout(() => {
    state.usagePersistTimer = null;
    persistReportUsage().catch((error) => {
      showToast(`Activity report save failed: ${error.message}`, 7000, 'error');
    });
  }, delay);
}

function markUsageDirty(persistSoon = true) {
  const day = getTodayUsageDay();
  day.updatedAt = new Date().toISOString();
  state.usageRevision += 1;
  if (persistSoon) scheduleUsagePersist();
}

async function persistReportUsage() {
  if (!state.settings || !window.advanceTerminal?.saveSettings) return;

  if (state.usagePersistTimer) {
    clearTimeout(state.usagePersistTimer);
    state.usagePersistTimer = null;
  }
  if (state.usagePersistInFlight) {
    state.usagePersistAgain = true;
    return;
  }

  state.usagePersistInFlight = true;
  const submittedRevision = state.usageRevision;
  try {
    const usageToSave = normalizeReportUsageClient(state.settings.reportUsage);
    // Send a separate report payload: settings saves may occur simultaneously.
    if (window.advanceTerminal.saveReportUsage) {
      const persisted = await window.advanceTerminal.saveReportUsage(usageToSave);
      if (state.usageRevision === submittedRevision) {
        state.settings.reportUsage = persisted;
      } else {
        // Usage changed during IPC; keep the newer in-memory counters.
        state.usagePersistAgain = true;
      }
    } else {
      const persisted = await window.advanceTerminal.saveSettings(state.settings);
      if (state.usageRevision === submittedRevision && !state.settingsSaveBatch) {
        state.settings = persisted;
      } else {
        state.usagePersistAgain = true;
      }
    }
    state.usageLastSavedAt = Date.now();
  } finally {
    state.usagePersistInFlight = false;
    if (state.usagePersistAgain) {
      state.usagePersistAgain = false;
      scheduleUsagePersist();
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

function runSettingsSaveQueue() {
  if (state.settingsSaveInFlight || state.settingsSaveTimer || !state.settingsSaveBatch) return;
  state.settingsSaveInFlight = true;

  (async () => {
    try {
      while (state.settingsSaveBatch && !state.settingsSaveTimer) {
        const batch = state.settingsSaveBatch;
        state.settingsSaveBatch = null;
        try {
          state.settings.selectedServerId = state.selectedServerId;
          state.settings.reportOptions = normalizeReportOptionsClient(state.settings.reportOptions);
          const saved = await window.advanceTerminal.saveSettings(state.settings);
          // Don't clobber edits queued while the previous IPC save was running.
          if (!state.settingsSaveBatch) state.settings = saved;

          if (batch.refresh) {
            updateConnectionGroupDatalist();
            renderServerList();
            renderCommandList();
            renderTerminalToolbarActions();
            renderAuditLog();
            if (state.activeSettingsTab === 'terminal-actions') renderTerminalActionList();
          }
          if (batch.toastMessage) showToast(batch.toastMessage);
          appendActivityFeedEvent('Settings saved.', 'system', { dedupeMs: 3500 });
          batch.waiters.forEach(({ resolve }) => resolve(state.settings));
        } catch (error) {
          showToast(`Settings save failed: ${error.message}`, 7000, 'error');
          batch.waiters.forEach(({ reject }) => reject(error));
        }
      }
    } finally {
      state.settingsSaveInFlight = false;
      if (state.settingsSaveBatch && !state.settingsSaveTimer) runSettingsSaveQueue();
    }
  })().catch((error) => {
    showToast(`Settings save queue error: ${error.message}`, 7000, 'error');
  });
}

function scheduleSettingsSave({ toastMessage = '', refresh = false, delay = SETTINGS_SAVE_DEBOUNCE_MS } = {}) {
  if (!state.settings || !window.advanceTerminal?.saveSettings) {
    return Promise.resolve(state.settings);
  }

  if (!state.settingsSaveBatch) {
    state.settingsSaveBatch = { toastMessage: '', refresh: false, waiters: [] };
  }
  const batch = state.settingsSaveBatch;
  batch.refresh = batch.refresh || refresh;
  if (toastMessage) batch.toastMessage = toastMessage;
  const result = new Promise((resolve, reject) => batch.waiters.push({ resolve, reject }));

  if (state.settingsSaveTimer) clearTimeout(state.settingsSaveTimer);
  state.settingsSaveTimer = null;
  if (delay > 0) {
    state.settingsSaveTimer = setTimeout(() => {
      state.settingsSaveTimer = null;
      runSettingsSaveQueue();
    }, delay);
  } else {
    runSettingsSaveQueue();
  }
  return result;
}

function saveSettingsNow({ toastMessage = '', refresh = true } = {}) {
  return scheduleSettingsSave({ toastMessage, refresh, delay: 0 });
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


// The V7 push flyout displays every Settings section in one scrollable list.
// Each section has existing on-demand initialization; load its read-only data
// only when Settings is explicitly opened (never from terminal input handlers).
function populateUnifiedSettingsFlyout() {
  if (window.v7PushFlyout?.active !== 'settings') return;
  updatePasteProtectionControls();
  renderTerminalActionsSettings();
  void refreshAiStatus({ silent: true });
  void refreshSshKeys({ silent: true });
  void refreshUpdateStatus();
  const scroller = $('#settings-view .settings-content');
  if (scroller) scroller.scrollTop = 0;
}

function setActiveView(view, toolbarPanel = null) {
  // Legacy View commands now open the same Appearance category inside Settings.
  if (view === 'view') {
    setActiveView('settings', 'settings');
    setSettingsTab('appearance');
    return;
  }
  // The optional V7 push panel keeps the live terminal mounted while displaying
  // the existing Settings, Report, Help, and Appearance views beside it.
  if (window.v7PushFlyout && window.v7PushFlyout.openPage(view)) {
    if (view === 'settings') {
      renderSettings();
      populateUnifiedSettingsFlyout();
    }
    if (view === 'report') setReportTab(state.activeReportTab || 'options');
    if (view === 'about') setHelpTab(state.activeHelpTab || 'about');
    if (view === 'view') updateNotificationPositionControls(getNotificationPosition());
    return;
  }
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
    'recovery',
    'ai',
    'reports',
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

  const allowedTabs = new Set(['appearance', 'safety', 'terminal-actions', 'ai', 'keys', 'recovery', 'updates']);
  const normalizedTab = allowedTabs.has(tab) ? tab : 'safety';

  state.activeSettingsTab = normalizedTab;
  $$('.settings-tab').forEach((item) => {
    item.classList.toggle('active', item.dataset.settingsTab === normalizedTab);
  });

  $$('.settings-section').forEach((item) => item.classList.remove('active'));
  $(`#settings-tab-${normalizedTab}`)?.classList.add('active');

  if (normalizedTab === 'appearance') {
    updateThemeControls(getUiTheme());
    updateNotificationPositionControls(getNotificationPosition());
    updateInAppToastModeControl();
  }

  if (normalizedTab === 'safety') {
    updatePasteProtectionControls();
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

  if (action === 'repair-settings') {
    setActiveView('settings', 'settings');
    setSettingsTab('safety');
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
    const tab = button.dataset.settingsTab || 'safety';
    setSettingsTab(tab);
    if (window.v7PushFlyout?.active === 'settings') {
      const scroller = $('#settings-view .settings-content');
      const section = $(`#settings-tab-${tab}`);
      if (scroller && section) {
        scroller.scrollTop += section.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      }
    }
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

// Transient visual feedback only. Never persist it to settings or delay terminal input.
const terminalActionFeedback = new Map();
const TERMINAL_ACTION_FEEDBACK_MS = 1700;

function confirmTerminalToolbarAction(actionId) {
  const key = String(actionId || '');
  if (!key) {
    return;
  }

  const previous = terminalActionFeedback.get(key);
  if (previous) {
    clearTimeout(previous.timer);
  }

  const entry = { timer: null };
  terminalActionFeedback.set(key, entry);

  const apply = (confirmed) => {
    $$('.dynamic-terminal-action').forEach((button) => {
      if (button.dataset.terminalActionId === key) {
        button.classList.toggle('is-action-confirmed', confirmed);
      }
    });
  };

  apply(true);
  entry.timer = setTimeout(() => {
    if (terminalActionFeedback.get(key) !== entry) {
      return;
    }
    terminalActionFeedback.delete(key);
    apply(false);
  }, TERMINAL_ACTION_FEEDBACK_MS);
}

function renderTerminalToolbarActions() {
  const container = $('#terminal-toolbar-actions');

  if (!container) {
    return;
  }

  const actions = getTerminalToolbarActions().filter((action) => action.enabled !== false);
  container.innerHTML = '';

  if (!actions.length) {
    const empty = document.createElement('div');
    empty.className = 'terminal-toolbar-empty';
    empty.textContent = 'No terminal toolbar actions enabled. Open Settings → Terminal Actions.';
    container.appendChild(empty);
    return;
  }

  actions.forEach((action) => {
    const button = document.createElement('button');
    button.className = `tool-button terminal-action-button dynamic-terminal-action terminal-action-kind-${action.action}`;
    button.type = 'button';
    button.title = action.action === 'sendText'
      ? `Send: ${action.text || action.name}`
      : action.name;
    button.dataset.terminalAction = action.action;
    button.dataset.terminalActionId = action.id;
    button.dataset.defaultTitle = button.title;
    if (terminalActionFeedback.has(action.id)) {
      button.classList.add('is-action-confirmed');
    }
    button.innerHTML = `
      <span class="tool-icon">${terminalActionIconSvg(action.icon)}</span>
      <span></span>
    `;

    button.querySelector('span:last-child').textContent = action.name;
    button.addEventListener('click', () => {
      // The terminal action starts immediately; feedback never blocks the command.
      executeTerminalToolbarAction(action)
        .then((succeeded) => {
          if (succeeded === true) {
            confirmTerminalToolbarAction(action.id);
          }
        })
        .catch((error) => {
          showToast(`${action.name} failed: ${error.message}`, 7000, 'error');
        });
    });

    container.appendChild(button);
  });

  updateTerminalInteractionState();
}

async function executeTerminalToolbarAction(action) {
  const normalized = normalizeTerminalToolbarAction(action);
  const session = state.terminals.get(state.activeTerminalId) || null;
  const allowedWhileBusy = terminalActionAllowedWhileProcessing(normalized.action);

  if (!allowedWhileBusy && session && !guardTerminalAction(session, normalized.name || 'Terminal action', normalized.action)) {
    return false;
  }

  if (!allowedWhileBusy && state.terminalActionInFlightSessionIds.has(session?.terminalId)) {
    showToast('Please wait for this terminal action to finish.', 4000, 'warning');
    return false;
  }

  const runAction = async () => {
    switch (normalized.action) {
      case 'clear':
        return clearActiveTerminal();
      case 'copyAll':
        return await copyAllActiveTerminal();
      case 'copySelection':
        return await copySelectedTerminalText();
      case 'paste':
        return await pasteClipboardToTerminal();
      case 'ctrlC':
        return sendControlToActiveTerminal('\x03', normalized.name || 'Ctrl+C');
      case 'ctrlL':
        return sendControlToActiveTerminal('\x0c', normalized.name || 'Ctrl+L');
      case 'ctrlD':
        return sendControlToActiveTerminal('\x04', normalized.name || 'Ctrl+D');
      case 'closeSession':
        return closeTerminalSession(null, { force: true });
      case 'sendText':
        return await sendCommandToActiveTerminal(normalized.text || '');
      default:
        showToast(`Unknown terminal action: ${normalized.action}`);
        return false;
    }
  };

  if (allowedWhileBusy) {
    return await runAction();
  }

  // An in-flight clipboard/confirmation action must not disable another tab.
  const terminalId = session?.terminalId || null;
  if (terminalId) state.terminalActionInFlightSessionIds.add(terminalId);
  updateTerminalInteractionState();

  try {
    return await runAction();
  } finally {
    if (terminalId) state.terminalActionInFlightSessionIds.delete(terminalId);
    updateTerminalInteractionState();
  }
}

function renderTerminalActionIconPicker(selectedIcon = null) {
  const picker = $('#terminal-action-icon-picker');

  if (!picker) {
    return;
  }

  const selected = selectedIcon || $('#terminal-action-icon')?.value || getSelectedTerminalAction()?.icon || 'terminal';
  picker.innerHTML = '';

  Object.entries(TERMINAL_ACTION_ICONS).forEach(([icon, svg]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `terminal-action-icon-option ${icon === selected ? 'active' : ''}`;
    button.dataset.icon = icon;
    button.title = TERMINAL_ACTION_ICON_LABELS[icon] || icon;
    button.innerHTML = `
      <span>${svg}</span>
      <small></small>
    `;
    button.querySelector('small').textContent = TERMINAL_ACTION_ICON_LABELS[icon] || icon;

    button.addEventListener('click', () => {
      $('#terminal-action-selected-icon').value = icon;
      renderTerminalActionIconPicker(icon);
    });

    picker.appendChild(button);
  });
}

function renderTerminalActionList() {
  const list = $('#terminal-action-list');

  if (!list || !state.settings) {
    return;
  }

  const actions = getTerminalToolbarActions();
  list.innerHTML = '';

  actions.forEach((action, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `terminal-action-list-item ${action.id === state.editingTerminalActionId ? 'active' : ''}`;
    item.innerHTML = `
      <span class="terminal-action-list-icon">${terminalActionIconSvg(action.icon)}</span>
      <span class="terminal-action-list-main">
        <strong></strong>
        <small></small>
      </span>
      <span class="terminal-action-list-order"></span>
    `;

    item.querySelector('strong').textContent = action.name || 'Terminal Action';
    item.querySelector('small').textContent = action.enabled === false ? 'Hidden from toolbar' : action.action;
    item.querySelector('.terminal-action-list-order').textContent = String(index + 1);

    item.addEventListener('click', () => loadTerminalActionIntoManager(action.id));
    list.appendChild(item);
  });

  if (!actions.length) {
    const empty = document.createElement('div');
    empty.className = 'manage-command-empty';
    empty.textContent = 'No terminal actions yet.';
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

function updateTerminalActionFormVisibility() {
  const kind = $('#terminal-action-kind')?.value || 'clear';
  $('#terminal-action-text-row')?.classList.toggle('hidden', kind !== 'sendText');
}

function fillTerminalActionForm(action) {
  const normalized = normalizeTerminalToolbarAction(action || {
    name: 'New Action',
    action: 'sendText',
    icon: 'terminal',
    text: '',
    enabled: true
  });

  $('#terminal-action-name').value = normalized.name;
  $('#terminal-action-kind').value = normalized.action;
  $('#terminal-action-text').value = normalized.text;
  $('#terminal-action-enabled').checked = normalized.enabled !== false;

  let hiddenIcon = $('#terminal-action-selected-icon');
  if (!hiddenIcon) {
    hiddenIcon = document.createElement('input');
    hiddenIcon.type = 'hidden';
    hiddenIcon.id = 'terminal-action-selected-icon';
    $('#settings-tab-terminal-actions')?.appendChild(hiddenIcon);
  }

  hiddenIcon.value = normalized.icon;
  updateTerminalActionFormVisibility();
  renderTerminalActionIconPicker(normalized.icon);
  updateTerminalActionMoveButtons();
}

function loadTerminalActionIntoManager(actionId) {
  state.editingTerminalActionId = actionId || null;
  fillTerminalActionForm(getSelectedTerminalAction());
  renderTerminalActionList();
  $('#terminal-action-name')?.focus();
}

function newTerminalActionFromManager() {
  state.editingTerminalActionId = null;
  fillTerminalActionForm({
    name: 'New Action',
    action: 'sendText',
    icon: 'terminal',
    text: '',
    enabled: true
  });
  renderTerminalActionList();
  $('#terminal-action-name')?.select();
}

async function saveTerminalActionFromManager() {
  const name = $('#terminal-action-name').value.trim();
  const actionKind = $('#terminal-action-kind').value;
  const text = $('#terminal-action-text').value.trim();
  const icon = $('#terminal-action-selected-icon')?.value || 'terminal';
  const enabled = $('#terminal-action-enabled').checked;

  if (!name) {
    showToast('Terminal action needs a name.');
    return;
  }

  if (actionKind === 'sendText' && !text) {
    showToast('Send Text action needs text or a command to send.');
    return;
  }

  const actions = getTerminalToolbarActions();
  const action = normalizeTerminalToolbarAction({
    id: state.editingTerminalActionId || randomId('term-action'),
    name,
    action: actionKind,
    icon,
    text,
    enabled
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
  showToast('Terminal action saved.');
}

async function duplicateTerminalActionFromManager() {
  const selected = getSelectedTerminalAction();

  if (!selected) {
    showToast('Select a terminal action to duplicate.');
    return;
  }

  const duplicate = {
    ...selected,
    id: randomId('term-action'),
    name: `${selected.name || 'Terminal Action'} Copy`
  };

  state.settings.terminalActions = [...getTerminalToolbarActions(), duplicate];
  await saveSettings();
  state.editingTerminalActionId = duplicate.id;
  renderTerminalActionList();
  fillTerminalActionForm(duplicate);
  renderTerminalToolbarActions();
  showToast('Terminal action duplicated.');
}

async function deleteTerminalActionFromManager() {
  const selected = getSelectedTerminalAction();

  if (!selected) {
    showToast('Select a terminal action to delete.');
    return;
  }

  const confirmed = confirm(`Delete terminal action "${selected.name || 'selected action'}"?`);

  if (!confirmed) {
    return;
  }

  state.settings.terminalActions = getTerminalToolbarActions().filter((item) => item.id !== selected.id);
  await saveSettings();

  const next = getTerminalToolbarActions()[0] || null;
  state.editingTerminalActionId = next?.id || null;
  renderTerminalActionList();
  fillTerminalActionForm(next || {
    name: 'New Action',
    action: 'sendText',
    icon: 'terminal',
    text: '',
    enabled: true
  });
  renderTerminalToolbarActions();
  showToast('Terminal action deleted.');
}

async function moveTerminalActionFromManager(direction) {
  const actions = getTerminalToolbarActions();
  const index = actions.findIndex((item) => item.id === state.editingTerminalActionId);

  if (index < 0) {
    showToast('Select a terminal action to move.');
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
  showToast('Terminal action order updated.');
}

async function resetTerminalActionsToDefault() {
  const confirmed = confirm('Reset Terminal Actions to default toolbar actions?');

  if (!confirmed) {
    return;
  }

  state.settings.terminalActions = getDefaultTerminalActions();
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

  getCommands().forEach((command) => {
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
    return false;
  }

  if (!session || session.closed) {
    showToast('Open or connect a terminal first.');
    setActiveView('terminal');
    return false;
  }

  if (!guardTerminalAction(session, commandConfig.name || 'Run Command', 'sendText')) {
    return false;
  }

  const resolved = resolveCommandVariables(template);

  if (!resolved) {
    showToast('Command shortcut cancelled.', 3500, 'warning');
    return false;
  }

  const command = String(resolved.command || '').trim();

  if (!command) {
    showToast('Command shortcut is empty.');
    return false;
  }

  const allowed = await confirmRiskyCommandIfNeeded(commandConfig, {
    ...resolved,
    command
  });

  if (!allowed) {
    return false;
  }

  const payload = `${command.replace(/\r?\n/g, '\r')}\r`;
  const logDescription = describeCommandForLog(commandConfig, resolved);

  setActiveView('terminal');

  const sshLockResult = inspectSshLockedTerminalData(session, payload);

  if (sshLockResult.blocked) {
    showSshPathLockBlocked(session, sshLockResult.reason);
    return false;
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
  return true;
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

// Toggle only the visual group picker; existing select and filtering logic remain unchanged.
function setConnectionGroupFilterPopoverOpen(open, restoreFocus = false) {
  const popover = $('#connection-group-filter-popover');
  const toggle = $('#connection-group-filter-toggle');
  if (!popover || !toggle) return;

  const shouldOpen = Boolean(open);
  popover.hidden = !shouldOpen;
  toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  if (shouldOpen) {
    renderConnectionGroupOptions();
    $('#connection-group-filter')?.focus();
  } else if (restoreFocus) {
    toggle.focus();
  }
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
    button.setAttribute('aria-label', button.title);
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
  state.settings = await saveSettingsNow({ toastMessage: '', refresh: false });
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

  state.settings = await saveSettingsNow({ toastMessage: '', refresh: false });
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
  state.settings = await saveSettingsNow({ toastMessage: '', refresh: false });
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

  state.settings = await saveSettingsNow({ toastMessage: '', refresh: false });
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
  scheduleSettingsSave({ refresh: false, delay: 1500 }).catch(() => {});
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
    scheduleSettingsSave({ refresh: false }).catch(() => {});

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
    scheduleSettingsSave({ refresh: false }).catch(() => {});
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

  // A connection finishing in the background must not select its tab again,
  // nor pull the user away from Settings or Reports or close another dialog.
  if (state.activeTerminalId !== session.terminalId || state.activeView !== 'terminal') {
    updateTerminalTabWorkingIndicator(session);
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


function getTerminalTabRects() {
  const rects = new Map();

  $$('.terminal-tab').forEach((tab) => {
    if (tab.dataset.terminalId) {
      rects.set(tab.dataset.terminalId, tab.getBoundingClientRect());
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
      const previousRect = previousRects.get(tab.dataset.terminalId);

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

function getTerminalTabSlideTarget(draggedTerminalId, clientX) {
  const tabs = $$('.terminal-tab')
    .filter((tab) => tab.dataset.terminalId && tab.dataset.terminalId !== draggedTerminalId);

  if (!tabs.length) {
    return null;
  }

  for (const tab of tabs) {
    const rect = tab.getBoundingClientRect();

    if (clientX < rect.left + (rect.width / 2)) {
      return {
        terminalId: tab.dataset.terminalId,
        placement: 'before',
        tab
      };
    }
  }

  const lastTab = tabs[tabs.length - 1];
  return {
    terminalId: lastTab.dataset.terminalId,
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

function beginTerminalTabSlideDrag(tab, session, event) {
  if (event.button !== 0 || event.target.closest('.terminal-tab-close')) {
    return;
  }

  const tabs = $('#terminal-tabs');
  const tabRect = tab.getBoundingClientRect();
  const rowRect = tabs?.getBoundingClientRect();

  state.draggingTerminalId = session.terminalId;
  state.terminalTabDrag = {
    terminalId: session.terminalId,
    pointerId: event.pointerId,
    tab,
    startX: event.clientX,
    startY: event.clientY,
    startRect: tabRect,
    rowRect,
    moved: false,
    targetTerminalId: null,
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

  const target = getTerminalTabSlideTarget(drag.terminalId, event.clientX);
  drag.targetTerminalId = target?.terminalId || null;
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
  const targetTerminalId = drag.targetTerminalId;
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

    if (commit && targetTerminalId) {
      reorderTerminalTab(drag.terminalId, targetTerminalId, placement);
    }

    event?.preventDefault();
    return;
  }

  if (commit) {
    activateTerminalAndFocus(drag.terminalId);
  }
}

function reorderTerminalTab(draggedTerminalId, targetTerminalId, placement = 'before') {
  if (!draggedTerminalId || !targetTerminalId || draggedTerminalId === targetTerminalId) {
    return false;
  }

  if (!state.terminals.has(draggedTerminalId) || !state.terminals.has(targetTerminalId)) {
    return false;
  }

  const previousRects = getTerminalTabRects();
  const entries = Array.from(state.terminals.entries());
  const draggedEntry = entries.find(([terminalId]) => terminalId === draggedTerminalId);

  if (!draggedEntry) {
    return false;
  }

  const orderedEntries = entries.filter(([terminalId]) => terminalId !== draggedTerminalId);
  const targetIndex = orderedEntries.findIndex(([terminalId]) => terminalId === targetTerminalId);

  if (targetIndex < 0) {
    return false;
  }

  const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
  orderedEntries.splice(insertIndex, 0, draggedEntry);
  state.terminals = new Map(orderedEntries);
  movePinnedTerminalTabsFirst();
  persistSavedTerminalSessions();

  const draggedSession = draggedEntry[1];
  appendActivityFeedEvent(`Moved terminal tab: ${draggedSession.server?.name || draggedTerminalId}.`, 'action', { dedupeMs: 800 });
  renderTerminalTabs();
  animateTerminalTabLayout(previousRects);
  updateCurrentTabFooter();
  fitActiveTerminal();

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

function showTerminalTabPicker(button, { typeFilter = 'all' } = {}) {
  closeTerminalTabPicker();

  const menu = document.createElement('div');
  menu.id = 'terminal-tab-picker-menu';
  menu.className = 'terminal-tab-picker-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Open saved terminal');

  const servers = sortConnectionsForDisplay([...(state.settings?.servers || [])]);
  const visibleServers = servers.filter((server) => typeFilter === 'all' || (typeFilter === 'local' ? server.type === 'local' : server.type !== 'local'));
  const groups = [
    {
      label: 'Local terminals',
      servers: visibleServers.filter((server) => server.type === 'local')
    },
    {
      label: 'SSH connections',
      servers: visibleServers.filter((server) => server.type !== 'local')
    }
  ].filter((group) => group.servers.length > 0);

  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'terminal-tab-picker-empty';
    empty.textContent = 'No saved terminals are available.';
    menu.appendChild(empty);
  } else {
    groups.forEach((group) => {
      const section = document.createElement('section');
      section.className = 'terminal-tab-picker-section';

      const heading = document.createElement('div');
      heading.className = 'terminal-tab-picker-heading';
      heading.textContent = group.label;
      section.appendChild(heading);

      group.servers.forEach((server) => {
        section.appendChild(createTerminalTabPickerItem(server));
      });

      menu.appendChild(section);
    });
  }

  menu.addEventListener('keydown', (event) => {
    const items = Array.from(menu.querySelectorAll('.terminal-tab-picker-item'));

    if (event.key === 'Escape') {
      event.preventDefault();
      closeTerminalTabPicker({ restoreFocus: true });
      closeTerminalTabContextMenu();
      closeTerminalTabRenameOverlay();
      return;
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
    menu.querySelector('.terminal-tab-picker-item')?.focus();
  });
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

    if (terminalTabPickerMenu) {
      closeTerminalTabPicker({ restoreFocus: true });
      return;
    }

    showTerminalTabPicker(addButton);
  });

  actions.appendChild(separator);
  actions.appendChild(addButton);
  tabs.appendChild(actions);
}

// Persist the Sessions sidebar (Pinned and Sessions List), including one-level
// submenus and ordering. Only saved connection IDs and visual metadata are
// stored; never save shell input/output, credentials, tokens, or PTY state.
// An older pinned-only manifest is read once if no v7 manifest exists.
const PINNED_TERMINAL_TABS_STORAGE_KEY = 'advanceTerminal.v5.pinnedTerminalTabs';
const SAVED_TERMINAL_SESSIONS_STORAGE_KEY = 'advanceTerminal.v7.savedTerminalSessions';
const MAX_SAVED_TERMINAL_SESSIONS = 256;
const MAX_RECENTLY_CLOSED_TERMINAL_TABS = 12;
let terminalTabContextMenu = null;
let terminalTabRenameOverlay = null;

function normalizeTerminalTabTitle(value) {
  return String(value || '').replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 60);
}

function normalizeTerminalTabColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : '';
}

function getTerminalTabTitle(session) {
  return normalizeTerminalTabTitle(session?.tabCustomTitle) || session?.server?.name || 'Terminal';
}

function closeTerminalTabContextMenu() {
  terminalTabContextMenu?.remove();
  terminalTabContextMenu = null;
}

// Each sidebar session is stored exactly once, nested under its parent if any.
// Parents precede their children so parentIndex can be restored without using
// unstable runtime terminal IDs. Unpinned sessions are no longer thrown away.
function persistSavedTerminalSessions() {
  const all = Array.from(state.terminals.values())
    .filter((session) => session.pendingReconnectReplacement !== true);
  if (all.length > MAX_SAVED_TERMINAL_SESSIONS) return false;
  const roots = getV7OrderedSessions(all.filter((session) => !getV7SessionParent(session)));
  const pinnedRoots = roots.filter((session) => session.tabPinned === true);
  const otherRoots = roots.filter((session) => session.tabPinned !== true);
  const snapshots = [];
  const addSnapshot = (session, parentIndex = -1) => {
    const quickLocalShell = ['powershell', 'cmd'].includes(session.server?.quickLocalShell)
      ? session.server.quickLocalShell : '';
    const serverId = quickLocalShell ? '' : String(session.server?.id || '');
    if (!quickLocalShell && !serverId) return;
    snapshots.push({
      serverId,
      ...(quickLocalShell ? { quickLocalShell } : {}),
      title: normalizeTerminalTabTitle(session.tabCustomTitle),
      color: normalizeTerminalTabColor(session.tabColor),
      pinned: parentIndex < 0 && session.tabPinned === true,
      parentIndex,
      collapsed: parentIndex < 0 && session.v7Collapsed === true
    });
  };
  for (const root of [...pinnedRoots, ...otherRoots]) {
    const parentIndex = snapshots.length;
    addSnapshot(root);
    if (snapshots.length === parentIndex) continue;
    getV7SessionChildren(root.terminalId).forEach((child) => addSnapshot(child, parentIndex));
  }
  try {
    localStorage.setItem(SAVED_TERMINAL_SESSIONS_STORAGE_KEY, JSON.stringify(snapshots));
    return true;
  } catch (_) {
    return false;
  }
}

function readSavedTerminalSessions() {
  try {
    const raw = localStorage.getItem(SAVED_TERMINAL_SESSIONS_STORAGE_KEY);
    // Existing v5 pinned tabs (and their submenus) migrate into the new list.
    // A deliberately empty v7 list must NOT resurrect previously closed tabs.
    const data = raw === null ? localStorage.getItem(PINNED_TERMINAL_TABS_STORAGE_KEY) : raw;
    if (!data || data.length > 250000) return [];
    const snapshots = JSON.parse(data);
    if (!Array.isArray(snapshots)) return [];
    return snapshots.slice(0, MAX_SAVED_TERMINAL_SESSIONS)
      .filter((item) => item && typeof item === 'object'
        && (typeof item.serverId === 'string' || ['powershell', 'cmd'].includes(item.quickLocalShell)))
      .map((item) => ({
        serverId: typeof item.serverId === 'string' ? item.serverId.slice(0, 150) : '',
        quickLocalShell: ['powershell', 'cmd'].includes(item.quickLocalShell) ? item.quickLocalShell : '',
        title: normalizeTerminalTabTitle(item.title),
        color: normalizeTerminalTabColor(item.color),
        pinned: item.pinned === true,
        parentIndex: Number.isSafeInteger(item.parentIndex) ? item.parentIndex : -1,
        collapsed: item.collapsed === true
      }));
  } catch (_) {
    return [];
  }
}

// Recreate navigation entries, not running processes. SSH connections and
// PowerShell/CMD start only after the user deliberately chooses Reconnect.
function restoreSavedTerminalSessions() {
  const servers = Array.isArray(state.settings?.servers) ? state.settings.servers : [];
  const snapshots = readSavedTerminalSessions();
  const restored = [];
  let firstId = null;
  for (let i = 0; i < snapshots.length; i += 1) {
    const snapshot = snapshots[i];
    const savedServer = servers.find((item) => item.id === snapshot.serverId);
    const server = snapshot.quickLocalShell
      ? createV7QuickLocalServer(snapshot.quickLocalShell)
      : savedServer || (snapshot.serverId ? {
          id: snapshot.serverId,
          type: 'remote',
          name: snapshot.title || 'Missing saved connection',
          missingSavedConnection: true
        } : null);
    if (!server) { restored.push(null); continue; }
    const terminalId = randomId('restored-tab');
    const session = createTerminalPane(terminalId, server, { restoredPinned: true, activate: false });
    session.tabCustomTitle = snapshot.title;
    session.tabColor = snapshot.color;
    session.v7SidebarOrder = i;
    session.v7Collapsed = snapshot.collapsed;
    const parent = snapshot.parentIndex >= 0 && snapshot.parentIndex < i
      ? restored[snapshot.parentIndex] : null;
    if (parent && !parent.v7ParentId) {
      session.v7ParentId = parent.terminalId;
      session.tabPinned = false;
    } else {
      session.tabPinned = snapshot.pinned;
    }
    cleanupTerminalSessionResources(session);
    session.term.writeln(server.missingSavedConnection
      ? '\r\n[Saved connection is unavailable. Re-create the connection or remove this entry.]\r\n'
      : '\r\n[Saved session restored. Click its sidebar entry to reconnect.]\r\n');
    restored.push(session);
    firstId = firstId || terminalId;
  }
  if (firstId) activateTerminal(firstId);
  // Write the migrated v7 format (including an empty list) once on startup.
  // The legacy manifest remains untouched for older app versions.
  persistSavedTerminalSessions();
  return Boolean(firstId);
}

function setTerminalTabPinned(terminalId, pinned) {
  const session = state.terminals.get(terminalId);
  if (!session) return false;
  const movingSection = Boolean(session.tabPinned) !== Boolean(pinned) || Boolean(session.v7ParentId);
  if (pinned && session.v7ParentId) session.v7ParentId = null;
  session.tabPinned = pinned === true;
  if (movingSection) session.v7SidebarOrder = getV7NextPeerOrder(null, session.tabPinned, terminalId);
  const stored = persistSavedTerminalSessions();
  renderTerminalTabs();
  showToast(stored
    ? `${getTerminalTabTitle(session)} ${session.tabPinned ? 'pinned' : 'unpinned'}.`
    : 'Tab updated for this session, but its pin could not be saved.',
    3200, stored ? 'success' : 'warning');
  return true;
}

function setTerminalTabColor(terminalId, color) {
  const session = state.terminals.get(terminalId);
  if (!session) return false;
  session.tabColor = normalizeTerminalTabColor(color);
  persistSavedTerminalSessions();
  renderTerminalTabs();
  return true;
}

function closeTerminalTabRenameOverlay() {
  terminalTabRenameOverlay?.remove();
  terminalTabRenameOverlay = null;
}

function openTerminalTabRenameModal(terminalId) {
  const session = state.terminals.get(terminalId);
  if (!session) return;
  closeTerminalTabContextMenu();
  closeTerminalTabRenameOverlay();

  const overlay = document.createElement('div');
  overlay.className = 'terminal-tab-rename-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'terminal-tab-rename-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Rename terminal tab');
  const label = document.createElement('label');
  label.textContent = 'Rename Tab';
  const input = document.createElement('input');
  input.className = 'terminal-tab-rename-input';
  input.type = 'text';
  input.maxLength = 60;
  input.value = getTerminalTabTitle(session);
  label.appendChild(input);
  const actions = document.createElement('div');
  actions.className = 'terminal-tab-rename-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'primary';
  save.textContent = 'Save';
  const finish = (shouldSave) => {
    if (shouldSave && state.terminals.has(terminalId)) {
      session.tabCustomTitle = normalizeTerminalTabTitle(input.value);
      persistSavedTerminalSessions();
      renderTerminalTabs();
      updateCurrentTabFooter();
    }
    closeTerminalTabRenameOverlay();
  };
  cancel.addEventListener('click', () => finish(false));
  save.addEventListener('click', () => finish(true));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); finish(true); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); }
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) finish(false);
  });
  actions.append(cancel, save);
  dialog.append(label, actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  terminalTabRenameOverlay = overlay;
  input.focus();
  input.select();
}

function rememberClosedTerminalTab(session) {
  if (!session?.hasConnected || !session.server?.id) return;
  state.closedTerminalTabs.unshift({
    serverId: session.server.quickLocalShell ? '' : session.server.id,
    quickLocalShell: session.server.quickLocalShell || '',
    title: normalizeTerminalTabTitle(session.tabCustomTitle),
    color: normalizeTerminalTabColor(session.tabColor)
  });
  state.closedTerminalTabs.length = Math.min(state.closedTerminalTabs.length, MAX_RECENTLY_CLOSED_TERMINAL_TABS);
}

// Always go through the normal connection/authentication path. No secrets or PTYs are cloned.
// Reconnecting an existing tab is not the same as opening a new tab: preserve
// the old slot, group, selection, and saved appearance while using the normal
// SSH authentication path to establish a fresh PTY/SSH engine.
async function openFreshTerminalTab(source, { replaceSession = null } = {}) {
  const quickLocalShell = ['powershell', 'cmd'].includes(source?.quickLocalShell) ? source.quickLocalShell : '';
  const server = quickLocalShell
    ? createV7QuickLocalServer(quickLocalShell)
    : state.settings?.servers?.find((item) => item.id === source?.serverId);
  if (!server) {
    showToast('Saved connection no longer exists.', 4000, 'warning');
    return false;
  }
  if (state.connectionAttemptInFlight || getConnectingTerminalSession()) {
    showToast('Wait for the current connection to finish.', 3500, 'warning');
    return false;
  }
  const replacing = replaceSession && state.terminals.get(replaceSession.terminalId) === replaceSession
    && replaceSession.closed ? replaceSession : null;
  if (replaceSession && !replacing) return false;
  const originalOrder = replacing ? Array.from(state.terminals.keys()) : null;
  const previouslyOpen = new Set(state.terminals.keys());
  if (!replacing && !quickLocalShell) selectServer(server.id);
  // Background mode does not activate an extra tab while SSH authenticates.
  await connectSelectedServer((replacing || quickLocalShell)
    ? { serverOverride: server, background: Boolean(replacing) } : {});
  const candidates = Array.from(state.terminals.values()).filter((session) => (
    !previouslyOpen.has(session.terminalId) && session.server?.id === server.id
  ));
  const fresh = candidates.find((session) => session.hasConnected && !session.closed);
  if (!fresh || (replacing && state.terminals.get(replacing.terminalId) !== replacing)) {
    // On cancellation/failure, keep the original disconnected tab and slot.
    // Do not leave a second error tab behind from a background reconnection.
    if (replacing) candidates.forEach((session) => {
      if (state.terminals.has(session.terminalId)) {
        closeTerminalSession(session.terminalId, { force: true, remember: false });
      }
    });
    return false;
  }

  fresh.tabCustomTitle = normalizeTerminalTabTitle(source.title);
  fresh.tabColor = normalizeTerminalTabColor(source.color);
  if (replacing) {
    fresh.tabPinned = replacing.tabPinned === true;
    fresh.v7ParentId = replacing.v7ParentId || null;
    fresh.v7Collapsed = replacing.v7Collapsed === true;
    fresh.v7SidebarOrder = replacing.v7SidebarOrder;
    const reparentChildren = getV7SessionChildren(replacing.terminalId).map((child) => child.terminalId);
    // Unsent text in the command composer belongs to the tab, not the PTY.
    if (v7ComposerMultilineModes.delete(replacing.terminalId)) {
      v7ComposerMultilineModes.add(fresh.terminalId);
    }
    if (v7ComposerDrafts.has(replacing.terminalId)) {
      v7ComposerDrafts.set(fresh.terminalId, v7ComposerDrafts.get(replacing.terminalId));
    }
    fresh.pendingReconnectReplacement = false;
    // Keep the user's current selection. If the old tab was selected,
    // the replacement becomes selected in the same position.
    if (state.activeTerminalId === replacing.terminalId) {
      state.activeTerminalId = fresh.terminalId;
    }
    closeTerminalSession(replacing.terminalId, { force: true, remember: false });
    reparentChildren.forEach((id) => {
      const child = state.terminals.get(id);
      if (child) child.v7ParentId = fresh.terminalId;
    });
    const orderedIds = originalOrder
      .map((id) => id === replacing.terminalId ? fresh.terminalId : id)
      .filter((id) => state.terminals.has(id));
    const orderedSet = new Set(orderedIds);
    for (const id of state.terminals.keys()) {
      if (!orderedSet.has(id)) orderedIds.push(id);
    }
    state.terminals = new Map(orderedIds.map((id) => [id, state.terminals.get(id)]));
  }
  persistSavedTerminalSessions();
  renderTerminalTabs();
  updateCurrentTabFooter();
  return true;
}

async function duplicateTerminalTab(terminalId) {
  const session = state.terminals.get(terminalId);
  if (!session) return false;
  return openFreshTerminalTab({
    serverId: session.server?.id,
    quickLocalShell: session.server?.quickLocalShell,
    title: session.tabCustomTitle,
    color: session.tabColor
  });
}

async function reopenLastClosedTerminalTab() {
  const snapshot = state.closedTerminalTabs[0];
  if (!snapshot) return false;
  const opened = await openFreshTerminalTab(snapshot);
  if (opened) state.closedTerminalTabs.shift();
  return opened;
}

async function reconnectTerminalTab(terminalId) {
  const session = state.terminals.get(terminalId);
  if (!session || !session.closed) return false;
  return openFreshTerminalTab({
    serverId: session.server?.id,
    quickLocalShell: session.server?.quickLocalShell,
    title: session.tabCustomTitle,
    color: session.tabColor
  }, { replaceSession: session });
}

function closeOtherTerminalTabs(terminalId) {
  if (!state.terminals.has(terminalId)) return 0;
  const ids = Array.from(state.terminals.values())
    .filter((session) => session.terminalId !== terminalId)
    .map((session) => session.terminalId);
  ids.forEach((id) => closeTerminalSession(id));
  return ids.length;
}

function closeTerminalTabsToRight(terminalId) {
  const entries = Array.from(state.terminals.values());
  const index = entries.findIndex((session) => session.terminalId === terminalId);
  if (index < 0) return 0;
  const ids = entries.slice(index + 1)
    .map((session) => session.terminalId);
  ids.forEach((id) => closeTerminalSession(id));
  return ids.length;
}

function terminalTabMenuButton(label, action, disabled = false, danger = false) {
  const button = document.createElement('button');
  button.className = `terminal-tab-context-item${danger ? ' danger' : ''}`;
  button.type = 'button';
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener('click', () => {
    closeTerminalTabContextMenu();
    Promise.resolve().then(action).catch((error) => {
      showToast(`Tab action failed: ${error.message}`, 5000, 'error');
    });
  });
  return button;
}

function showTerminalTabContextMenu(terminalId, clientX, clientY) {
  const session = state.terminals.get(terminalId);
  if (!session) return;
  closeTerminalTabContextMenu();
  closeTerminalTabPicker();
  hideSidebarContextMenu();

  const values = Array.from(state.terminals.values());
  const index = values.findIndex((item) => item.terminalId === terminalId);
  const menu = document.createElement('div');
  menu.className = 'terminal-tab-context-menu';
  menu.setAttribute('role', 'menu');
  const heading = document.createElement('div');
  heading.className = 'terminal-tab-context-heading';
  heading.textContent = getTerminalTabTitle(session);
  menu.append(
    heading,
    terminalTabMenuButton('Rename Tab', () => openTerminalTabRenameModal(terminalId)),
    terminalTabMenuButton(session.tabPinned ? 'Unpin Tab' : 'Pin Tab', () => setTerminalTabPinned(terminalId, !session.tabPinned)),
    terminalTabMenuButton('Duplicate Tab', () => duplicateTerminalTab(terminalId)),
    terminalTabMenuButton('Reconnect', () => reconnectTerminalTab(terminalId), !session.closed),
    ...(session.v7ParentId ? [terminalTabMenuButton('Move out of submenu', () => detachV7Session(terminalId))] : [])
  );
  const divider1 = document.createElement('div');
  divider1.className = 'terminal-tab-context-divider';
  menu.appendChild(divider1);
  const colorRow = document.createElement('div');
  colorRow.className = 'terminal-tab-context-color-row';
  const colorLabel = document.createElement('span');
  colorLabel.textContent = 'Tab Color';
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = normalizeTerminalTabColor(session.tabColor) || '#4f8fd8';
  picker.setAttribute('aria-label', 'Choose tab color');
  picker.addEventListener('input', () => setTerminalTabColor(terminalId, picker.value));
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => { setTerminalTabColor(terminalId, ''); closeTerminalTabContextMenu(); });
  colorRow.append(colorLabel, picker, reset);
  menu.appendChild(colorRow);
  const divider2 = document.createElement('div');
  divider2.className = 'terminal-tab-context-divider';
  menu.append(
    divider2,
    terminalTabMenuButton('Reopen Last Closed Tab', reopenLastClosedTerminalTab, !state.closedTerminalTabs.length),
    terminalTabMenuButton('Close Other Tabs', () => closeOtherTerminalTabs(terminalId), !values.some((item) => item.terminalId !== terminalId)),
    terminalTabMenuButton('Close Tabs to the Right', () => closeTerminalTabsToRight(terminalId), !values.slice(index + 1).length),
    terminalTabMenuButton('Close Tab', () => closeTerminalSession(terminalId, { force: true }), false, true)
  );
  document.body.appendChild(menu);
  terminalTabContextMenu = menu;
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(clientX || 8, window.innerWidth - rect.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(clientY || 8, window.innerHeight - rect.height - 8))}px`;
  requestAnimationFrame(() => menu.querySelector('button:not(:disabled)')?.focus());
}

function renderTerminalTabs() {
  closeTerminalTabPicker();

  const tabs = $('#terminal-tabs');
  tabs.innerHTML = '';

  const values = Array.from(state.terminals.values())
    .filter((session) => session.pendingReconnectReplacement !== true);
  tabs.classList.toggle('has-tabs', values.length > 0);

  values.forEach((session) => {
    const isActive = session.terminalId === state.activeTerminalId;
    const tab = document.createElement('div');
    tab.className = `terminal-tab ${isActive ? 'active' : ''}${session.tabPinned ? ' is-pinned' : ''}`;
    const tabColor = normalizeTerminalTabColor(session.tabColor);
    if (tabColor) {
      tab.style.setProperty('--custom-tab-color', tabColor);
      tab.classList.add('has-custom-color');
    }
    tab.dataset.terminalId = session.terminalId;
    tab.draggable = false;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('tabindex', '0');
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.title = `${session.server?.type === 'local' ? 'Local terminal' : 'SSH'}: ${getTerminalTabTitle(session)} - right-click for tab actions`;

    const inner = document.createElement('div');
    inner.className = 'terminal-tab-inner';

    const terminalType = session.server?.type === 'local' ? 'local' : 'ssh';
    const icon = document.createElement('span');
    icon.className = `terminal-tab-icon terminal-tab-icon-${terminalType}`;
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = terminalTabIconSvg(terminalType);

    const title = document.createElement('span');
    title.className = 'terminal-tab-title';
    title.textContent = getTerminalTabTitle(session);

    const workingIndicator = document.createElement('span');
    workingIndicator.className = 'terminal-tab-work-indicator';
    workingIndicator.setAttribute('role', 'status');
    workingIndicator.setAttribute('aria-label', 'Ready');
    workingIndicator.setAttribute('aria-live', 'off');
    workingIndicator.setAttribute('aria-hidden', 'true');

    if (session.tabPinned) {
      const pin = document.createElement('span');
      pin.className = 'terminal-tab-pin-icon';
      pin.setAttribute('aria-hidden', 'true');
      pin.textContent = '📌';
      inner.appendChild(pin);
    }

    const closeButton = document.createElement('button');
    closeButton.className = 'terminal-tab-close';
    closeButton.type = 'button';
    closeButton.draggable = false;
    closeButton.setAttribute('aria-label', `Close ${session.server.name}`);
    closeButton.title = 'Close tab';
    closeButton.disabled = false;
    closeButton.textContent = '×';

    tab.addEventListener('click', (event) => {
      if (tab.dataset.suppressClick === '1') {
        event.preventDefault();
        delete tab.dataset.suppressClick;
        return;
      }

      activateTerminalAndFocus(session.terminalId);
    });
    tab.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateTerminalAndFocus(session.terminalId);
      }
    });

    tab.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showTerminalTabContextMenu(session.terminalId, event.clientX, event.clientY);
    });
    tab.addEventListener('pointerdown', (event) => beginTerminalTabSlideDrag(tab, session, event));
    tab.addEventListener('pointermove', updateTerminalTabSlideDrag);
    tab.addEventListener('pointerup', (event) => finishTerminalTabSlideDrag(event, true));
    tab.addEventListener('pointercancel', (event) => finishTerminalTabSlideDrag(event, false));
    tab.addEventListener('lostpointercapture', (event) => finishTerminalTabSlideDrag(event, false));

    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeTerminalSession(session.terminalId, { force: true });
    });

    closeButton.addEventListener('dragstart', (event) => {
      event.preventDefault();
    });

    inner.appendChild(icon);
    inner.appendChild(title);
    inner.appendChild(workingIndicator);
    inner.appendChild(closeButton);
    tab.appendChild(inner);
    tabs.appendChild(tab);
    updateTerminalTabWorkingIndicator(session);
  });

  if (values.length > 0) {
    appendTerminalTabActions(tabs);
  }
  renderV7MinimalSessionList();
}


// Selecting a tab does not change its structure. Reuse the existing nodes and
// their pointer, keyboard and context-menu handlers instead of rebuilding the
// entire strip. Full rendering remains the fallback for missing/reordered tabs.
function updateTerminalTabActivation() {
  closeTerminalTabPicker();
  const tabs = $('#terminal-tabs');
  if (!tabs) return;

  const visibleIds = Array.from(state.terminals.values())
    .filter((session) => session.pendingReconnectReplacement !== true)
    .map((session) => session.terminalId);
  const tabNodes = Array.from(tabs.children)
    .filter((node) => node.classList?.contains('terminal-tab'));
  if (tabNodes.length !== visibleIds.length || tabNodes.some((node, index) => node.dataset.terminalId !== visibleIds[index])) {
    renderTerminalTabs();
    return;
  }

  tabNodes.forEach((tab) => {
    const active = tab.dataset.terminalId === state.activeTerminalId;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  const sidebar = $('#v7-session-list');
  if (sidebar) {
    Array.from(sidebar.children)
      .filter((node) => node.classList?.contains('v7-session-row'))
      .forEach((row) => {
        const active = row.dataset.terminalId === state.activeTerminalId;
        row.classList.toggle('active', active);
        row.querySelector('.v7-session-item')?.setAttribute('aria-current', String(active));
      });
  }
}


// Lightweight browser-like tab history. This never sends shell commands or stores
// server addresses/credentials. Closing a tab invalidates its history entries.
const terminalTabNavigation = { back: [], forward: [], traversing: false };
const MAX_TERMINAL_TAB_HISTORY = 64;

function updateTerminalTabNavigationButtons() {
  terminalTabNavigation.back = terminalTabNavigation.back.filter((id) => state.terminals.has(id));
  terminalTabNavigation.forward = terminalTabNavigation.forward.filter((id) => state.terminals.has(id));
  const back = $('#terminal-nav-back');
  const forward = $('#terminal-nav-forward');
  const reload = $('#terminal-nav-reload');
  if (back) back.disabled = !terminalTabNavigation.back.length;
  if (forward) forward.disabled = !terminalTabNavigation.forward.length;
  if (reload) {
    const session = state.terminals.get(state.activeTerminalId);
    reload.disabled = !session;
    const reconnect = Boolean(session?.closed);
    reload.title = reconnect
      ? 'Reconnect disconnected terminal (may prompt for SSH authentication)'
      : 'Refresh terminal display without restarting the command';
    reload.setAttribute('aria-label', reconnect ? 'Reconnect current terminal' : 'Refresh current terminal display');
  }
}

function rememberTerminalTabNavigation(previousId, nextId) {
  if (!terminalTabNavigation.traversing
      && previousId !== nextId
      && state.terminals.has(previousId)
      && state.terminals.has(nextId)) {
    terminalTabNavigation.back.push(previousId);
    terminalTabNavigation.back = terminalTabNavigation.back.slice(-MAX_TERMINAL_TAB_HISTORY);
    terminalTabNavigation.forward = [];
  }
  updateTerminalTabNavigationButtons();
}

function navigateTerminalTab(direction) {
  const source = direction === 'back' ? terminalTabNavigation.back : terminalTabNavigation.forward;
  const target = direction === 'back' ? terminalTabNavigation.forward : terminalTabNavigation.back;
  while (source.length) {
    const id = source.pop();
    if (!state.terminals.has(id) || id === state.activeTerminalId) continue;
    if (state.terminals.has(state.activeTerminalId)) {
      target.push(state.activeTerminalId);
      if (target.length > MAX_TERMINAL_TAB_HISTORY) target.shift();
    }
    terminalTabNavigation.traversing = true;
    try {
      activateTerminalAndFocus(id);
    } finally {
      terminalTabNavigation.traversing = false;
      updateTerminalTabNavigationButtons();
    }
    return true;
  }
  updateTerminalTabNavigationButtons();
  return false;
}

// 'Reload' is intentionally non-destructive for a connected terminal: never
// terminate a live PowerShell process, SSH session, or currently running job.
async function reloadActiveTerminalDisplay() {
  const session = state.terminals.get(state.activeTerminalId);
  if (!session) return false;
  if (session.closed) {
    return reconnectTerminalTab(session.terminalId);
  }
  updateTerminalLocationHeader(session);
  try {
    if (typeof session.term?.refresh === 'function') {
      session.term.refresh(0, Math.max(0, (session.term.rows || 1) - 1));
    }
  } catch (_) { /* Terminal might be initializing; fitting still works. */ }
  fitActiveTerminal();
  return true;
}

function activateTerminal(terminalId) {
  const previousTerminalId = state.activeTerminalId;

  if (previousTerminalId && previousTerminalId !== terminalId && isTerminalSearchOpen()) {
    clearTerminalSearchSelection(state.terminals.get(previousTerminalId));
  }

  state.activeTerminalId = terminalId;
  rememberTerminalTabNavigation(previousTerminalId, terminalId);

  $$('.terminal-pane').forEach((pane) => {
    pane.classList.toggle('active', pane.dataset.terminalId === terminalId);
  });

  const session = state.terminals.get(terminalId);
  if (session) {
    setTerminalHeaderTitle(session.server.name);
    setTerminalStatus(session.status || (session.closed ? 'disconnected' : 'connected'));
    updateTerminalLocationHeader(session);

    if (previousTerminalId && previousTerminalId !== terminalId) {
      appendActivityFeedEvent(`Active terminal tab switched to ${session.server?.name || terminalId}.`, 'action', { dedupeMs: 800 });
    }
  } else {
    updateTerminalLocationHeader(null);
  }

  updateTerminalTabActivation();
  updateCurrentTabFooter();
  syncV7CommandComposer();
  fitActiveTerminal();

  requestAnimationFrame(syncTerminalSearchToActiveSession);
}

function createTerminalPane(terminalId, server, { restoredPinned = false, activate = true } = {}) {
  $('#terminal-empty').classList.add('hidden');

  if (activate) $$('.terminal-pane').forEach((existingPane) => {
    existingPane.classList.remove('active');
  });

  const pane = document.createElement('div');
  pane.className = activate ? 'terminal-pane active' : 'terminal-pane';
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

  if (activate) try {
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
  session.cleanSshStartupActive = server?.type === 'remote';
  session.cleanSshStartupStartedAt = session.cleanSshStartupActive ? Date.now() : null;
  session.cleanSshStartupBuffer = '';
  session.sshTypedCommandBuffer = '';
  if (restoredPinned) {
    session.restoredPinnedPlaceholder = true;
    session.closed = true;
    session.manualClose = true;
    session.hasConnected = false;
    session.status = 'disconnected';
    session.cleanSshStartupActive = false;
  }

  setSessionCurrentLocation(session, getInitialTerminalLocation(server));

  const terminalFocusHandler = () => {
    activateTerminalAndFocus(terminalId);
  };

  session.terminalFocusHandler = terminalFocusHandler;
  pane.addEventListener('pointerdown', terminalFocusHandler);
  pane.addEventListener('focusin', terminalFocusHandler);

  const inputDisposable = term.onData((data) => {
    if (session.closed) return;
    if (handleSshLockedInteractiveInput(session, data)) {
      return;
    }

    // Forward accepted keystrokes/paste to PTY or SSH before synchronous
    // reporting work. The remote/local shell remains the sole source of echo.
    window.advanceTerminal.writeTerminal({ terminalId, data });
    recordTerminalInput(session, data);
  });

  session.disposables = [inputDisposable];

  const terminalPasteHandler = (event) => {
    if (session.closed || !event.clipboardData) return;
    const text = event.clipboardData.getData('text/plain');
    if (!isMultilinePasteText(text)) return;
    // Intercept only actual multi-line clipboard pastes. Single-line keyboard
    // input retains xterm's normal key handling, shortcuts and shell features.
    event.preventDefault();
    event.stopImmediatePropagation();
    void writeClipboardTextToTerminal(session, text, 'Keyboard clipboard', {
      requireMultilineConfirm: true,
      requireActiveSession: true,
      normalizeLineEndings: true
    }).catch((error) => showToast(`Paste failed: ${error.message}`, 5000, 'error'));
  };
  session.terminalPasteHandler = terminalPasteHandler;
  pane.addEventListener('paste', terminalPasteHandler, true);

  const contextMenuHandler = async (event) => {
    event.preventDefault();

    if (session.closed) {
      showToast('This terminal session is closed.', 'warning');
      return;
    }

    activateTerminalAndFocus(terminalId);

    try {
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
      showToast('Right-click paste failed. Use toolbar Paste.', 'error');
    }
  };

  session.contextMenuHandler = contextMenuHandler;
  pane.addEventListener('contextmenu', contextMenuHandler);

  state.terminals.set(terminalId, session);
  if (!restoredPinned) {
    recordSessionEvent(session, `Opened terminal tab: ${server.name || terminalId}`, 'system');
  }
  if (activate) activateTerminal(terminalId);

  return session;
}

function getTerminalSize(session) {
  // Match the actual xterm viewport. The old 80x24 floor made the PTY/SSH
  // believe it had more rows/columns than a narrow or short window could show.
  const cols = Math.max(2, Math.min(500, Number(session?.term?.cols || 120)));
  const rows = Math.max(2, Math.min(200, Number(session?.term?.rows || 32)));

  return {
    cols: Number.isFinite(cols) ? Math.floor(cols) : 120,
    rows: Number.isFinite(rows) ? Math.floor(rows) : 32
  };
}

// A native window drag can generate dozens of resize events per second.
// Fit xterm promptly, but resize the PTY/SSH backend only after dimensions
// settle. This avoids repeatedly asking PowerShell/ConPTY to redraw its prompt.
const V7_TERMINAL_BACKEND_RESIZE_SETTLE_MS = 280;
const v7TerminalBackendResizeRequests = new Map();

function sameTerminalSize(left, right) {
  return Boolean(left && right && left.cols === right.cols && left.rows === right.rows);
}

function cancelTerminalBackendResize(session) {
  const request = v7TerminalBackendResizeRequests.get(session?.terminalId);
  if (!request || request.session !== session) return;
  if (request.timer !== null) clearTimeout(request.timer);
  request.timer = null;
  request.disposed = true;
  v7TerminalBackendResizeRequests.delete(session.terminalId);
}

function isCurrentTerminalResizeRequest(request) {
  const session = request.session;
  return !request.disposed
    && v7TerminalBackendResizeRequests.get(session.terminalId) === request
    && state.terminals.get(session.terminalId) === session
    && state.activeTerminalId === session.terminalId
    && session.pane?.classList.contains('active')
    && !session.closed;
}

function scheduleTerminalBackendResizeFlush(request, delay = V7_TERMINAL_BACKEND_RESIZE_SETTLE_MS) {
  if (request.timer !== null) clearTimeout(request.timer);
  request.timer = setTimeout(() => {
    request.timer = null;
    void flushTerminalBackendResize(request);
  }, delay);
}

async function flushTerminalBackendResize(request) {
  if (!isCurrentTerminalResizeRequest(request) || request.inFlight) return;
  const size = request.desired;
  if (!size || sameTerminalSize(size, request.lastApplied)) return;
  request.inFlight = true;
  request.lastAttempted = size;
  try {
    const response = await window.advanceTerminal.resizeTerminal({
      terminalId: request.session.terminalId,
      cols: size.cols,
      rows: size.rows
    });
    if (response?.ok !== false) request.lastApplied = size;
  } catch (error) {
    // A terminal can close while an IPC resize is in flight. Do not retry
    // indefinitely or send shell input as a workaround.
    console.warn('Terminal backend resize was not applied:', error?.message || error);
  } finally {
    request.inFlight = false;
    // A newer size may arrive while the previous IPC request is pending.
    // Serialize resizes so an older acknowledgement cannot win the race.
    if (isCurrentTerminalResizeRequest(request)
        && !sameTerminalSize(request.desired, request.lastAttempted)
        && request.timer === null) {
      scheduleTerminalBackendResizeFlush(request);
    }
  }
}

function syncTerminalBackendSize(session) {
  if (!session || session.closed || state.terminals.get(session.terminalId) !== session) return;
  const size = getTerminalSize(session);
  let request = v7TerminalBackendResizeRequests.get(session.terminalId);
  if (!request || request.session !== session) {
    if (request) cancelTerminalBackendResize(request.session);
    request = {
      session, desired: null, lastApplied: null, lastAttempted: null,
      timer: null, inFlight: false, disposed: false
    };
    v7TerminalBackendResizeRequests.set(session.terminalId, request);
  }
  request.desired = size;
  // Even an unchanged size can still have a timer from a previous drag. Only
  // skip once the latest PTY dimensions are known to match the visual grid.
  if (!request.inFlight && sameTerminalSize(size, request.lastApplied)) {
    if (request.timer !== null) clearTimeout(request.timer);
    request.timer = null;
    return;
  }
  scheduleTerminalBackendResizeFlush(request);
}

function fitTerminalSessionNow(session, options = {}) {
  const notifyBackend = options.notifyBackend !== false;

  if (!session || !session.pane?.classList.contains('active')) {
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
  const session = state.terminals.get(state.activeTerminalId);
  fitTerminalSession(session);
}

// Fit xterm after its *container* changes size, including push-flyout and
// bottom-composer changes that do not always trigger a native window resize.
// One observer and at most one fit per animation frame; never recreate sessions.
let v7TerminalHostResizeObserver = null;
function setupV7TerminalHostResizeObserver() {
  const host = $('#terminal-host');
  if (!host || v7TerminalHostResizeObserver || typeof ResizeObserver !== 'function') return;

  let lastWidth = 0;
  let lastHeight = 0;
  let frameQueued = false;
  const observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return;
    // Avoid repeated fit and backend resize IPC when geometry is unchanged.
    if (Math.abs(rect.width - lastWidth) < 1 && Math.abs(rect.height - lastHeight) < 1) return;
    lastWidth = rect.width;
    lastHeight = rect.height;
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(() => {
      frameQueued = false;
      const session = state.terminals.get(state.activeTerminalId);
      // Even a disconnected/restored pinned tab needs a correctly sized
      // *display*. fitTerminalSessionNow never resizes a closed PTY/SSH stream.
      if (!session || !session.pane?.classList.contains('active')) return;
      fitTerminalSessionNow(session);
    });
  });
  observer.observe(host);
  v7TerminalHostResizeObserver = observer;
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

  state.settings = await saveSettingsNow({ toastMessage: '', refresh: false });
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
  // A manual reconnect authenticates normally but does not select or reorder
  // tabs in the background. Existing click listeners can also pass an Event.
  const server = options?.serverOverride || getSelectedServer();
  const background = options?.background === true;

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
    session = createTerminalPane(terminalId, server, { activate: !background });
    session.pendingReconnectReplacement = background;
    session.status = 'connecting';
    updateTerminalTabWorkingIndicator(session);
    if (!background) setTerminalStatus('connecting');
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
        closeTerminalSession(terminalId, { force: true, remember: false });
        if (!background) setActiveView(previousView || 'terminal');
        showToast('Connection cancelled.', 3200, 'warning');
        return;
      }
      secrets.password = password;
    }

    if (secretRequirement === 'passphrase-optional') {
      const passphrase = await openSecretModal('passphrase', server);
      if (passphrase === null) {
        closeTerminalSession(terminalId, { force: true, remember: false });
        if (!background) setActiveView(previousView || 'terminal');
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
        serverId: server.id,
        ...(server.quickLocalShell ? { quickLocalShell: server.quickLocalShell } : {}),
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
      updateTerminalTabWorkingIndicator(session);
      session.report = ensureSessionReport(session);
      session.report.connectedAt = session.report.connectedAt || Date.now();
      session.report.lastUsageCheckpointAt = session.report.lastUsageCheckpointAt || Date.now();
      if (state.activeTerminalId === session.terminalId) setTerminalStatus(session.status);
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
      persistSavedTerminalSessions();

      if (server.type !== 'remote') {
        session.connectionReadyNotified = true;
        showToast(`${server.name || 'Terminal'} is connected.`, 4000, 'success');
      }
    } catch (error) {
      session.cleanSshStartupActive = false;
      hideTerminalConnectingOverlay(session);
      session.term.writeln(`Connection failed: ${error.message}`);
      recordSessionEvent(session, `Connection failed: ${error.message}`, 'error');
      appendLiveConsole(`Connection failed for ${server.name || server.host || terminalId}: ${error.message}`, 'error');
      updateConnectionHealthFromSession(server, 'error', error.message || 'Connection failed.');
      session.closed = true;
      session.status = 'error';
      updateTerminalTabWorkingIndicator(session);
      persistSavedTerminalSessions();
      if (state.activeTerminalId === session.terminalId) {
        setTerminalStatus('error');
        // Only restore the earlier view if this failed connection is still
        // foreground; never interrupt an unrelated tab or page.
        if (state.activeView === 'terminal') setActiveView(previousView || 'terminal');
      }

      if (!['CONNECTION_BUSY', 'TERMINAL_BUSY'].includes(error.code)) {
        showToast(`Connection failed: ${error.message}`, 7000, 'error');
      }
    }
  } finally {
    state.connectionAttemptInFlight = false;
    updateTerminalInteractionState();
  }
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
  updateTerminalTabWorkingIndicator(session);
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
        updateTerminalTabWorkingIndicator(session);
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
  updateTerminalTabWorkingIndicator(session);
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
    ...(server.quickLocalShell ? { quickLocalShell: server.quickLocalShell } : {}),
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
  updateTerminalTabWorkingIndicator(session);
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
  cancelTerminalBackendResize(session);
  clearTimeout(session.processBusyTimer);
  session.processBusyTimer = null;
  session.processBusy = false;
  session.processLabel = '';
  session.processOutputTail = '';
  updateTerminalTabWorkingIndicator(session);

  (session.disposables || []).forEach((disposable) => {
    try {
      disposable?.dispose?.();
    } catch (_) {
      // Ignore terminal listener cleanup failure.
    }
  });

  session.disposables = [];

  if (session.terminalPasteHandler && session.pane) {
    try {
      session.pane.removeEventListener('paste', session.terminalPasteHandler, true);
    } catch (_) {
      // Ignore DOM listener cleanup failure.
    }
  }

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
  session.terminalPasteHandler = null;
  session.terminalFocusHandler = null;
}

function closeTerminalSession(terminalId, { force = false, remember = true } = {}) {
  const id = terminalId || state.activeTerminalId;
  const session = state.terminals.get(id);

  if (!session) {
    return false;
  }
  if (remember) rememberClosedTerminalTab(session);
  closeTerminalTabContextMenu();

  cleanupTerminalSessionResources(session);
  if (!session.restoredPinnedPlaceholder) {
    moveActiveSessionToHistory(session, 'Closed by user');
  }
  session.manualClose = true;
  session.closed = true;
  session.status = 'disconnected';

  if (state.activeTerminalId === id) {
    setTerminalStatus('disconnected');
  }

  if (!session.restoredPinnedPlaceholder) {
    recordSessionEvent(session, 'Terminal tab closed by user.', 'system');
    window.advanceTerminal.closeTerminal({ terminalId: id });
  }

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
  for (const child of state.terminals.values()) {
    if (child.v7ParentId === id) child.v7ParentId = null;
  }
  v7ComposerDrafts.delete(id);
  v7ComposerMultilineModes.delete(id);
  updateTerminalTabNavigationButtons();
  persistSavedTerminalSessions();

  // Closing another tab must never unexpectedly move focus from the active terminal.
  const next = state.terminals.has(state.activeTerminalId)
    ? state.activeTerminalId
    : (Array.from(state.terminals.keys())[0] || null);
  state.activeTerminalId = next;

  if (next) {
    activateTerminal(next);
  } else {
    $('#terminal-empty').classList.remove('hidden');
    setTerminalHeaderTitle('Advance Terminal');
    setTerminalStatus('idle');
    updateTerminalLocationHeader(null);
    renderTerminalTabs();
    updateCurrentTabFooter();
    closeTerminalSearch({ focusActiveTerminal: false });
  }
  syncV7CommandComposer();
  return true;
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

  const session = state.terminals.get(terminalId);
  // Pointer and focus events on the already-active pane must not rebuild tabs
  // and refit xterm; that caused avoidable work on ordinary interactions.
  if (state.activeTerminalId === terminalId && state.activeView === 'terminal') {
    return;
  }
  setActiveView('terminal', 'terminal');
  activateTerminal(terminalId);

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
      return false;
    }

    try {
      session.term.clear();
      session.term.write('\x1b[3J\x1b[2J\x1b[H');
      // Clear remains a local UI action while the connection is initializing.
      // Don't send input into a PTY that does not exist yet.
      if (!isTerminalSessionProcessing(session)) {
        window.advanceTerminal.writeTerminal({
          terminalId: session.terminalId,
          data: '\x0c'
        });
      }
    } catch (_) {
      showToast('Unable to clear this terminal.', 3500, 'error');
      return false;
    }

    recordSessionEvent(session, 'Terminal screen and scrollback cleared.', 'action');
    appendLiveConsole(`Terminal screen and scrollback cleared: ${session.server?.name || 'active terminal'}`, 'action');
    focusTerminal(session);
    showToast('Terminal screen cleared permanently.', 3500, 'success');
    return true;
  }
  return false;
}

async function copyAllActiveTerminal() {
  const session = getActiveTerminalSession('Copy All Screen');

  if (!session) {
    return false;
  }

  if (!guardTerminalAction(session, 'Copy All Screen', 'copyAll')) {
    return false;
  }

  const text = getTerminalBufferText(session.term);

  if (!text) {
    showToast('There is no terminal output to copy.');
    focusTerminal(session);
    return false;
  }

  await navigator.clipboard.writeText(text);
  focusTerminal(session);
  showToast('Copied all terminal screen output.');
  return true;
}

async function copySelectedTerminalText() {
  const session = getActiveTerminalSession('Copy Selection');

  if (!session) {
    return false;
  }

  if (!guardTerminalAction(session, 'Copy Selection', 'copySelection')) {
    return false;
  }

  const selectedText = session.term.getSelection();

  if (!selectedText) {
    showToast('Select terminal text first.');
    focusTerminal(session);
    return false;
  }

  await navigator.clipboard.writeText(selectedText);
  focusTerminal(session);
  showToast('Copied selected terminal text.');
  return true;
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
  const multilineToggle = $('#safe-paste-multiline-toggle');
  const rightClickAutoEnterToggle = $('#right-click-auto-enter-toggle');
  const sshLockToggle = $('#ssh-lock-start-folder-toggle');

  if (multilineToggle) {
    multilineToggle.checked = protection.confirmMultiline;
  }

  if (rightClickAutoEnterToggle) {
    rightClickAutoEnterToggle.checked = protection.rightClickAutoEnter;
  }

  if (sshLockToggle) {
    sshLockToggle.checked = protection.lockSshToStartFolder;
  }
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

  const action = options?.requireMultilineConfirm === true && isMultilinePasteText(text)
    ? await openSafePasteDialog({ text, sourceLabel })
    : await choosePasteAction(text, sourceLabel);

  if (!action) {
    if (options?.preserveFocus !== true) focusTerminal(session);
    showToast('Paste cancelled.', 3000, 'warning');
    recordSessionEvent(session, `${sourceLabel} paste cancelled.`, 'warning');
    return false;
  }

  const data = action === 'single-line' ? collapsePasteToOneLine(text) : text;

  if (!data) {
    if (options?.preserveFocus !== true) focusTerminal(session);
    showToast('Clipboard has no text to paste.', 'warning');
    return false;
  }

  if (session.closed || !state.terminals.has(session.terminalId)
      || (options?.requireActiveSession && state.activeTerminalId !== session.terminalId)) {
    showToast('Command not sent: the active terminal changed or disconnected.', 3500, 'warning');
    return false;
  }
  const autoEnter = options?.autoEnter === true;
  const normalizedData = options?.normalizeLineEndings === false
    ? data : data.replace(/\r\n|\n|\r/g, '\r');
  const terminalData = autoEnter ? appendTerminalEnterIfMissing(normalizedData) : normalizedData;
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
  if (options?.preserveFocus !== true) focusTerminal(session);
  if (!options?.quiet) {
    showToast(
      autoEnter
        ? 'Pasted clipboard and sent Enter.'
        : action === 'single-line'
          ? 'Pasted clipboard as one line.'
          : 'Pasted clipboard into terminal.',
      'success'
    );
  }

  return true;
}

async function pasteClipboardToTerminal() {
  const session = getActiveTerminalSession('Paste');

  if (!session) {
    return false;
  }

  const text = await navigator.clipboard.readText();

  if (!text) {
    showToast('Clipboard is empty.');
    focusTerminal(session);
    return false;
  }

  return await writeClipboardTextToTerminal(session, text, 'Toolbar clipboard');
}

function sendControlToActiveTerminal(sequence, label) {
  const session = getActiveTerminalSession(label);

  if (!session) {
    return false;
  }

  const actionKind = sequence === '\x03'
    ? 'ctrlC'
    : sequence === '\x0c'
      ? 'ctrlL'
      : sequence === '\x04'
        ? 'ctrlD'
        : 'sendText';

  if (!guardTerminalAction(session, label, actionKind)) {
    return false;
  }

  window.advanceTerminal.writeTerminal({
    terminalId: session.terminalId,
    data: sequence
  });

  recordSessionEvent(session, `Sent ${label}.`, 'action');
  appendLiveConsole(`Sent ${label} to ${session.server?.name || 'active terminal'}.`, 'action');
  focusTerminal(session);
  showToast(`Sent ${label}.`);
  return true;
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
  syncReportCustomRangeControls();
  ensureReportCustomRangeValues(state.currentReportDateFilter);
  renderTerminalToolbarActions();
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

  if (state.activeSettingsTab === 'terminal-actions') {
    renderTerminalActionsSettings();
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
  state.settings = await saveSettingsNow({ toastMessage: '', refresh: false });
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
  state.settings = await saveSettingsNow({ toastMessage: '', refresh: false });
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
  state.settings = await saveSettingsNow({ toastMessage: '', refresh: false });
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

  if (state.activeSettingsTab === 'servers' || state.activeSettingsTab === 'reports' || state.activeSettingsTab === 'audit' || state.activeSettingsTab === 'about') {
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
    currentVersion.textContent = status.currentVersion || state.appInfo?.version || state.appInfo?.displayVersion || 'Advance Terminal V7';
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

  const displayVersion = state.appInfo.displayVersion || 'Advance Terminal V7';
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
  const session = state.terminals.get(state.activeTerminalId);

  if (session?.server?.name) {
    return getTerminalTabTitle(session);
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


// v7 sidebar now uses a one-level parent/child hierarchy; legacy numbered-group
// storage is intentionally left untouched for rollback, but never rendered.

// Each color is tuned for the dark workspace. Preserve legacy IDs from earlier
// patches in display/menu lookups without silently rewriting saved tab data.
const V7_SESSION_PALETTE = [
  { color: '#d76559', name: 'Coral Red', idle: '#422725', hover: '#754039', active: '#a54e47', legacy: ['#ff746b'] },
  { color: '#e99c57', name: 'Orange', idle: '#443020', hover: '#78502d', active: '#a96c37', legacy: [] },
  { color: '#a0d96e', name: 'Lime Green', idle: '#293723', hover: '#4a6735', active: '#658d43', legacy: ['#a9f87c'] },
  { color: '#e8ce66', name: 'Yellow', idle: '#3a3522', hover: '#6d6035', active: '#97843f', legacy: ['#fff6a5'] },
  { color: '#77bff2', name: 'Sky Blue', idle: '#243442', hover: '#365d7b', active: '#477ea7', legacy: ['#b1dafe'] },
  { color: '#e18ad3', name: 'Pink', idle: '#40283c', hover: '#72416d', active: '#98558f', legacy: ['#ff9ce0'] },
  { color: '#b5a0ef', name: 'Lavender', idle: '#322b43', hover: '#584b82', active: '#7563ad', legacy: ['#e4b1ff', '#bcb6ee'] }
];
const V7_SESSION_COLORS = ['', ...V7_SESSION_PALETTE.map((item) => item.color)];

function getV7SessionPaletteChoice(value) {
  const normalized = normalizeTerminalTabColor(value);
  return V7_SESSION_PALETTE.find((item) => item.color === normalized || item.legacy.includes(normalized)) || null;
}



// A terminal belongs to either a single top-level list or one submenu.
// Parent links are display metadata only and never alter PTYs, SSH sessions,
// command history, or tab ordering.
function getV7SessionParent(session) {
  if (!session?.v7ParentId || session.v7ParentId === session.terminalId) return null;
  const parent = state.terminals.get(session.v7ParentId);
  return parent && parent.pendingReconnectReplacement !== true && !parent.v7ParentId ? parent : null;
}

// Sidebar order is independent of PTY/tab insertion order. An unsorted new
// session appears at the end until the user moves it explicitly.
function getV7OrderedSessions(items) {
  return items.slice().sort((a, b) => {
    const aa = Number.isSafeInteger(a.v7SidebarOrder) && a.v7SidebarOrder >= 0 ? a.v7SidebarOrder : Number.MAX_SAFE_INTEGER;
    const bb = Number.isSafeInteger(b.v7SidebarOrder) && b.v7SidebarOrder >= 0 ? b.v7SidebarOrder : Number.MAX_SAFE_INTEGER;
    return aa - bb;
  });
}

function getV7SessionChildren(parentId) {
  return getV7OrderedSessions(Array.from(state.terminals.values()).filter((item) =>
    item.pendingReconnectReplacement !== true && item.terminalId !== parentId && item.v7ParentId === parentId));
}

function getV7SessionPeers(parentId = null, pinned = false) {
  return getV7OrderedSessions(Array.from(state.terminals.values()).filter((item) => {
    if (item.pendingReconnectReplacement === true) return false;
    const parent = getV7SessionParent(item);
    return parentId ? parent?.terminalId === parentId : !parent && item.tabPinned === pinned;
  }));
}

function getV7NextPeerOrder(parentId, pinned, exceptId = null) {
  const siblings = getV7SessionPeers(parentId, pinned).filter((item) => item.terminalId !== exceptId);
  // Materialize legacy insertion order first. Otherwise a newly assigned order
  // would sort ahead of existing items that have no explicit order yet.
  let next = siblings.reduce((max, item) => Math.max(max,
    Number.isSafeInteger(item.v7SidebarOrder) && item.v7SidebarOrder >= 0 ? item.v7SidebarOrder : -1), -1) + 1;
  siblings.forEach((item) => {
    if (!Number.isSafeInteger(item.v7SidebarOrder) || item.v7SidebarOrder < 0) item.v7SidebarOrder = next++;
  });
  return next;
}

// Above/below keeps the same level as the target. The center is the only
// action that creates a submenu. Moving a parent carries its children along.
function moveV7SessionRelative(sourceId, targetId, placement) {
  if (!['before', 'after'].includes(placement) || sourceId === targetId) return false;
  const source = state.terminals.get(sourceId);
  const target = state.terminals.get(targetId);
  if (!source || !target || source.pendingReconnectReplacement || target.pendingReconnectReplacement) return false;
  const targetParent = getV7SessionParent(target);
  if (targetParent && getV7SessionChildren(sourceId).length) {
    showToast('Move the parent above or below another parent, or move its children out first.', 4000, 'warning');
    return false;
  }
  const parentId = targetParent?.terminalId || null;
  const pinned = parentId ? false : target.tabPinned === true;
  const peers = getV7SessionPeers(parentId, pinned).filter((item) => item.terminalId !== sourceId);
  const targetIndex = peers.findIndex((item) => item.terminalId === targetId);
  if (targetIndex < 0) return false;
  source.v7ParentId = parentId;
  source.tabPinned = pinned;
  peers.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, source);
  peers.forEach((item, index) => { item.v7SidebarOrder = index; });
  if (targetParent) targetParent.v7Collapsed = false;
  persistSavedTerminalSessions();
  renderTerminalTabs();
  return true;
}

function getV7SessionDropPlacement(event, row) {
  const rect = row.getBoundingClientRect();
  const position = (event.clientY - rect.top) / Math.max(1, rect.height);
  if (position < 0.3) return 'before';
  if (position <= 0.7) return 'inside';
  const target = state.terminals.get(row.dataset.terminalId);
  const parent = getV7SessionParent(target);
  if (parent) {
    const children = getV7SessionChildren(parent.terminalId);
    if (children[children.length - 1]?.terminalId === target.terminalId) return 'after-tree';
  }
  return 'after';
}

function showV7SessionDropPreview(row, placement) {
  row.classList.toggle('is-drop-before', placement === 'before');
  row.classList.toggle('is-drop-target', placement === 'inside');
  row.classList.toggle('is-drop-after', placement === 'after');
  row.classList.toggle('is-drop-after-tree', placement === 'after-tree');
}

function detachV7Session(terminalId, { refresh = true } = {}) {
  const session = state.terminals.get(terminalId);
  if (!session || !session.v7ParentId) return false;
  session.v7ParentId = null;
  session.v7SidebarOrder = getV7NextPeerOrder(null, session.tabPinned, terminalId);
  if (refresh) {
    persistSavedTerminalSessions();
    renderV7MinimalSessionList();
  }
  return true;
}

function nestV7Session(sourceId, targetId) {
  const source = state.terminals.get(sourceId);
  const target = state.terminals.get(targetId);
  if (!source || !target || source === target || source.pendingReconnectReplacement || target.pendingReconnectReplacement) return false;
  // Dropping on a child nests the source alongside that child, never a third level.
  const parent = getV7SessionParent(target) || target;
  if (source === parent || source.v7ParentId === parent.terminalId) return false;
  if (getV7SessionChildren(sourceId).length) {
    showToast('Move this session’s children out before nesting it.', 4000, 'warning');
    return false;
  }
  source.v7ParentId = parent.terminalId;
  source.tabPinned = false; // A nested row follows its parent; no duplicate pinned entry.
  source.v7SidebarOrder = getV7NextPeerOrder(parent.terminalId, false, sourceId);
  parent.v7Collapsed = false;
  persistSavedTerminalSessions();
  renderTerminalTabs();
  return true;
}

function toggleV7SessionChildren(terminalId) {
  const parent = state.terminals.get(terminalId);
  if (!parent || !getV7SessionChildren(terminalId).length) return;
  parent.v7Collapsed = !parent.v7Collapsed;
  persistSavedTerminalSessions();
  renderV7MinimalSessionList();
}

function moveV7SessionToSection(terminalId, pinned) {
  const session = state.terminals.get(terminalId);
  if (!session) return false;
  session.v7ParentId = null;
  session.tabPinned = pinned;
  session.v7SidebarOrder = getV7NextPeerOrder(null, pinned, terminalId);
  persistSavedTerminalSessions();
  renderTerminalTabs();
  return true;
}

function showV7SessionActionsMenu(terminalId, anchor, returnFocus = null) {
  const session = state.terminals.get(terminalId);
  if (!session) return;
  closeTerminalTabContextMenu();
  closeTerminalTabPicker();
  hideSidebarContextMenu();

  const menu = document.createElement('div');
  menu.className = 'terminal-tab-context-menu v7-session-context-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', `Actions for ${getTerminalTabTitle(session)}`);
  menu.append(
    terminalTabMenuButton(session.tabPinned ? 'Unpin' : 'Pin', () => setTerminalTabPinned(terminalId, !session.tabPinned)),
    terminalTabMenuButton('Reconnect', () => reconnectTerminalTab(terminalId), !session.closed),
    ...(session.v7ParentId ? [terminalTabMenuButton('Move out of submenu', () => detachV7Session(terminalId))] : []),
    terminalTabMenuButton('Rename', () => openTerminalTabRenameModal(terminalId)),
    terminalTabMenuButton('Close', () => closeTerminalSession(terminalId, { force: true }), false, true)
  );

  const divider = document.createElement('div');
  divider.className = 'terminal-tab-context-divider';
  menu.appendChild(divider);
  const colors = document.createElement('div');
  colors.className = 'v7-session-color-list';
  colors.setAttribute('role', 'group');
  colors.setAttribute('aria-label', 'Session color');
  V7_SESSION_COLORS.forEach((color) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'v7-session-color-option';
    const paletteChoice = getV7SessionPaletteChoice(color);
    if (!color) dot.classList.add('is-clear');
    else dot.style.setProperty('--v7-swatch', color);
    dot.setAttribute('aria-label', color ? `Set session color ${paletteChoice?.name || color}` : 'Clear session color');
    // Older saved swatches still appear selected without modifying persisted data.
    dot.setAttribute('aria-pressed', String((getV7SessionPaletteChoice(session.tabColor)?.color || normalizeTerminalTabColor(session.tabColor)) === color));
    dot.title = paletteChoice?.name || 'No color';
    dot.addEventListener('click', (event) => {
      event.stopPropagation();
      setTerminalTabColor(terminalId, color);
      closeTerminalTabContextMenu();
    });
    colors.appendChild(dot);
  });
  menu.appendChild(colors);
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeTerminalTabContextMenu();
      returnFocus?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const enabled = Array.from(menu.querySelectorAll('button:not(:disabled)'));
      const index = enabled.indexOf(document.activeElement);
      if (!enabled.length) return;
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? (index + 1) % enabled.length : (index - 1 + enabled.length) % enabled.length;
      enabled[next].focus();
    }
  });
  menu.style.maxHeight = 'calc(100vh - 16px)';
  menu.style.overflowY = 'auto';
  document.body.appendChild(menu);
  terminalTabContextMenu = menu;
  const bounds = menu.getBoundingClientRect();
  const left = anchor?.left ?? 8;
  const top = anchor?.bottom ?? 8;
  menu.style.left = `${Math.max(8, Math.min(left, window.innerWidth - bounds.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(top + 4, window.innerHeight - bounds.height - 8))}px`;
  requestAnimationFrame(() => menu.querySelector('button:not(:disabled)')?.focus());
}

function createV7SessionSectionHeader(sectionId, sectionName) {
  const header = document.createElement('div');
  header.className = 'v7-session-section-header';
  header.dataset.v7SectionId = sectionId;
  header.setAttribute('role', 'heading');
  header.setAttribute('aria-level', '3');
  header.textContent = sectionName;
  return header;
}

// A sidebar click is an explicit user action: disconnected placeholders can
// reconnect on selection, but never during startup, dragging or tab redraws.
// Keep a pending guard for password/passphrase dialogs and double clicks.
const v7SessionClickReconnectPending = new Set();

async function reconnectV7SessionOnClick(terminalId) {
  const session = state.terminals.get(terminalId);
  if (!session || !session.closed || v7SessionClickReconnectPending.has(terminalId)) return false;
  v7SessionClickReconnectPending.add(terminalId);
  renderV7MinimalSessionList();
  try {
    // Reuse the normal reconnect path: SSH authentication, host verification,
    // and restoring the old tab position, parent, pin, color and unsent draft.
    return await reconnectTerminalTab(terminalId);
  } catch (error) {
    showToast(`Unable to reconnect ${getTerminalTabTitle(session)}: ${error?.message || 'Unknown error'}`, 5000, 'error');
    return false;
  } finally {
    v7SessionClickReconnectPending.delete(terminalId);
    renderV7MinimalSessionList();
  }
}

// V7 sessions-first navigation. Only the sidebar UI is rebuilt; xterm and SSH
// sessions are never recreated on selection, and no session data is written to settings.
function getV7SessionStatus(session) {
  if (!session) return 'Disconnected';
  if (v7SessionClickReconnectPending.has(session.terminalId)) return 'Connecting';
  if (session.closed) return 'Disconnected';
  if (['connecting', 'reconnecting'].includes(String(session.status || '').toLowerCase())) return 'Connecting';
  if (session.processBusy === true) return 'Running command';
  return session.server?.type === 'local' ? 'Local terminal' : 'SSH session';
}

function createV7SessionRow(terminalId) {
  const row = document.createElement('div');
  row.className = 'v7-session-row';
  row.dataset.terminalId = terminalId;
  row.setAttribute('role', 'listitem');

  const switchButton = document.createElement('button');
  switchButton.type = 'button';
  switchButton.className = 'v7-session-item';
  const icon = document.createElement('span');
  icon.className = 'v7-session-dot';
  icon.setAttribute('aria-hidden', 'true');
  const content = document.createElement('span');
  content.className = 'v7-session-name';
  const title = document.createElement('strong');
  const details = document.createElement('small');
  content.append(title, details);
  const pin = document.createElement('span');
  pin.className = 'v7-session-pin';
  pin.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.6 3.4l6 6-2.1 2.1-1.7-1.7-4.6 4.6.5 3.4-1.5 1.5-3.9-3.9-4.4 4.4-1.4-1.4 4.4-4.4-3.9-3.9 1.5-1.5 3.4.5 4.6-4.6-1.7-1.7 2.1-2.1z"/></svg>';
  pin.setAttribute('aria-label', 'Pinned session');
  const indicator = document.createElement('span');
  indicator.className = 'v7-session-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'v7-session-expand';
  expand.setAttribute('aria-label', 'Expand submenu');
  expand.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleV7SessionChildren(terminalId);
  });
  switchButton.append(icon, content, pin, indicator);

  // A separate button avoids nesting interactive controls and makes all existing
  // tab actions accessible without relying on right-click.
  const actionsButton = document.createElement('button');
  actionsButton.type = 'button';
  actionsButton.className = 'v7-session-actions';
  actionsButton.textContent = '⋮';
  actionsButton.setAttribute('aria-haspopup', 'menu');
  const openActions = () => {
    if (!state.terminals.has(terminalId)) return;
    const rect = actionsButton.getBoundingClientRect();
    showV7SessionActionsMenu(terminalId, rect, actionsButton);
  };

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'v7-session-close';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', 'Close session');
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    closeTerminalSession(terminalId, { force: true });
  });

  switchButton.addEventListener('click', () => {
    const session = state.terminals.get(terminalId);
    if (!session || v7DraggedSessionId) return;
    // Switching to a live session only changes focus; a disconnected saved
    // entry reconnects once through the same path as the Reconnect menu.
    if (state.activeTerminalId === terminalId && state.activeView === 'terminal') {
      if (!session.closed) focusTerminal(session);
    } else {
      setActiveView('terminal', 'terminal');
      activateTerminalAndFocus(terminalId);
    }
    if (session.closed) {
      void reconnectV7SessionOnClick(terminalId);
    }
  });
  switchButton.addEventListener('keydown', (event) => {
    if (event.key === 'F10' && event.shiftKey) {
      event.preventDefault();
      openActions();
    }
  });
  row.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (state.terminals.has(terminalId)) {
      const rect = row.getBoundingClientRect();
      showV7SessionActionsMenu(terminalId, { left: event.clientX || rect.left, bottom: event.clientY || rect.bottom }, switchButton);
    }
  });
  actionsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openActions();
  });
  row.draggable = true;
  row.addEventListener('dragstart', (event) => {
    if (event.target.closest('.v7-session-actions, .v7-session-close, .v7-session-expand')) {
      event.preventDefault();
      return;
    }
    v7DraggedSessionId = terminalId;
    $('#v7-session-list')?.classList.add('is-session-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', terminalId);
    row.classList.add('is-dragging');
  });
  row.addEventListener('dragend', clearV7SessionDrag);
  row.addEventListener('dragover', (event) => {
    if (!v7DraggedSessionId || v7DraggedSessionId === terminalId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    showV7SessionDropPreview(row, getV7SessionDropPlacement(event, row));
  });
  row.addEventListener('dragleave', (event) => {
    if (!row.contains(event.relatedTarget)) showV7SessionDropPreview(row, '');
  });
  row.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = v7DraggedSessionId;
    const placement = getV7SessionDropPlacement(event, row);
    clearV7SessionDrag();
    if (sourceId) {
      if (placement === 'inside') nestV7Session(sourceId, terminalId);
      else if (placement === 'after-tree') {
        const parent = getV7SessionParent(state.terminals.get(terminalId));
        if (parent) moveV7SessionRelative(sourceId, parent.terminalId, 'after');
      } else moveV7SessionRelative(sourceId, terminalId, placement);
    }
  });
  row.prepend(expand);
  row.append(switchButton, actionsButton, closeButton);
  return row;
}

let v7DraggedSessionId = null;
function clearV7SessionDrag() {
  v7DraggedSessionId = null;
  $('#v7-session-list')?.classList.remove('is-session-dragging');
  $$('.v7-session-row.is-dragging, .v7-session-row.is-drop-target, .v7-session-row.is-drop-before, .v7-session-row.is-drop-after, .v7-session-row.is-drop-after-tree, .v7-session-after-root-target.is-drop-target, .v7-session-section-header.is-drop-target')
    .forEach((item) => item.classList.remove('is-dragging', 'is-drop-target', 'is-drop-before', 'is-drop-after', 'is-drop-after-tree'));
}

function updateV7SessionRow(row, session) {
  const children = getV7SessionChildren(session.terminalId);
  const isChild = Boolean(getV7SessionParent(session));
  row.classList.toggle('is-child', isChild);
  const expand = row.querySelector('.v7-session-expand');
  expand.hidden = isChild || children.length === 0;
  expand.textContent = session.v7Collapsed ? '▸' : '▾';
  expand.setAttribute('aria-expanded', String(!session.v7Collapsed));
  expand.setAttribute('aria-label', `${session.v7Collapsed ? 'Expand' : 'Collapse'} ${getTerminalTabTitle(session)} submenu`);
  const title = getTerminalTabTitle(session);
  const active = session.terminalId === state.activeTerminalId;
  const working = isTerminalTabWorking(session) || v7SessionClickReconnectPending.has(session.terminalId);
  row.classList.toggle('active', active);
  row.classList.toggle('is-working', working);
  row.classList.toggle('is-pinned', session.tabPinned === true);
  row.setAttribute('aria-busy', working ? 'true' : 'false');
  const switchButton = row.querySelector('.v7-session-item');
  switchButton.setAttribute('aria-current', active ? 'true' : 'false');
  const status = getV7SessionStatus(session);
  const action = session.closed ? 'Reconnect to' : 'Switch to';
  switchButton.setAttribute('aria-label', `${action} ${title} — ${status}`);
  switchButton.title = `${title} — ${status} · ${session.closed ? 'click to reconnect' : 'click to switch'} · right-click or use More actions`;
  // Render a clear local-terminal or SSH-server icon, only when its type
  // changes. Regular status updates must not rebuild this DOM unnecessarily.
  const sessionIcon = row.querySelector('.v7-session-dot');
  const sessionType = session.server?.type === 'local' ? 'local' : 'ssh';
  if (sessionIcon.dataset.sessionType !== sessionType) {
    sessionIcon.dataset.sessionType = sessionType;
    sessionIcon.innerHTML = sessionType === 'local'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg>';
  }
  row.querySelector('.v7-session-name strong').textContent = title;
  row.querySelector('.v7-session-name small').textContent = getV7SessionStatus(session);
  row.querySelector('.v7-session-pin').hidden = session.tabPinned !== true;
  const actionsButton = row.querySelector('.v7-session-actions');
  actionsButton?.setAttribute('aria-label', `Actions for ${title}`);
  const closeButton = row.querySelector('.v7-session-close');
  if (closeButton) {
    closeButton.disabled = false;
    closeButton.title = `Close ${title}`;
    closeButton.setAttribute('aria-label', `Close ${title}`);
  }
  const color = normalizeTerminalTabColor(session.tabColor);
  const paletteChoice = getV7SessionPaletteChoice(color);
  row.classList.toggle('has-custom-color', Boolean(color));
  if (color) {
    row.style.setProperty('--v7-session-color', color);
    row.style.setProperty('--v7-session-color-idle', paletteChoice?.idle || `color-mix(in srgb, ${color} 18%, #202226)`);
    row.style.setProperty('--v7-session-color-hover', paletteChoice?.hover || `color-mix(in srgb, ${color} 38%, #202226)`);
    row.style.setProperty('--v7-session-color-active', paletteChoice?.active || color);
  } else {
    row.style.removeProperty('--v7-session-color');
    row.style.removeProperty('--v7-session-color-idle');
    row.style.removeProperty('--v7-session-color-hover');
    row.style.removeProperty('--v7-session-color-active');
  }
}

function renderV7MinimalSessionList() {
  const list = $('#v7-session-list');
  if (!list) return;
  const all = Array.from(state.terminals.values())
    .filter((session) => session.pendingReconnectReplacement !== true);
  const count = $('#v7-session-count');
  if (count) count.textContent = String(all.length);
  const query = String($('#v7-session-search')?.value || '').trim().toLocaleLowerCase();
  const matches = (session) => getTerminalTabTitle(session).toLocaleLowerCase().includes(query);
  const existing = new Map(Array.from(list.children)
    .filter((node) => node.classList?.contains('v7-session-row'))
    .map((node) => [node.dataset.terminalId, node]));
  const existingHeaders = new Map(Array.from(list.children)
    .filter((node) => node.classList?.contains('v7-session-section-header'))
    .map((node) => [node.dataset.v7SectionId, node]));
  const desired = [];
  const pushHeader = (key, label) => {
    const node = existingHeaders.get(key) || createV7SessionSectionHeader(key, label);
    node.textContent = label;
    desired.push(node);
  };
  const pushRow = (session) => {
    const node = existing.get(session.terminalId) || createV7SessionRow(session.terminalId);
    updateV7SessionRow(node, session);
    node.classList.remove('v7-tree-first', 'v7-tree-last', 'is-drop-after-tree');
    node.querySelector('.v7-session-after-root-target')?.classList.remove('is-active', 'is-drop-target');
    desired.push(node);
    return node;
  };
  // A drop target extends just past the final child into the empty gutter.
  // It is absolute-positioned, so it cannot add gaps to the normal sidebar.
  const attachAfterRootTarget = (row, rootId) => {
    let zone = row.querySelector('.v7-session-after-root-target');
    if (!zone) {
      zone = document.createElement('div');
      zone.className = 'v7-session-after-root-target';
      zone.setAttribute('aria-hidden', 'true');
      zone.addEventListener('dragover', (event) => {
        if (!v7DraggedSessionId || v7DraggedSessionId === zone.dataset.afterRootId) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        zone.classList.add('is-drop-target');
      });
      zone.addEventListener('dragleave', (event) => {
        if (!zone.contains(event.relatedTarget)) zone.classList.remove('is-drop-target');
      });
      zone.addEventListener('drop', (event) => {
        const destinationId = zone.dataset.afterRootId;
        if (!v7DraggedSessionId || v7DraggedSessionId === destinationId) return;
        event.preventDefault();
        event.stopPropagation();
        const sourceId = v7DraggedSessionId;
        clearV7SessionDrag();
        moveV7SessionRelative(sourceId, destinationId, 'after');
      });
      row.appendChild(zone);
    }
    zone.dataset.afterRootId = rootId;
    zone.classList.add('is-active');
  };
  // The parent is the only section owner. Children always follow it as
  // independent, indented full-width tabs, with no duplicate pinned shortcuts.
  const roots = all.filter((session) => !getV7SessionParent(session));
  const seen = new Set();
  const appendTree = (root) => {
    const children = getV7SessionChildren(root.terminalId);
    const rootMatch = !query || matches(root);
    const matchingChildren = children.filter((child) => !query || rootMatch || matches(child));
    if (!rootMatch && !matchingChildren.length) return;
    pushRow(root);
    seen.add(root.terminalId);
    const visibleChildren = query || !root.v7Collapsed ? matchingChildren : [];
    visibleChildren.forEach((child, index) => {
      const row = pushRow(child);
      if (index === 0) row.classList.add('v7-tree-first');
      if (index === visibleChildren.length - 1) {
        row.classList.add('v7-tree-last');
        attachAfterRootTarget(row, root.terminalId);
      }
      seen.add(child.terminalId);
    });
  };
  const pinned = getV7OrderedSessions(roots.filter((root) => root.tabPinned));
  const regular = getV7OrderedSessions(roots.filter((root) => !root.tabPinned));
  if (!query || pinned.some((root) => matches(root) || getV7SessionChildren(root.terminalId).some(matches))) {
    pushHeader('v7-section-pinned', 'PINNED');
  }
  pinned.forEach(appendTree);
  if (!query || regular.some((root) => matches(root) || getV7SessionChildren(root.terminalId).some(matches))) {
    pushHeader('v7-section-sessions', 'SESSIONS LIST');
  }
  regular.forEach(appendTree);
  // Defensive fallback: no session may disappear due to malformed parent metadata.
  all.filter((session) => !seen.has(session.terminalId) && !getV7SessionParent(session) && (!query || matches(session)))
    .forEach((session) => { if (!desired.some((node) => node.dataset?.terminalId === session.terminalId)) pushRow(session); });
  const wanted = new Set(desired);
  desired.forEach((node, index) => {
    if (list.children[index] !== node) list.insertBefore(node, list.children[index] || null);
  });
  Array.from(list.children).forEach((node) => { if (!wanted.has(node)) node.remove(); });
  if (!desired.some((node) => node.classList?.contains('v7-session-row'))) {
    const empty = document.createElement('p');
    empty.className = 'v7-sessions-empty';
    empty.textContent = all.length ? 'No matching sessions' : 'No open sessions — use + to open one';
    list.appendChild(empty);
  }
}

function setV7MenuOpen(open) {
  const panel = $('#v7-shell-menu');
  const toggle = $('#v7-shell-menu-toggle');
  if (!panel || !toggle) return;
  panel.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
}

// V7 sidebar: show open sessions by default. Original Servers / Commands DOM
// remains mounted and functional, reachable from the main application menu.
function setV7SidebarView(view) {
  const normalized = view === 'servers' || view === 'commands' ? view : 'sessions';
  // Preserve old search/menu entry points while routing directories to the
  // on-demand side panel instead of replacing the open Sessions list.
  if (window.v7PushFlyout) {
    if (normalized === 'servers' || normalized === 'commands') {
      window.v7PushFlyout.openTool(normalized);
      return;
    }
    window.v7PushFlyout.close();
  }
  const panel = $('#servers-panel');
  if (!panel) return;

  panel.classList.toggle('v7-sessions-only', normalized === 'sessions');
  panel.classList.toggle('v7-directory-view', normalized !== 'sessions');

  $$('.v7-sidebar-nav-action').forEach((button) => {
    const selected = button.dataset.v7SidebarView === normalized;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  // A menu selection is explicit user navigation. Do not write UI preferences
  // or change SSH/terminal data, credentials or running sessions.
  if (state.connectionsPanelCollapsed) setConnectionsPanelCollapsed(false, false);
  if (state.activeView !== 'terminal') setActiveView('terminal', 'terminal');
  if (normalized === 'servers') setLeftTab('connections');
  if (normalized === 'commands') setLeftTab('commands');
  if (normalized === 'sessions') renderV7MinimalSessionList();
}

function closeV7GlobalResults() {
  const results = $('#v7-global-results');
  const input = $('#v7-global-search');
  if (results) { results.hidden = true; results.replaceChildren(); }
  input?.setAttribute('aria-expanded', 'false');
}

function renderV7GlobalResults() {
  const input = $('#v7-global-search');
  const panel = $('#v7-global-results');
  if (!input || !panel) return;
  const query = String(input.value || '').trim().toLocaleLowerCase();
  panel.replaceChildren();
  if (!query) { closeV7GlobalResults(); return; }
  const matches = [];
  // Never include credentials, command bodies, host names or key paths in results.
  for (const session of state.terminals.values()) {
    const title = getTerminalTabTitle(session);
    if (title.toLocaleLowerCase().includes(query)) {
      matches.push({ type: 'Session', name: title, run: () => {
        setActiveView('terminal', 'terminal');
        activateTerminalAndFocus(session.terminalId);
      }});
    }
  }
  for (const server of state.settings?.servers || []) {
    const name = String(server.name || 'Unnamed connection');
    if (name.toLocaleLowerCase().includes(query)) {
      matches.push({ type: 'Connection', name, run: () => {
        setActiveView('terminal', 'terminal');
        setV7SidebarView('servers');
        setConnectionGroupFilter('all');
        setConnectionFilter('all');
        const search = $('#server-search');
        if (search) search.value = name;
        renderServerList();
        $('#server-list .server-card')?.scrollIntoView({ block: 'nearest' });
      }});
    }
  }
  for (const command of state.settings?.commands || []) {
    const name = String(command.name || 'Unnamed command');
    if (name.toLocaleLowerCase().includes(query)) {
      matches.push({ type: 'Command', name, run: () => {
        setActiveView('terminal', 'terminal');
        setV7SidebarView('commands');
        const search = $('#command-search');
        if (search) search.value = name;
        renderCommandList();
      }});
    }
  }
  for (const page of [{name:'Settings',view:'settings'}, {name:'Reports',view:'report'}, {name:'Help',view:'about'}, {name:'Terminal',view:'terminal'}]) {
    if (page.name.toLocaleLowerCase().includes(query)) matches.push({type:'Page',name:page.name,run:()=>setActiveView(page.view)});
  }
  matches.slice(0,9).forEach((match) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'v7-result-item';
    const kind = document.createElement('small');
    kind.textContent = match.type;
    const label = document.createElement('span');
    label.textContent = match.name;
    button.append(kind, label);
    button.addEventListener('click', () => {
      closeV7GlobalResults();
      input.value = '';
      match.run();
    });
    panel.appendChild(button);
  });
  if (!panel.childElementCount) {
    const empty = document.createElement('p');
    empty.className = 'v7-no-results';
    empty.textContent = 'No matching sessions, connections, or commands';
    panel.appendChild(empty);
  }
  panel.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}


// V7 quick-launch menu: the existing saved-terminal picker and connection modal
// own the actual operations. This menu only chooses which already-supported
// workflow to open, with no auto-connect, settings write, or extra timers.
let v7NewSessionMenu = null;
let v7NewSessionTrigger = null;

function createV7QuickLocalServer(shell) {
  if (!['powershell', 'cmd'].includes(shell)) return null;
  return {
    id: randomId('quick-local'),
    type: 'local',
    name: shell === 'cmd' ? 'Command Prompt' : 'PowerShell',
    shell: shell === 'cmd' ? 'cmd.exe' : 'powershell.exe',
    workingDirectory: '',
    quickLocalShell: shell
  };
}

async function launchV7QuickLocalTerminal(shell = 'powershell') {
  if (state.connectionAttemptInFlight || getConnectingTerminalSession()) {
    showToast('Finish opening the current connection first.', 3500, 'warning');
    return;
  }
  const server = createV7QuickLocalServer(shell);
  if (!server) return;
  closeV7NewSessionMenu();
  setActiveView('terminal', 'terminal');
  await connectSelectedServer({ serverOverride: server });
}

function closeV7NewSessionMenu({ restoreFocus = false } = {}) {
  const menu = v7NewSessionMenu;
  const trigger = v7NewSessionTrigger;
  v7NewSessionMenu = null;
  v7NewSessionTrigger = null;
  menu?.remove();
  trigger?.setAttribute('aria-expanded', 'false');
  if (restoreFocus && trigger?.isConnected) trigger.focus();
}

function toggleV7NewSessionMenu(trigger, { quickLocal = false } = {}) {
  if (v7NewSessionMenu) {
    closeV7NewSessionMenu({ restoreFocus: true });
    return;
  }
  closeTerminalTabPicker();
  setV7MenuOpen(false);

  const menu = document.createElement('div');
  menu.className = 'v7-new-session-menu';
  menu.id = 'v7-new-session-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', quickLocal ? 'Choose local terminal shell' : 'New session options');
  const heading = document.createElement('div');
  heading.className = 'v7-new-session-heading';
  heading.textContent = quickLocal ? 'NEW TERMINAL' : 'NEW SESSION';
  menu.appendChild(heading);

  const choices = quickLocal ? [
    { title: 'PowerShell', hint: 'Open a new local PowerShell terminal', action: () => launchV7QuickLocalTerminal('powershell') },
    { title: 'Command Prompt (CMD)', hint: 'Open a new Windows CMD terminal', action: () => launchV7QuickLocalTerminal('cmd') }
  ] : [
    { title: 'Saved local terminals', hint: 'Open a saved PowerShell or local project', action: () => showTerminalTabPicker(trigger, { typeFilter: 'local' }) },
    { title: 'Saved SSH connections', hint: 'Select a saved remote server', action: () => showTerminalTabPicker(trigger, { typeFilter: 'remote' }) },
    { title: 'New local project', hint: 'Configure a local terminal start folder', action: () => openAddConnectionModal('local', true) },
    { title: 'New SSH connection', hint: 'Configure a new saved SSH server', action: () => openAddConnectionModal('remote', true) }
  ];
  for (const choice of choices) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'v7-new-session-item';
    item.setAttribute('role', 'menuitem');
    const title = document.createElement('span');
    title.textContent = choice.title;
    const hint = document.createElement('small');
    hint.textContent = choice.hint;
    item.append(title, hint);
    item.addEventListener('click', () => {
      closeV7NewSessionMenu();
      choice.action();
    });
    menu.appendChild(item);
  }
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeV7NewSessionMenu({ restoreFocus: true });
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menu.querySelectorAll('.v7-new-session-item'));
    const index = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (index + 1 + items.length) % items.length
      : (index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length);
    items[next]?.focus();
  });
  v7NewSessionTrigger = trigger;
  v7NewSessionMenu = menu;
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'true');
  document.body.appendChild(menu);
  positionTerminalTabPicker(trigger, menu);
  menu.querySelector('.v7-new-session-item')?.focus();
}

function bindV7MinimalShell() {
  const menu = $('#v7-shell-menu');
  $('#v7-shell-menu-toggle')?.addEventListener('click', () => setV7MenuOpen(Boolean(menu?.hidden)));
  menu?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-v7-sidebar-view]');
    if (!button) return;
    setV7SidebarView(button.dataset.v7SidebarView);
    setV7MenuOpen(false);
  });
  // These controls already have existing click handlers. Closing the menu does
  // not replay or replace any action; that prevents duplicate execution.
  menu?.addEventListener('click', (event) => {
    if (event.target.closest('.menu-item, .tool-button')) setV7MenuOpen(false);
  });
  document.addEventListener('pointerdown', (event) => {
    if (v7NewSessionMenu && !v7NewSessionMenu.contains(event.target) && !v7NewSessionTrigger?.contains(event.target)) closeV7NewSessionMenu();
    if (menu && !menu.hidden && !event.target.closest('.v7-shell-menu-wrap')) setV7MenuOpen(false);
    if (!event.target.closest('.v7-quick-search')) closeV7GlobalResults();
  });
  const input = $('#v7-global-search');
  input?.addEventListener('input', renderV7GlobalResults);
  input?.addEventListener('focus', () => { if (input.value.trim()) renderV7GlobalResults(); });
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeV7GlobalResults();
      input.blur();
    } else if (event.key === 'Enter') {
      const first = $('#v7-global-results .v7-result-item');
      if (first) { event.preventDefault(); first.click(); }
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeV7NewSessionMenu();
    if (event.key === 'Escape' && menu && !menu.hidden) setV7MenuOpen(false);
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      setV7MenuOpen(false);
      input?.focus();
      input?.select();
    }
  });
  $('#v7-new-session')?.addEventListener('click', (event) => toggleV7NewSessionMenu(event.currentTarget));
  $('#v7-sidebar-new-session')?.addEventListener('click', (event) =>
    toggleV7NewSessionMenu(event.currentTarget, { quickLocal: true }));
  const sessionList = $('#v7-session-list');
  sessionList?.addEventListener('dragover', (event) => {
    const header = event.target.closest('.v7-session-section-header');
    if (!header || !v7DraggedSessionId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    header.classList.add('is-drop-target');
  });
  sessionList?.addEventListener('dragleave', (event) => {
    const header = event.target.closest('.v7-session-section-header');
    if (header && !header.contains(event.relatedTarget)) header.classList.remove('is-drop-target');
  });
  sessionList?.addEventListener('drop', (event) => {
    const header = event.target.closest('.v7-session-section-header');
    if (!header || !v7DraggedSessionId) return;
    event.preventDefault();
    const id = v7DraggedSessionId;
    const pinned = header.dataset.v7SectionId === 'v7-section-pinned';
    clearV7SessionDrag();
    moveV7SessionToSection(id, pinned);
  });
  const sessionSearch = $('#v7-session-search');
  sessionSearch?.addEventListener('input', renderV7MinimalSessionList);
  sessionSearch?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sessionSearch.value) {
      event.preventDefault();
      sessionSearch.value = '';
      renderV7MinimalSessionList();
    }
  });
  $('#v7-session-list')?.addEventListener('keydown', (event) => {
    if (!event.target.matches('.v7-session-item')) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const switches = Array.from($('#v7-session-list').querySelectorAll('.v7-session-item'));
    const index = switches.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? switches.length - 1
      : Math.max(0, Math.min(switches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    switches[next]?.focus();
  });
  $('#v7-open-settings')?.addEventListener('click', () => setActiveView('settings', 'settings'));
  renderV7MinimalSessionList();
}

// V7 command composer: reuse the existing guarded, audited terminal-write route.
// Drafts live in memory only; no terminal commands or credentials are stored.
const v7ComposerDrafts = new Map();
const v7ComposerMultilineModes = new Set();
let v7ComposerDisplayedTerminalId = null;
const v7ComposerSending = new Set();
const V7_COMPOSER_AUTO_SEND_KEY = 'advance-terminal-v7-composer-auto-send';
let v7ComposerPasteSequence = 0;

function syncV7CommandComposer() {
  const input = $('#v7-composer-input');
  const send = $('#v7-composer-send');
  if (!input || !send) return;

  const id = state.activeTerminalId || null;
  if (v7ComposerDisplayedTerminalId !== id) {
    v7ComposerDisplayedTerminalId = id;
    input.value = id ? (v7ComposerDrafts.get(id) || '') : '';
  }
  const session = id && state.terminals.get(id);
  const isMultiline = Boolean((id && v7ComposerMultilineModes.has(id)) || /[\r\n]/.test(input.value));
  const composer = $('#v7-command-composer');
  const toggle = $('#v7-composer-multiline-toggle');
  const hint = $('#v7-composer-multiline-hint');
  composer?.classList.toggle('is-multiline', isMultiline);
  if (toggle) toggle.setAttribute('aria-pressed', String(isMultiline));
  if (hint) hint.hidden = !isMultiline;
  input.rows = isMultiline ? 5 : 1;
  input.title = isMultiline
    ? 'Enter adds a line · Ctrl+Enter reviews and sends the complete command'
    : 'Enter sends · Shift+Enter adds a line · Ctrl+Enter sends';
  // Expand only the editor; never resize or rebuild the active terminal.
  if (isMultiline) {
    input.style.height = 'auto';
    input.style.height = `${Math.min(320, Math.max(112, input.scrollHeight || 112))}px`;
  } else {
    input.style.removeProperty('height');
  }
  const unavailable = !session || session.closed || v7ComposerSending.has(id);
  send.disabled = unavailable || !input.value.trim();
  send.title = !session || session.closed ? 'Connect or reconnect a terminal to send'
    : v7ComposerSending.has(id) ? 'Sending command...'
      : isMultiline ? 'Review and send multi-line command (Ctrl+Enter)' : 'Send command (Enter)';
}

async function sendV7ComposerCommand({ automaticPaste = false } = {}) {
  const input = $('#v7-composer-input');
  const value = String(input?.value || '');
  if (!input || !value.trim()) return false;
  const terminalId = state.activeTerminalId;
  const session = state.terminals.get(terminalId);
  if (!session || session.closed) {
    showToast('Connect or reconnect a terminal before sending.', 3500, 'warning');
    syncV7CommandComposer();
    return false;
  }
  if (v7ComposerSending.has(terminalId)) return false;
  v7ComposerSending.add(terminalId);
  syncV7CommandComposer();
  try {
    const sent = await writeClipboardTextToTerminal(session, value, 'Command input', {
      autoEnter: true,
      preserveFocus: true,
      normalizeLineEndings: true,
      requireMultilineConfirm: automaticPaste || isMultilinePasteText(value),
      requireActiveSession: true,
      quiet: true
    });
    if (sent) {
      v7ComposerDrafts.delete(terminalId);
      if (state.activeTerminalId === terminalId && input.value === value) {
        input.value = '';
      }
      if (state.activeTerminalId === terminalId) input.focus();
    }
    return sent;
  } catch (error) {
    showToast(`Command not sent: ${error.message}`, 5000, 'error');
    return false;
  } finally {
    v7ComposerSending.delete(terminalId);
    if (state.activeTerminalId === terminalId) {
      v7ComposerDrafts.set(terminalId, input.value);
    }
    syncV7CommandComposer();
  }
}

function bindV7CommandComposer() {
  const input = $('#v7-composer-input');
  const auto = $('#v7-composer-auto-send');
  const project = $('#v7-composer-project');
  const multiline = $('#v7-composer-multiline-toggle');
  if (!input || !auto || !project) return;
  multiline?.addEventListener('click', () => {
    const id = state.activeTerminalId;
    if (!id) return;
    if (v7ComposerMultilineModes.has(id)) {
      if (/[\r\n]/.test(input.value)) {
        showToast('Remove line breaks before returning to single-line mode.', 3500, 'warning');
        return;
      }
      v7ComposerMultilineModes.delete(id);
    } else {
      v7ComposerMultilineModes.add(id);
    }
    syncV7CommandComposer();
    input.focus();
  });

  try { auto.checked = localStorage.getItem(V7_COMPOSER_AUTO_SEND_KEY) === 'true'; }
  catch (_) { auto.checked = false; }
  auto.addEventListener('change', () => {
    try { localStorage.setItem(V7_COMPOSER_AUTO_SEND_KEY, String(auto.checked)); }
    catch (_) { /* Optional UI preference; the command path remains available. */ }
  });

  input.addEventListener('input', () => {
    // An edit after an auto-paste cancels its queued auto-send.
    v7ComposerPasteSequence += 1;
    const id = state.activeTerminalId;
    if (id) v7ComposerDrafts.set(id, input.value);
    syncV7CommandComposer();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
    // Preserve single-line Enter-to-run. In multi-line mode, Enter edits the
    // draft; Ctrl+Enter sends it after the multi-line safety review.
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      void sendV7ComposerCommand();
      return;
    }
    if (event.shiftKey || v7ComposerMultilineModes.has(state.activeTerminalId)
        || /[\r\n]/.test(input.value)) return;
    event.preventDefault();
    void sendV7ComposerCommand();
  });
  input.addEventListener('paste', (event) => {
    if (!auto.checked || !event.clipboardData) return;
    const pasted = event.clipboardData.getData('text/plain');
    if (!pasted) return;
    // Only auto-send after the user deliberately enables the switch and pastes.
    event.preventDefault();
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.slice(0, start) + pasted + input.value.slice(end);
    const terminalId = state.activeTerminalId;
    if (terminalId) v7ComposerDrafts.set(terminalId, input.value);
    input.setSelectionRange(start + pasted.length, start + pasted.length);
    syncV7CommandComposer();
    // Auto-send is for short one-line commands only. Always keep a multi-line
    // script visible in the editor until the user explicitly reviews it.
    if (/[\r\n]/.test(input.value) || v7ComposerMultilineModes.has(terminalId)) {
      v7ComposerPasteSequence += 1;
      return;
    }

    // Give the browser a real paint opportunity before sending and clearing
    // the composer. If the user edits, switches tab, or disables auto-send,
    // keep the draft rather than running a stale paste.
    const pasteSequence = ++v7ComposerPasteSequence;
    const pastedDraft = input.value;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (pasteSequence !== v7ComposerPasteSequence || !auto.checked
            || state.activeTerminalId !== terminalId || input.value !== pastedDraft) return;
        void sendV7ComposerCommand({ automaticPaste: true });
      });
    });
  });
  $('#v7-composer-send')?.addEventListener('click', () => { void sendV7ComposerCommand(); });
  project.addEventListener('click', () => toggleV7NewSessionMenu(project));
  syncV7CommandComposer();
}

function bindEvents() {
  bindV7MinimalShell();
  bindV7CommandComposer();
  document.addEventListener('keydown', handleTerminalSearchShortcut, true);

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

  $('#terminal-nav-back')?.addEventListener('click', () => navigateTerminalTab('back'));
  $('#terminal-nav-forward')?.addEventListener('click', () => navigateTerminalTab('forward'));
  $('#terminal-nav-reload')?.addEventListener('click', () => {
    reloadActiveTerminalDisplay().catch((error) => {
      showToast(`Terminal refresh failed: ${error.message}`, 5000, 'error');
    });
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

  $('#connection-group-filter-toggle')?.addEventListener('click', () => {
    const popover = $('#connection-group-filter-popover');
    setConnectionGroupFilterPopoverOpen(Boolean(popover?.hidden));
  });

  $('#connection-group-filter')?.addEventListener('change', (event) => {
    setConnectionGroupFilter(event.target.value);
    setConnectionGroupFilterPopoverOpen(false, true);
  });

  document.addEventListener('pointerdown', (event) => {
    const popover = $('#connection-group-filter-popover');
    if (popover && !popover.hidden && !event.target.closest('.connection-search-row')) {
      setConnectionGroupFilterPopoverOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#connection-group-filter-popover')?.hidden) {
      setConnectionGroupFilterPopoverOpen(false, true);
      event.preventDefault();
      event.stopPropagation();
    }
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
  $('#tool-new-server').addEventListener('click', () => openAddConnectionModal('remote', true));
  $('#connections-panel-toggle')?.addEventListener('click', toggleConnectionsPanelCollapsed);

  $('#tool-save-settings').addEventListener('click', exportSettingsBackup);
  $('#settings-save-main').addEventListener('click', exportSettingsBackup);
  $('#tool-import-settings')?.addEventListener('click', importSettingsBackup);
  $('#settings-import-main')?.addEventListener('click', importSettingsBackup);
  $('#tool-repair-settings')?.addEventListener('click', repairSettingsFromLocalBackup);
  $('#settings-repair-main')?.addEventListener('click', repairSettingsFromLocalBackup);
  $('#tool-file-settings')?.addEventListener('click', () => setActiveView('settings', 'settings'));
  $('#tool-file-about')?.addEventListener('click', () => setActiveView('about', 'help'));

  $('#tool-view-notification')?.addEventListener('click', () => {
    setActiveView('view', 'view');
    previewNotification();
  });

  $('#view-preview-notification')?.addEventListener('click', () => {
    setActiveView('view', 'view');
    previewNotification();
  });
  $('#tool-view-terminal')?.addEventListener('click', () => setActiveView('terminal', 'terminal'));
  $('#tool-view-settings')?.addEventListener('click', () => setActiveView('settings', 'settings'));

  $('#tool-settings-appearance')?.addEventListener('click', () => {
    setActiveView('settings', 'settings');
    setSettingsTab('appearance');
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
  $('#tool-close-terminal')?.addEventListener('click', () => closeTerminalSession(null, { force: true }));
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


  $('#terminal-action-new')?.addEventListener('click', newTerminalActionFromManager);
  $('#terminal-action-duplicate')?.addEventListener('click', duplicateTerminalActionFromManager);
  $('#terminal-action-delete')?.addEventListener('click', deleteTerminalActionFromManager);
  $('#terminal-action-move-up')?.addEventListener('click', () => moveTerminalActionFromManager(-1));
  $('#terminal-action-move-down')?.addEventListener('click', () => moveTerminalActionFromManager(1));
  $('#terminal-action-reset')?.addEventListener('click', resetTerminalActionsToDefault);
  $('#terminal-action-save')?.addEventListener('click', saveTerminalActionFromManager);
  $('#terminal-action-kind')?.addEventListener('change', updateTerminalActionFormVisibility);

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
  $('#ai-provider-select')?.addEventListener('change', (event) => {
    const modelInput = $('#ai-openai-model');
    if (modelInput) modelInput.value = event.target.value === 'lmstudio' ? 'qwen/qwen3.5-9b' : 'gpt-5.5';
    saveAiSettingsFromControls().catch((error) => showToast(`AI provider save failed: ${error.message}`, 7000, 'error'));
  });
  $('#ai-project-inspect')?.addEventListener('click', () => {
    inspectActiveProjectWithLocalAi().catch((error) => showToast(error.message, 6000, 'error'));
  });
  $('#ai-project-copy')?.addEventListener('click', () => {
    const result = $('#ai-project-answer')?.value || '';
    if (!result) return showToast('No AI analysis to copy.', 3000, 'warning');
    navigator.clipboard.writeText(result).then(() => showToast('AI analysis copied.', 3000, 'success')).catch(() => showToast('Unable to copy AI analysis.', 4000, 'error'));
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
  $('#in-app-toast-mode-select')?.addEventListener('change', (event) => {
    setInAppToastMode(event.target.value);
  });

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

  document.addEventListener('click', hideSidebarContextMenu);
  document.addEventListener('pointerdown', (event) => {
    if (terminalTabContextMenu && !terminalTabContextMenu.contains(event.target)) {
      closeTerminalTabContextMenu();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!terminalTabPickerMenu) {
      return;
    }

    if (terminalTabPickerMenu.contains(event.target) || terminalTabPickerButton?.contains(event.target)) {
      return;
    }

    closeTerminalTabPicker();
  });
  document.addEventListener('contextmenu', (event) => {
    if (!event.target.closest('.server-card, .command-card, #sidebar-context-menu')) {
      hideSidebarContextMenu();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideSidebarContextMenu();
      closeTerminalTabPicker({ restoreFocus: true });
    }
  });

  window.addEventListener('resize', () => {
    hideSidebarContextMenu();
    closeV7NewSessionMenu();
    closeTerminalTabPicker();
    closeTerminalTabContextMenu();
    // ResizeObserver already follows #terminal-host geometry; calling
    // fitActiveTerminal here queued three more fits for every drag event.
    // Use a single-frame fallback only on older runtimes without an observer.
    if (!v7TerminalHostResizeObserver) {
      const session = state.terminals.get(state.activeTerminalId);
      if (session) requestAnimationFrame(() => fitTerminalSessionNow(session));
    }
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

  // A Windows notification click targets the original tab without changing
  // its order, pin, group or background session state.
  window.advanceTerminal.onTerminalNotificationOpen?.((payload) => {
    const terminalId = payload?.terminalId;
    if (typeof terminalId !== 'string' || !state.terminals.has(terminalId)) return;
    activateTerminalAndFocus(terminalId);
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
        // Auto reconnect is routine state, already shown in the session/tab UI.
        // Do not interrupt the user with a repeated floating warning.
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

      if (errorMessage || Number(payload.code)) {
        showToast(
          errorMessage
            ? `${session.server?.name || 'SSH connection'}: ${errorMessage}`
            : `${session.server?.name || 'Terminal'} disconnected with code ${payload.code}.`,
          errorMessage ? 9000 : 6000,
          'error'
        );
      }
    }
  });
}

async function init() {
  bindEvents();

  state.appInfo = await window.advanceTerminal.getAppInfo();

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
  updateInAppToastModeControl();
  updatePasteProtectionControls();
  updateActivityFeedOutputControls();
  await refreshAiStatus({ silent: true });
  setConnectionsPanelCollapsed(readConnectionsPanelCollapsedPreference(), false);
  renderTerminalToolbarActions();
  updateConnectionFilterButtons();

  $('#mode-label').textContent = state.appInfo?.displayVersion || 'Advance Terminal V7';

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
  restoreSavedTerminalSessions();
  renderV7MinimalSessionList();
  setupV7TerminalHostResizeObserver();
  state.activityFeedReady = true;
}

init().catch((error) => {
  showToast(`Startup error: ${error.message}`, 9000);
});
