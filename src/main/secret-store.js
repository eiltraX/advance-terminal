const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const STORE_VERSION = 1;
const VALID_KINDS = new Set(['password', 'passphrase']);
const VALID_APP_SECRET_KINDS = new Set(['openaiApiKey']);

function getSecretStoreFilePath() {
  return path.join(app.getPath('userData'), 'secrets.json');
}

function canUseSafeStorage() {
  try {
    return Boolean(safeStorage && safeStorage.isEncryptionAvailable());
  } catch (_) {
    return false;
  }
}

function getSecretStorageStatus() {
  return {
    available: canUseSafeStorage(),
    backend: 'electron.safeStorage',
    filePath: getSecretStoreFilePath()
  };
}

function ensureSecretStoreDirectory() {
  const dirPath = path.dirname(getSecretStoreFilePath());

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function createEmptyStore() {
  return {
    version: STORE_VERSION,
    secrets: {}
  };
}

function readSecretStore() {
  const filePath = getSecretStoreFilePath();

  if (!fs.existsSync(filePath)) {
    return createEmptyStore();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!parsed || typeof parsed !== 'object' || !parsed.secrets || typeof parsed.secrets !== 'object') {
      return createEmptyStore();
    }

    return {
      version: STORE_VERSION,
      secrets: parsed.secrets
    };
  } catch (_) {
    return createEmptyStore();
  }
}

function writeSecretStore(store) {
  ensureSecretStoreDirectory();

  const safeStore = {
    version: STORE_VERSION,
    secrets: store && store.secrets && typeof store.secrets === 'object'
      ? store.secrets
      : {}
  };

  fs.writeFileSync(getSecretStoreFilePath(), JSON.stringify(safeStore, null, 2), 'utf8');
}

function makeSecretKey(serverId, kind) {
  const id = String(serverId || '').trim();

  if (!id || !VALID_KINDS.has(kind)) {
    return '';
  }

  return `${id}:${kind}`;
}

function makeAppSecretKey(kind) {
  const safeKind = String(kind || '').trim();

  if (!VALID_APP_SECRET_KINDS.has(safeKind)) {
    return '';
  }

  return `app:${safeKind}`;
}

function encryptSecret(value) {
  if (!canUseSafeStorage()) {
    return null;
  }

  const encrypted = safeStorage.encryptString(String(value || ''));

  return {
    encoding: 'electron.safeStorage',
    value: encrypted.toString('base64'),
    updatedAt: new Date().toISOString()
  };
}

function decryptSecret(entry) {
  if (!entry || entry.encoding !== 'electron.safeStorage' || !entry.value || !canUseSafeStorage()) {
    return '';
  }

  try {
    return safeStorage.decryptString(Buffer.from(String(entry.value), 'base64'));
  } catch (_) {
    return '';
  }
}

function saveAppSecret(kind, value) {
  const key = makeAppSecretKey(kind);
  const secretValue = String(value || '');

  if (!key) {
    return { ok: false, error: 'Invalid app secret key.' };
  }

  if (!secretValue) {
    deleteAppSecret(kind);
    return { ok: true, deleted: true };
  }

  const encrypted = encryptSecret(secretValue);

  if (!encrypted) {
    return {
      ok: false,
      error: 'Secure credential storage is unavailable on this system.'
    };
  }

  const store = readSecretStore();
  store.secrets[key] = encrypted;
  writeSecretStore(store);

  return { ok: true };
}

function getAppSecret(kind) {
  const key = makeAppSecretKey(kind);

  if (!key) {
    return '';
  }

  const store = readSecretStore();
  return decryptSecret(store.secrets[key]);
}

function hasAppSecret(kind) {
  const key = makeAppSecretKey(kind);

  if (!key) {
    return false;
  }

  const store = readSecretStore();
  return Boolean(store.secrets[key] && getAppSecret(kind));
}

function deleteAppSecret(kind) {
  const key = makeAppSecretKey(kind);

  if (!key) {
    return false;
  }

  const store = readSecretStore();

  if (!Object.prototype.hasOwnProperty.call(store.secrets, key)) {
    return false;
  }

  delete store.secrets[key];
  writeSecretStore(store);

  return true;
}

function saveServerSecret(serverId, kind, value) {
  const key = makeSecretKey(serverId, kind);
  const secretValue = String(value || '');

  if (!key) {
    return { ok: false, error: 'Invalid secret key.' };
  }

  if (!secretValue) {
    deleteServerSecret(serverId, kind);
    return { ok: true, deleted: true };
  }

  const encrypted = encryptSecret(secretValue);

  if (!encrypted) {
    return {
      ok: false,
      error: 'Secure credential storage is unavailable on this system.'
    };
  }

  const store = readSecretStore();
  store.secrets[key] = encrypted;
  writeSecretStore(store);

  return { ok: true };
}

function getServerSecret(serverId, kind) {
  const key = makeSecretKey(serverId, kind);

  if (!key) {
    return '';
  }

  const store = readSecretStore();
  return decryptSecret(store.secrets[key]);
}

function hasServerSecret(serverId, kind) {
  const key = makeSecretKey(serverId, kind);

  if (!key) {
    return false;
  }

  const store = readSecretStore();
  return Boolean(store.secrets[key] && getServerSecret(serverId, kind));
}

function deleteServerSecret(serverId, kind) {
  const key = makeSecretKey(serverId, kind);

  if (!key) {
    return false;
  }

  const store = readSecretStore();

  if (!Object.prototype.hasOwnProperty.call(store.secrets, key)) {
    return false;
  }

  delete store.secrets[key];
  writeSecretStore(store);

  return true;
}

function pruneSecretsForServerIds(serverIds = []) {
  const allowedIds = new Set((Array.isArray(serverIds) ? serverIds : []).map((id) => String(id || '').trim()).filter(Boolean));
  const store = readSecretStore();
  let changed = false;

  Object.keys(store.secrets).forEach((key) => {
    if (String(key || '').startsWith('app:')) {
      return;
    }

    const serverId = key.split(':')[0];

    if (!allowedIds.has(serverId)) {
      delete store.secrets[key];
      changed = true;
    }
  });

  if (changed) {
    writeSecretStore(store);
  }

  return changed;
}

module.exports = {
  getSecretStoreFilePath,
  getSecretStorageStatus,
  canUseSafeStorage,
  saveAppSecret,
  getAppSecret,
  hasAppSecret,
  deleteAppSecret,
  saveServerSecret,
  getServerSecret,
  hasServerSecret,
  deleteServerSecret,
  pruneSecretsForServerIds
};
