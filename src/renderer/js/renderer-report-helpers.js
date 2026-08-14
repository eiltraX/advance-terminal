/* global window */
'use strict';

(function initAdvanceTerminalRendererReportHelpers() {
  const foundation = window.AdvanceTerminalRendererFoundation;
  const terminalHelpers = window.AdvanceTerminalRendererTerminalHelpers;

  if (!foundation) {
    throw new Error('Renderer foundation helpers failed to load before report helpers.');
  }

  if (!terminalHelpers) {
    throw new Error('Renderer terminal helpers failed to load before report helpers.');
  }

  const {
    randomId,
    todayReportDateKey,
    redactSecrets,
    incrementCounter,
    mergeCounters,
    formatHumanDuration
  } = foundation;

  const {
    classifyIssueText
  } = terminalHelpers;

  const REPORT_HISTORY_MAX_ITEMS = 100;
  const REPORT_CUSTOM_RANGE_MAX_DAYS = 90;
  const REPORT_JOB_MAX_PER_DAY = 250;
  const REPORT_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const DEFAULT_REPORT_OPTIONS = Object.freeze({
    showSummary: true,
    showTimeBreakdown: true,
    showRealJobs: true,
    showConnectionBreakdown: true,
    showCommandsAnalyzed: true,
    showActivityAnalysis: true,
    showIssueSummary: true,
    showSuggestedNextActions: true,
    showMetadata: true
  });

  function normalizeReportOptionsClient(value = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};

    return Object.fromEntries(
      Object.entries(DEFAULT_REPORT_OPTIONS).map(([key, fallback]) => [key, typeof source[key] === 'boolean' ? source[key] : fallback])
    );
  }



  function reportLocalDateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return todayReportDateKey();
    }

    // Report usage is stored by UTC date key for backward compatibility.
    return todayReportDateKey(date);
  }

  function sanitizeReportJobCommand(value = '') {
    return redactSecrets(String(value || ''))
      .replace(/\b(password|passwd|passphrase|token|secret|api[_-]?key)\s*=\s*[^\s;&|]+/gi, '$1=[REDACTED]')
      .replace(/(--?(?:password|passwd|passphrase|token|secret|api[_-]?key))(?:=|\s+)([^\s;&|]+)/gi, '$1 [REDACTED]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
  }

  function inferReportJobType(command = '', categories = []) {
    const text = `${String(command || '')} ${(categories || []).join(' ')}`.toLowerCase();

    if (/\b(deploy|release|rsync|scp|sftp|zip|unzip|tar|public_html|git pull|git push)\b/.test(text)) {
      return 'Deployment';
    }

    if (/\b(test|phpunit|pest|jest|vitest|playwright|cypress|lint|check)\b/.test(text)) {
      return 'Testing / Verification';
    }

    if (/\b(migrate|mysql|mariadb|postgres|psql|redis|database|db:)\b/.test(text)) {
      return 'Database';
    }

    if (/\b(composer|npm|yarn|pnpm|package|dependency|install|update)\b/.test(text)) {
      return 'Dependencies / Build';
    }

    if (/\b(artisan|cache|config|queue|service|systemctl|chmod|chown|permission|log|tail)\b/.test(text)) {
      return 'Maintenance';
    }

    if (/\b(git|branch|commit|merge|rebase|status|diff)\b/.test(text)) {
      return 'Version Control';
    }

    if (/\b(cd|ls|dir|pwd|find|grep|cat|type|Get-ChildItem|Get-Content)\b/i.test(command)) {
      return 'Inspection';
    }

    return 'Development';
  }

  function normalizeReportJob(value = {}) {
    const startedAt = String(value.startedAt || '');
    const endedAt = String(value.endedAt || '');
    const startedMs = new Date(startedAt).getTime();
    const endedMs = new Date(endedAt).getTime();
    const durationMs = Math.max(
      0,
      Math.round(Number(value.durationMs || (
        Number.isFinite(startedMs) && Number.isFinite(endedMs) ? endedMs - startedMs : 0
      )))
    );

    return {
      id: String(value.id || randomId('report-job')).slice(0, 120),
      terminalId: String(value.terminalId || '').slice(0, 160),
      connectionId: String(value.connectionId || '').slice(0, 160),
      connectionName: String(value.connectionName || 'Terminal').slice(0, 160),
      type: value.type === 'remote' ? 'remote' : 'local',
      host: String(value.host || '').slice(0, 220),
      username: String(value.username || '').slice(0, 160),
      workingDirectory: String(value.workingDirectory || '').slice(0, 500),
      startedAt,
      endedAt,
      durationMs,
      status: String(value.status || 'running').slice(0, 60),
      workType: String(value.workType || 'Development').slice(0, 100),
      commandLabel: sanitizeReportJobCommand(value.commandLabel || value.command || ''),
      source: String(value.source || 'typed').slice(0, 40),
      issueCount: Math.max(0, Math.round(Number(value.issueCount || 0))),
      issueCategories: Array.isArray(value.issueCategories)
        ? value.issueCategories.map((item) => String(item || '').slice(0, 100)).filter(Boolean).slice(0, 12)
        : [],
      note: String(value.note || '').slice(0, 240)
    };
  }

  function createEmptyReportDay(dateKey = todayReportDateKey()) {
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

  function normalizeReportUsageClient(value = {}) {
    const today = todayReportDateKey();
    const source = value && typeof value === 'object' ? value : {};
    const days = source.days && typeof source.days === 'object' && !Array.isArray(source.days)
      ? source.days
      : {};

    if (!days[today]) {
      days[today] = createEmptyReportDay(today);
    }

    Object.keys(days).forEach((key) => {
      days[key] = {
        ...createEmptyReportDay(key),
        ...(days[key] || {}),
        activityCounters: { ...(days[key]?.activityCounters || {}) },
        issueCounters: { ...(days[key]?.issueCounters || {}) },
        connectionSummaries: { ...(days[key]?.connectionSummaries || {}) },
        sessionHistory: Array.isArray(days[key]?.sessionHistory) ? days[key].sessionHistory.slice(-300) : [],
        jobs: Array.isArray(days[key]?.jobs)
          ? days[key].jobs.slice(-REPORT_JOB_MAX_PER_DAY).map(normalizeReportJob)
          : [],
        activeSessions: days[key]?.activeSessions && typeof days[key].activeSessions === 'object'
          ? { ...days[key].activeSessions }
          : {}
      };
    });

    return {
      version: 2,
      days,
      lastOpenedDate: String(source.lastOpenedDate || today)
    };
  }

  function normalizeReportHistoryClient(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const items = Array.isArray(source.items) ? source.items : [];

    return {
      version: 1,
      items: items
        .filter((item) => item && typeof item === 'object')
        .slice(-REPORT_HISTORY_MAX_ITEMS)
        .map((item) => ({
          id: String(item.id || randomId('report-history')),
          generatedAt: String(item.generatedAt || new Date().toISOString()),
          scope: String(item.scope || 'all'),
          scopeLabel: String(item.scopeLabel || 'All Terminals'),
          dateFilter: String(item.dateFilter || 'today'),
          dateLabel: String(item.dateLabel || 'Today'),
          title: String(item.title || 'Work Activity Report'),
          summary: String(item.summary || ''),
          metrics: item.metrics && typeof item.metrics === 'object' ? {
            duration: String(item.metrics.duration || ''),
            commandCount: Number(item.metrics.commandCount || 0),
            jobCount: Number(item.metrics.jobCount || 0),
            completedJobCount: Number(item.metrics.completedJobCount || 0),
            findingCount: Number(item.metrics.findingCount || 0),
            generatedLabel: String(item.metrics.generatedLabel || '')
          } : {},
          text: String(item.text || '')
        }))
    };
  }

  function sessionConnectionKey(session) {
    const server = session?.server || {};
    return String(server.id || server.name || session?.terminalId || 'terminal');
  }

  function getConnectionSummary(day, session) {
    const key = sessionConnectionKey(session);

    if (!day.connectionSummaries[key]) {
      day.connectionSummaries[key] = {
        name: String(session?.server?.name || key),
        type: session?.server?.type === 'remote' ? 'remote' : 'local',
        sessionsOpened: 0,
        uptimeMs: 0,
        activeWorkMs: 0,
        commandCount: 0,
        inputActivityCount: 0,
        outputBytes: 0,
        reconnectCount: 0,
        disconnectCount: 0,
        activityCounters: {},
        issueCounters: {},
        lastSeenAt: null
      };
    }

    day.connectionSummaries[key].activityCounters = day.connectionSummaries[key].activityCounters || {};
    day.connectionSummaries[key].issueCounters = day.connectionSummaries[key].issueCounters || {};

    return day.connectionSummaries[key];
  }

  function extractReportFindings(rawText) {
    const lines = redactSecrets(rawText)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const patterns = [
      /\berror\b/i,
      /\bfailed\b/i,
      /\bpermission denied\b/i,
      /\bdenied\b/i,
      /\bfatal\b/i,
      /\bexception\b/i,
      /\bnot found\b/i,
      /\bnot recognized\b/i,
      /\bwarning\b/i,
      /\brefused\b/i,
      /\btimeout\b/i,
      /\bunauthorized\b/i,
      /\bauthentication\b/i
    ];

    const findings = [];
    const categories = {};

    lines.forEach((line) => {
      if (patterns.some((pattern) => pattern.test(line))) {
        classifyIssueText(line).forEach((issue) => incrementCounter(categories, issue));
        findings.push(line);
      }
    });

    return {
      rawFindings: Array.from(new Set(findings)).slice(0, 30),
      counters: categories
    };
  }

  function getIssueAssistantAdvice(issue) {
    const text = String(issue || '').toLowerCase();

    if (/permission|access/.test(text)) {
      return 'Check ownership/permissions for the connected user, then retry inside the correct folder.';
    }

    if (/authentication|ssh/.test(text)) {
      return 'Verify SSH username, port, selected private key, passphrase, and server SSH access.';
    }

    if (/connection|network/.test(text)) {
      return 'Check internet/server reachability, SSH port, hosting limits, and reconnect settings.';
    }

    if (/missing command|path/.test(text)) {
      return 'Confirm the command exists and the terminal is inside the correct project folder.';
    }

    if (/dependency/.test(text)) {
      return 'Review Composer/NPM output, keep lock files consistent, and rerun install only when needed.';
    }

    if (/git/.test(text)) {
      return 'Check the working tree, branch state, merge conflicts, and remote access.';
    }

    if (/database/.test(text)) {
      return 'Verify database credentials, server availability, migrations, and destructive SQL before retrying.';
    }

    return 'Review the latest terminal output and confirm the active folder, command, and server state.';
  }

  function buildErrorAssistantRows(issueCounters = {}) {
    const rows = Object.entries(issueCounters || {})
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .slice(0, 6)
      .map(([issue, count]) => `- ${issue}: ${Math.round(Number(count || 0))} event(s). ${getIssueAssistantAdvice(issue)}`);

    return rows.length ? rows : ['- No issue assistance needed yet.'];
  }


  function normalizeCounterEntries(counters = {}) {
    return Object.entries(counters || {})
      .map(([label, value]) => ({
        label: String(label || 'Other'),
        value: Math.max(0, Number(value || 0))
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }

  function sumCountersMatching(counters = {}, patterns = []) {
    const entries = normalizeCounterEntries(counters);
    return entries.reduce((sum, item) => {
      const label = item.label.toLowerCase();
      return patterns.some((pattern) => pattern.test(label)) ? sum + item.value : sum;
    }, 0);
  }

  function buildSmartReportSummary(aggregate = {}, summaries = []) {
    const activityCounters = aggregate.activityCounters || {};
    const issueCounters = aggregate.issueCounters || {};
    const activityEntries = normalizeCounterEntries(activityCounters);
    const issueEntries = normalizeCounterEntries(issueCounters);
    const totalActivity = activityEntries.reduce((sum, item) => sum + item.value, 0);
    const totalIssues = issueEntries.reduce((sum, item) => sum + item.value, 0);
    const commandCount = Math.max(0, Number(aggregate.commandCount || 0));
    const activeWorkMs = Math.max(0, Number(aggregate.activeWorkMs || 0));
    const terminalUptimeMs = Math.max(0, Number(aggregate.terminalUptimeMs || 0));
    const activePercent = terminalUptimeMs > 0
      ? Math.round((Math.min(activeWorkMs, terminalUptimeMs) / terminalUptimeMs) * 100)
      : 0;

    if (!totalActivity && !commandCount) {
      return [
        '- Main work detected: Not enough command activity yet.',
        '- Summary: Open a terminal and run project/server commands to build a smarter report.',
        '- Confidence: Low.'
      ];
    }

    const focusScores = [
      {
        label: 'Laravel application maintenance',
        score: sumCountersMatching(activityCounters, [/laravel/, /artisan/, /php \/ composer/, /composer/, /cache/, /config/, /queue/, /migration/]),
        detail: 'Laravel/PHP commands suggest framework maintenance, cache/config work, migrations, queues, or dependency checks.'
      },
      {
        label: 'frontend or Node build work',
        score: sumCountersMatching(activityCounters, [/node/, /frontend/, /npm/, /yarn/, /pnpm/, /vite/, /webpack/, /build/, /test/]),
        detail: 'Node/npm activity suggests frontend build, dependency, or verification work.'
      },
      {
        label: 'deployment and version-control work',
        score: sumCountersMatching(activityCounters, [/git/, /version control/, /deployment/, /release/, /public_html/, /archive/, /zip/, /rsync/]),
        detail: 'Git/deployment signals suggest release preparation, upload/sync, or production folder work.'
      },
      {
        label: 'server and hosting maintenance',
        score: sumCountersMatching(activityCounters, [/server service/, /permissions/, /ownership/, /network/, /remote access/, /ssh/, /hosting/, /public_html/]),
        detail: 'Server, SSH, permissions, or hosting commands suggest infrastructure maintenance.'
      },
      {
        label: 'database maintenance',
        score: sumCountersMatching(activityCounters, [/database/, /mysql/, /postgres/, /redis/, /migration/]),
        detail: 'Database-related commands suggest schema, query, cache, or data-store work.'
      },
      {
        label: 'file inspection and file operations',
        score: sumCountersMatching(activityCounters, [/file navigation/, /file inspection/, /file editing/, /file operations/, /log inspection/]),
        detail: 'Navigation, inspection, and file commands suggest project exploration or manual file work.'
      },
      {
        label: 'debugging and issue investigation',
        score: totalIssues + sumCountersMatching(activityCounters, [/debug/, /log/, /test/, /verification/, /check/]),
        detail: 'Warnings/errors, logs, checks, or tests suggest troubleshooting and verification.'
      }
    ].filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

    const topFocus = focusScores[0] || {
      label: 'general terminal work',
      score: totalActivity,
      detail: 'Activity was detected, but there is not enough specific signal to classify it.'
    };
    const supportingFocus = focusScores.slice(1, 3).map((item) => item.label);
    const topActivities = activityEntries.slice(0, 4).map((item) => `${item.label} (${Math.round(item.value)})`);
    const topIssue = issueEntries[0];
    const confidence = totalActivity >= 8 || commandCount >= 6
      ? 'High'
      : totalActivity >= 3 || commandCount >= 2
        ? 'Medium'
        : 'Low';

    const sessionNames = Array.from(new Set((summaries || [])
      .map((summary) => String(summary?.name || '').trim())
      .filter(Boolean)))
      .slice(0, 4);

    const rows = [
      `- Main work detected: ${topFocus.label}.`,
      `- Short summary: ${topFocus.detail}`
    ];

    if (supportingFocus.length) {
      rows.push(`- Secondary activity: ${supportingFocus.join(', ')}.`);
    }

    if (topActivities.length) {
      rows.push(`- Evidence used: ${topActivities.join('; ')}.`);
    }

    if (sessionNames.length) {
      rows.push(`- Sessions considered: ${sessionNames.join(', ')}${sessionNames.length >= 4 ? ', ...' : ''}.`);
    }

    rows.push(`- Working signal: ${commandCount} commands analyzed, ${formatHumanDuration(activeWorkMs)} active work, ${activePercent}% active ratio.`);

    if (topIssue) {
      rows.push(`- Attention needed: ${topIssue.label} appeared ${Math.round(topIssue.value)} time${topIssue.value === 1 ? '' : 's'}.`);
    } else {
      rows.push('- Attention needed: No repeated warning/error category was detected.');
    }

    rows.push(`- Confidence: ${confidence} based on available command/activity signals.`);

    return rows;
  }

  function buildReportSuggestions(issueCounters, activityCounters) {
    const issues = Object.keys(issueCounters || {}).join(' ').toLowerCase();
    const activity = Object.keys(activityCounters || {}).join(' ').toLowerCase();
    const suggestions = [];

    if (/permission denied|access/.test(issues)) {
      suggestions.push('Check folder/file permissions and ownership for the connected user.');
    }

    if (/missing command|path/.test(issues)) {
      suggestions.push('Verify required tools are installed and confirm the terminal is in the correct folder.');
    }

    if (/authentication/.test(issues)) {
      suggestions.push('Check SSH username, port, password/private key, and whether the server allows that login method.');
    }

    if (/connection|network/.test(issues)) {
      suggestions.push('Check network stability, SSH keepalive settings, hosting limits, and auto-reconnect results.');
    }

    if (/laravel|artisan/.test(activity)) {
      suggestions.push('For Laravel work, confirm the active folder is the project root before running artisan tasks.');
    }

    if (/dependency|composer|node/.test(activity)) {
      suggestions.push('For dependency work, keep package lock files consistent and re-run install only when needed.');
    }

    if (!suggestions.length) {
      suggestions.push('No high-risk pattern was detected. Review the activity summary and issue categories for context.');
    }

    return suggestions;
  }

  function getReportScopeLabel(scope = 'all') {
    return {
      all: 'All Terminals',
      active: 'Active Terminal',
      ssh: 'SSH Only',
      local: 'Local Terminal Only'
    }[scope] || 'All Terminals';
  }

  function getReportDateFilterLabel(filter = 'today') {
    if (normalizeReportCustomRangeFilter(filter)) {
      return 'Custom Range';
    }

    return {
      today: 'Today',
      yesterday: 'Yesterday',
      last7: 'Last 7 Days',
      last30: 'Last 30 Days',
      custom: 'Custom Range'
    }[filter] || 'Today';
  }

  function reportDateKeyFromOffset(offset = 0) {
    const date = new Date();

    date.setDate(date.getDate() + Number(offset || 0));

    return reportLocalDateKey(date);
  }

  function parseReportDateKey(value) {
    const key = String(value || '').trim();

    if (!REPORT_DATE_KEY_PATTERN.test(key)) {
      return null;
    }

    const [year, month, day] = key.split('-').map((part) => Number(part));
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function normalizeReportCustomRangeFilter(filter = '') {
    const value = String(filter || '').trim();
    const millisecondMatch = value.match(/^range-ms:(\d{10,16}):(\d{10,16})$/);

    if (millisecondMatch) {
      const firstMs = Number(millisecondMatch[1]);
      const secondMs = Number(millisecondMatch[2]);

      if (!Number.isFinite(firstMs) || !Number.isFinite(secondMs)) {
        return null;
      }

      const startMs = Math.min(firstMs, secondMs);
      const endMs = Math.max(firstMs, secondMs);
      const maxEndMs = startMs + (REPORT_CUSTOM_RANGE_MAX_DAYS * 24 * 60 * 60 * 1000) - 1;
      const safeEndMs = Math.min(endMs, maxEndMs);
      const startDate = new Date(startMs);
      const endDate = new Date(safeEndMs);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return null;
      }

      return {
        start: reportLocalDateKey(startDate),
        end: reportLocalDateKey(endDate),
        startMs,
        endMs: safeEndMs,
        hasTime: true,
        capped: safeEndMs !== endMs
      };
    }

    const dateMatch = value.match(/^range:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);

    if (!dateMatch) {
      return null;
    }

    const firstDate = parseReportDateKey(dateMatch[1]);
    const secondDate = parseReportDateKey(dateMatch[2]);

    if (!firstDate || !secondDate) {
      return null;
    }

    const startDate = firstDate <= secondDate ? firstDate : secondDate;
    const endDate = firstDate <= secondDate ? secondDate : firstDate;
    const startMs = startDate.getTime();
    const rawEndMs = Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
      23,
      59,
      59,
      999
    );
    const maxEndMs = startMs + (REPORT_CUSTOM_RANGE_MAX_DAYS * 24 * 60 * 60 * 1000) - 1;
    const endMs = Math.min(rawEndMs, maxEndMs);

    return {
      start: reportLocalDateKey(startDate),
      end: reportLocalDateKey(new Date(endMs)),
      startMs,
      endMs,
      hasTime: false,
      capped: endMs !== rawEndMs
    };
  }

  function getReportDateRangeBounds(filter = 'today') {
    const customRange = normalizeReportCustomRangeFilter(filter);

    if (customRange) {
      return customRange;
    }

    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (filter === 'yesterday') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else if (filter === 'last7') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (filter === 'last30') {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setHours(0, 0, 0, 0);
    }

    return {
      start: reportLocalDateKey(start),
      end: reportLocalDateKey(end),
      startMs: start.getTime(),
      endMs: end.getTime(),
      hasTime: false,
      capped: false
    };
  }

  function getReportDateKeysForFilter(filter = 'today') {
    const range = getReportDateRangeBounds(filter);
    const keys = [];
    const current = parseReportDateKey(range.start);
    const end = parseReportDateKey(range.end);

    if (!current || !end) {
      return [reportDateKeyFromOffset(0)];
    }

    while (current <= end && keys.length < REPORT_CUSTOM_RANGE_MAX_DAYS) {
      keys.push(reportLocalDateKey(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return keys;
  }

  function formatReportRangeDateTime(timestamp) {
    const date = new Date(Number(timestamp));

    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }

    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getReportDateRangeLabel(filter = 'today') {
    const range = getReportDateRangeBounds(filter);
    const label = getReportDateFilterLabel(filter);

    if (normalizeReportCustomRangeFilter(filter)) {
      const suffix = range.capped ? `, capped at ${REPORT_CUSTOM_RANGE_MAX_DAYS} days` : '';

      return `Custom Range (${formatReportRangeDateTime(range.startMs)} to ${formatReportRangeDateTime(range.endMs)}${suffix})`;
    }

    if (filter === 'last7' || filter === 'last30') {
      return `${label} (${range.start} to ${range.end})`;
    }

    return `${label} (${range.start})`;
  }

  function reportJobOverlapsRange(job, filter = 'today') {
    const range = getReportDateRangeBounds(filter);
    const startedMs = new Date(job?.startedAt || '').getTime();
    const endedMs = new Date(job?.endedAt || '').getTime();
    const safeStartMs = Number.isFinite(startedMs) ? startedMs : 0;
    const safeEndMs = Number.isFinite(endedMs)
      ? endedMs
      : (String(job?.status || '').toLowerCase() === 'running' ? Date.now() : safeStartMs);

    return safeStartMs <= range.endMs && safeEndMs >= range.startMs;
  }

  function jobMatchesReportScope(job, scope, activeTerminalId = '') {
    if (scope === 'active') {
      return Boolean(activeTerminalId) && String(job?.terminalId || '') === String(activeTerminalId);
    }

    if (scope === 'ssh') {
      return job?.type === 'remote';
    }

    if (scope === 'local') {
      return job?.type !== 'remote';
    }

    return true;
  }

  function getReportJobStatusLabel(status = '') {
    return {
      running: 'Running',
      completed: 'Finished',
      completed_with_issues: 'Finished with issues',
      cancelled: 'Cancelled',
      interrupted: 'Interrupted',
      failed: 'Failed',
      unknown: 'Unconfirmed'
    }[String(status || '').toLowerCase()] || 'Unconfirmed';
  }

  function sessionMatchesReportScope(summary, scope) {
    if (scope === 'all') {
      return true;
    }

    if (scope === 'ssh') {
      return summary.type === 'remote';
    }

    if (scope === 'local') {
      return summary.type !== 'remote';
    }

    return true;
  }

  function reportDaysIncludeToday(days = []) {
    const today = todayReportDateKey();

    return days.some((day) => String(day?.date || '') === today);
  }

  function mergeConnectionReportItem(target, item) {
    if (!item) {
      return target;
    }

    target.name = target.name || String(item.name || 'Terminal');
    target.type = item.type === 'remote' ? 'remote' : 'local';
    target.sessionsOpened += Number(item.sessionsOpened || 0);
    target.uptimeMs += Number(item.uptimeMs || 0);
    target.activeWorkMs += Number(item.activeWorkMs || 0);
    target.commandCount += Number(item.commandCount || 0);
    target.inputActivityCount += Number(item.inputActivityCount || 0);
    target.outputBytes += Number(item.outputBytes || 0);
    target.reconnectCount += Number(item.reconnectCount || 0);
    target.disconnectCount += Number(item.disconnectCount || 0);
    mergeCounters(target.activityCounters, item.activityCounters);
    mergeCounters(target.issueCounters, item.issueCounters);

    const itemSeen = item.lastSeenAt ? new Date(item.lastSeenAt).getTime() : 0;
    const targetSeen = target.lastSeenAt ? new Date(target.lastSeenAt).getTime() : 0;

    if (itemSeen > targetSeen) {
      target.lastSeenAt = item.lastSeenAt;
    }

    return target;
  }

  function emptyConnectionReportItem(item = {}) {
    return {
      name: String(item.name || 'Terminal'),
      type: item.type === 'remote' ? 'remote' : 'local',
      sessionsOpened: 0,
      uptimeMs: 0,
      activeWorkMs: 0,
      commandCount: 0,
      inputActivityCount: 0,
      outputBytes: 0,
      reconnectCount: 0,
      disconnectCount: 0,
      activityCounters: {},
      issueCounters: {},
      lastSeenAt: null
    };
  }

  function formatSessionSummaryLine(summary, index) {
    const type = summary.type === 'remote' ? 'SSH' : 'Local';
    const status = summary.status || 'Unknown';
    const host = summary.type === 'remote' && summary.host
      ? ` (${summary.username ? `${summary.username}@` : ''}${summary.host})`
      : '';

    return `${index + 1}. ${summary.name || 'Terminal'}${host} — ${type}, ${status}, ${formatHumanDuration(summary.durationMs)}, active work ${formatHumanDuration(summary.activeWorkMs || 0)}, activity categories: ${Object.keys(summary.activityCounters || {}).length || 0}, issue categories: ${Object.keys(summary.issueCounters || {}).length || 0}`;
  }

  function safeReportFilename(value) {
    const name = String(value || 'advance-terminal-report')
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'advance-terminal-report';

    return `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
  }

  function buildSettingsImportPreviewMessage(preview = {}) {
    const warnings = Array.isArray(preview.warnings) ? preview.warnings : [];
    const parts = [
      `Import from: ${preview.filePath || 'selected backup file'}`,
      '',
      'This will replace matching app configuration with the imported backup:',
      `- Connections: ${preview.connections || 0} (${preview.sshConnections || 0} SSH, ${preview.localConnections || 0} Terminal)`,
      `- Commands: ${preview.commands || 0}`,
      `- Terminal toolbar actions: ${preview.terminalActions || 0}`,
      `- Appearance settings: ${preview.hasAppearance ? 'Yes' : 'No'}`,
      `- Notification position: ${preview.hasNotification ? 'Yes' : 'No'}`
    ];

    if (preview.exportedAt && preview.exportedAt !== 'Unknown') {
      parts.push(`- Backup exported: ${preview.exportedAt}`);
    }

    if (warnings.length) {
      parts.push('', ...warnings.map((warning) => `- ${warning}`));
    }

    parts.push('', 'Continue importing this settings backup?');

    return parts.join('\n');
  }

  function formatRuntimeDuration(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = Math.floor(safeSeconds % 60);

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
  }

  function formatRuntimeMemory(bytes) {
    const value = Number(bytes || 0);

    if (!value) {
      return '—';
    }

    const mb = value / (1024 * 1024);

    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }

    return `${Math.max(1, Math.round(mb))} MB`;
  }

  window.AdvanceTerminalRendererReportHelpers = {
    REPORT_HISTORY_MAX_ITEMS,
    REPORT_CUSTOM_RANGE_MAX_DAYS,
    REPORT_JOB_MAX_PER_DAY,
    DEFAULT_REPORT_OPTIONS,
    normalizeReportOptionsClient,
    reportLocalDateKey,
    sanitizeReportJobCommand,
    inferReportJobType,
    normalizeReportJob,
    createEmptyReportDay,
    normalizeReportUsageClient,
    normalizeReportHistoryClient,
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
  };
}());
