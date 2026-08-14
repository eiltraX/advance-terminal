/* global window */
'use strict';

(function attachRendererFoundationHelpers() {
  const DEFAULT_LIVE_CONSOLE_MAX_MESSAGE_LENGTH = 1600;

  function randomId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }

  function inferToastType(message, type = null) {
    if (type) {
      return type;
    }

    const text = String(message || '').toLowerCase();

    if (/(failed|error|denied|invalid|missing|required|cannot|can't|wrong)/.test(text)) {
      return 'error';
    }

    if (/(warning|select|empty|cancelled|needs|required|first|closed|exited)/.test(text)) {
      return 'warning';
    }

    if (/(saved|copied|connected|generated|enabled|sent|pasted|deleted|duplicated|updated|reset)/.test(text)) {
      return 'success';
    }

    return 'info';
  }

  function normalizeNotificationPosition(value) {
    const allowed = [
      'top-left',
      'top-center',
      'top-right',
      'bottom-left',
      'bottom-center',
      'bottom-right'
    ];

    const normalized = String(value || '').toLowerCase();

    return allowed.includes(normalized) ? normalized : 'bottom-right';
  }

  function liveConsoleTime() {
    return new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function stripTerminalControlText(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\x1B\][^\x07]*(\x07|\x1B\\)/g, '')
      .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
      .replace(/\x1B[@-_]/g, '')
      .replace(/\x07/g, '');
  }

  function trimLiveConsoleMessage(message) {
    const value = String(message || '');

    if (value.length <= DEFAULT_LIVE_CONSOLE_MAX_MESSAGE_LENGTH) {
      return value;
    }

    return `${value.slice(0, DEFAULT_LIVE_CONSOLE_MAX_MESSAGE_LENGTH)}\n… output shortened to keep the app responsive`;
  }

  function reportTimestamp(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }

  function todayReportDateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return date.toISOString().slice(0, 10);
  }

  function formatReportDuration(ms) {
    const seconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const remainingSeconds = String(seconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${remainingSeconds}`;
  }

  function formatHumanDuration(ms) {
    const seconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    }

    if (minutes > 0) {
      return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`;
    }

    return `${remainingSeconds}s`;
  }

  function reportByteLength(value) {
    return new Blob([String(value || '')]).size;
  }

  function redactSecrets(value) {
    let text = String(value || '');

    text = text.replace(/(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g, '-----BEGIN PRIVATE KEY-----\n[REDACTED PRIVATE KEY]\n-----END PRIVATE KEY-----');
    text = text.replace(/(\bAuthorization\s*:\s*Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1********');
    text = text.replace(/(\b(?:password|passphrase|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|db_password|database_password)\b\s*[:=]\s*)(["']?)[^\s"'`;&|]+(\2)/gi, '$1$2********$3');
    text = text.replace(/((?:^|\n)[^\n]*password[^\n]*:\s*)[^\n\r]*/gi, '$1********');

    return text;
  }

  function compactReportText(value, maxLength = 140000) {
    const text = redactSecrets(String(value || ''));

    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, 6000)}\n\n[... report log truncated, ${text.length - maxLength} characters omitted ...]\n\n${text.slice(-maxLength + 6000)}`;
  }

  function formatReportSize(bytes) {
    const value = Number(bytes || 0);

    if (value < 1024) {
      return `${value} B`;
    }

    if (value < 1024 * 1024) {
      return `${Math.max(1, Math.round(value / 1024))} KB`;
    }

    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  function normalizeReportOutputText(value) {
    const text = stripTerminalControlText(value)
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n');

    return text.replace(/\n{4,}/g, '\n\n\n').trimEnd();
  }

  function safeCounterLabel(value) {
    return String(value || 'Other activity')
      .replace(/[\r\n]+/g, ' ')
      .replace(/[|`]+/g, '')
      .trim()
      .slice(0, 80) || 'Other activity';
  }

  function incrementCounter(map, key, amount = 1) {
    const label = safeCounterLabel(key);
    const value = Math.max(0, Number(amount || 0));

    if (!map || !label || !value) {
      return;
    }

    map[label] = Math.round((Number(map[label] || 0) + value) * 100) / 100;
  }

  function mergeCounters(target, source, amount = 1) {
    if (!target || !source || typeof source !== 'object') {
      return;
    }

    Object.entries(source).forEach(([key, value]) => {
      incrementCounter(target, key, Number(value || 0) * amount);
    });
  }

  function topCounterRows(map, emptyText = 'No activity detected yet.', limit = 12) {
    const entries = Object.entries(map || {})
      .filter(([, value]) => Number(value || 0) > 0)
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .slice(0, limit);

    if (!entries.length) {
      return [`- ${emptyText}`];
    }

    return entries.map(([key, value]) => `- ${key}: ${Math.round(Number(value || 0))}`);
  }

  function clampInteger(value, fallback, min, max) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function getPathFileName(filePath) {
    const parts = String(filePath || '').split(/[\\/]/);
    return parts[parts.length - 1] || String(filePath || '');
  }

  function formatSshKeyDate(value) {
    if (!value) {
      return 'Unknown date';
    }

    try {
      return new Date(value).toLocaleString();
    } catch (_) {
      return 'Unknown date';
    }
  }

  function getSshKeyLabel(key) {
    const publicStatus = key.hasPublicKey ? '' : ' · public key missing';
    return `${key.name} — ${key.locationLabel}${publicStatus}`;
  }

  window.AdvanceTerminalRendererFoundation = Object.freeze({
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
  });
}());
