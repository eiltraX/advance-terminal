/* global window, document */
'use strict';

(function initAdvanceTerminalRendererConnectionHelpers() {
function serverSubtitle(server) {
  if (server.type === 'local') {
    return `${server.description || 'Local Terminal'} · Local`;
  }

  return `${server.description || 'Remote SSH'} · ${server.username || 'user'}@${server.host || 'host'}:${server.port || 22}`;
}

function normalizeConnectionFilter(value) {
  return ['all', 'remote', 'local'].includes(value) ? value : 'all';
}

function normalizeConnectionGroupName(value, type = 'remote') {
  const fallback = type === 'local' ? 'Local' : 'Ungrouped';
  const group = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);

  return group || fallback;
}

function getServerGroup(server = {}) {
  return normalizeConnectionGroupName(server.group, server.type === 'local' ? 'local' : 'remote');
}

function getConnectionHealthBadgeClass(status) {
  if (status === 'ready') {
    return 'ready';
  }

  if (status === 'warning') {
    return 'warning';
  }

  if (status === 'checking') {
    return 'checking';
  }

  return 'error';
}

function getConnectionHealthLabel(health) {
  if (!health) {
    return 'Not tested';
  }

  if (health.status === 'ready') {
    return 'Ready';
  }

  if (health.status === 'warning') {
    return 'Check';
  }

  if (health.status === 'checking') {
    return 'Testing';
  }

  return 'Issue';
}

function sanitizeHealthForSettings(result) {
  const health = result && typeof result === 'object' ? result : {};

  return {
    status: health.status || 'error',
    summary: health.summary || 'Health check failed.',
    checkedAt: health.checkedAt || new Date().toISOString(),
    badges: Array.isArray(health.badges) ? health.badges.slice(0, 4) : [],
    projectTypes: Array.isArray(health.projectTypes) ? health.projectTypes.slice(0, 6) : [],
    versions: health.versions && typeof health.versions === 'object' ? health.versions : {},
    checks: Array.isArray(health.checks)
      ? health.checks.slice(0, 10).map((check) => ({
        label: check.label || 'Check',
        status: check.status || 'warning',
        message: check.message || ''
      }))
      : []
  };
}

function getConnectionVisibleHealthBadge(server = {}) {
  const health = server.health;

  if (!health) {
    return server.type === 'local'
      ? { label: 'Not tested', status: 'untested' }
      : { label: 'Not tested', status: 'untested' };
  }

  const status = health.status || 'untested';
  const badges = Array.isArray(health.badges) ? health.badges : [];
  const readyBadge = badges.find((badge) => /ready|tested/i.test(String(badge || '')));

  if (status === 'ready') {
    return {
      label: readyBadge || (server.type === 'local' ? 'Local Ready' : 'SSH Ready'),
      status
    };
  }

  return {
    label: getConnectionHealthLabel(health),
    status
  };
}

function getConnectionHoverBadges(server = {}) {
  const health = server.health;
  const badges = Array.isArray(health?.badges) ? health.badges : [];

  return badges
    .map((badge) => String(badge || '').trim())
    .filter(Boolean)
    .filter((badge) => !/^(ssh ready|local ready|ready|tested|testing|issue|check|not tested)$/i.test(badge))
    .slice(0, 6);
}

function setConnectionHealthTitle(server, container) {
  if (!container) {
    return;
  }

  const health = server.health;

  if (health?.checkedAt) {
    container.title = `${health.summary || 'Last health check'}\nChecked: ${new Date(health.checkedAt).toLocaleString()}`;
  } else {
    container.title = 'Right-click this connection and choose Test Connection.';
  }
}

function renderConnectionHealthBadges(server, container) {
  if (!container) {
    return;
  }

  const badge = getConnectionVisibleHealthBadge(server);
  container.innerHTML = '';

  const item = document.createElement('span');
  item.className = `server-health-badge ${getConnectionHealthBadgeClass(badge.status)}`;
  item.textContent = badge.label;
  container.appendChild(item);

  setConnectionHealthTitle(server, container);
}

function renderConnectionHoverBadges(server, container) {
  if (!container) {
    return;
  }

  const badges = getConnectionHoverBadges(server);
  container.innerHTML = '';

  if (!badges.length) {
    container.classList.add('empty');
    return;
  }

  container.classList.remove('empty');

  badges.forEach((badge) => {
    const item = document.createElement('span');
    item.className = `server-hover-badge ${getConnectionHealthBadgeClass(server.health?.status || 'untested')}`;
    item.textContent = badge;
    container.appendChild(item);
  });

  setConnectionHealthTitle(server, container);
}

  window.AdvanceTerminalRendererConnectionHelpers = Object.freeze({
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
  });
}());
