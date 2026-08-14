const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('ssh2');

let nodePty = null;

try {
  nodePty = require('node-pty');
} catch (_) {
  nodePty = null;
}

function getLocalRootDirectory() {
  if (process.platform === 'win32') {
    return path.parse(os.homedir()).root || 'C:\\';
  }

  return '/';
}

function quoteForPosixShell(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function normalizeTerminalSize(cols, rows) {
  // Split panes and narrow Windows snap layouts can legitimately fit well below 20 columns.
  // Keep a small safety floor so xterm and the PTY agree on wrapping without rejecting compact panes.
  const safeCols = Math.max(10, Math.min(500, Number(cols || 120)));
  const safeRows = Math.max(4, Math.min(200, Number(rows || 32)));

  return {
    cols: Number.isFinite(safeCols) ? Math.floor(safeCols) : 120,
    rows: Number.isFinite(safeRows) ? Math.floor(safeRows) : 32
  };
}

function applyRemoteWindowSize(stream, size) {
  if (!stream || typeof stream.setWindow !== 'function') {
    return;
  }

  try {
    stream.setWindow(size.rows, size.cols, 0, 0);
  } catch (_) {
    // Ignore resize failures from closed SSH streams.
  }
}

function valueOrEmpty(value) {
  return typeof value === 'string' ? value : String(value || '');
}

function safeSend(sender, channel, payload) {
  if (!sender || typeof sender.send !== 'function') {
    return false;
  }

  if (typeof sender.isDestroyed === 'function' && sender.isDestroyed()) {
    return false;
  }

  try {
    sender.send(channel, payload);
    return true;
  } catch (_) {
    return false;
  }
}

function createTerminalError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getRemoteAuthType(server) {
  if (server?.authTypeConfigured === false) {
    return '';
  }

  const requested = valueOrEmpty(server?.authType).trim().toLowerCase();

  if (requested === 'key' || requested === 'private-key' || requested === 'private_key') {
    return 'key';
  }

  if (requested === 'password') {
    return 'password';
  }

  return '';
}

function classifySshConnectionError(error, authType) {
  const rawMessage = valueOrEmpty(error?.message || error).trim();
  const lowerMessage = rawMessage.toLowerCase();

  if (
    lowerMessage.includes('all configured authentication methods failed')
    || lowerMessage.includes('authentication failed')
    || lowerMessage.includes('permission denied')
    || lowerMessage.includes('no more authentication methods available')
  ) {
    return {
      code: 'SSH_AUTH_FAILED',
      authFailure: true,
      message: authType === 'key'
        ? 'Authentication failed. Check the SSH username, private key, server public key, and key passphrase.'
        : 'Authentication failed. Check the SSH username and password.'
    };
  }

  if (
    lowerMessage.includes('passphrase')
    || lowerMessage.includes('encrypted private key')
    || lowerMessage.includes('cannot parse privatekey')
    || lowerMessage.includes('cannot parse private key')
  ) {
    return {
      code: 'SSH_KEY_PASSPHRASE_OR_FORMAT',
      authFailure: true,
      message: 'The private key is encrypted or invalid. Check the selected key and its passphrase.'
    };
  }

  if (lowerMessage.includes('timed out while waiting for handshake') || lowerMessage.includes('handshake timeout')) {
    return {
      code: 'SSH_HANDSHAKE_TIMEOUT',
      authFailure: false,
      message: 'SSH connection timed out. Check the host, port, firewall, and hosting connection limits.'
    };
  }

  if (lowerMessage.includes('econnrefused') || lowerMessage.includes('connection refused')) {
    return {
      code: 'SSH_CONNECTION_REFUSED',
      authFailure: false,
      message: 'SSH connection was refused. Check the host, port, and whether SSH access is enabled.'
    };
  }

  if (lowerMessage.includes('enotfound') || lowerMessage.includes('getaddrinfo')) {
    return {
      code: 'SSH_HOST_NOT_FOUND',
      authFailure: false,
      message: 'SSH host could not be found. Check the saved Host/IP value.'
    };
  }

  return {
    code: 'SSH_CONNECTION_FAILED',
    authFailure: false,
    message: rawMessage ? `SSH connection failed: ${rawMessage}` : 'SSH connection failed.'
  };
}

function getPassword(server, secrets) {
  if (secrets && Object.prototype.hasOwnProperty.call(secrets, 'password')) {
    return valueOrEmpty(secrets.password);
  }

  return valueOrEmpty(server.password);
}

function keepAliveEnabled(server) {
  return server?.keepAlive !== false;
}

function getCaseInsensitiveEnvValue(env, key) {
  const foundKey = Object.keys(env || {}).find((name) => name.toLowerCase() === key.toLowerCase());
  return foundKey ? env[foundKey] : '';
}

function setCaseInsensitiveEnvValue(env, key, value) {
  const foundKey = Object.keys(env || {}).find((name) => name.toLowerCase() === key.toLowerCase());
  env[foundKey || key] = value;
}

function appendWindowsEnvListValue(currentValue, requiredValue) {
  const parts = String(currentValue || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.some((part) => part.toLowerCase() === requiredValue.toLowerCase())) {
    parts.push(requiredValue);
  }

  return parts.join(';');
}

function getLocalTerminalEnv() {
  const env = { ...process.env };

  if (process.platform !== 'win32') {
    return env;
  }

  let pathext = getCaseInsensitiveEnvValue(env, 'PATHEXT');
  for (const extension of ['.COM', '.EXE', '.BAT', '.CMD']) {
    pathext = appendWindowsEnvListValue(pathext, extension);
  }
  setCaseInsensitiveEnvValue(env, 'PATHEXT', pathext);

  return env;
}

function isPowerShellShell(shell) {
  if (process.platform !== 'win32') {
    return false;
  }

  const shellName = path.basename(String(shell || '')).toLowerCase();
  return shellName === 'powershell.exe'
    || shellName === 'powershell'
    || shellName === 'pwsh.exe'
    || shellName === 'pwsh';
}

function getPowerShellStartupArgs(shell) {
  if (!isPowerShellShell(shell)) {
    return [];
  }

  return [
    '-NoExit',
    '-Command',
    [
      "if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { function global:npm { & npm.cmd @args } }",
      "if (Get-Command npx.cmd -ErrorAction SilentlyContinue) { function global:npx { & npx.cmd @args } }"
    ].join('; ')
  ];
}


function getTerminalProfileArgs(profile, shell) {
  if (!profile || !Array.isArray(profile.args)) {
    return getPowerShellStartupArgs(shell);
  }

  const args = profile.args
    .map((value) => String(value ?? ''))
    .slice(0, 40);

  return args.length ? args : getPowerShellStartupArgs(shell);
}

function getTerminalProfileEnv(profile) {
  const env = getLocalTerminalEnv();
  const custom = profile?.environment;

  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) {
    return env;
  }

  Object.entries(custom).slice(0, 80).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey || '').trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)) {
      return;
    }

    env[key] = String(rawValue ?? '');
  });

  return env;
}

class TerminalManager {
  constructor() {
    this.sessions = new Map();
  }

  getActiveSessionInfo(exceptTerminalId = null) {
    for (const [terminalId, session] of this.sessions.entries()) {
      if (terminalId === exceptTerminalId) {
        continue;
      }

      return {
        terminalId,
        type: session.type || 'terminal',
        serverId: session.serverId || null,
        serverName: session.serverName || 'Active terminal'
      };
    }

    return null;
  }

  getConnectingSessionInfo(exceptTerminalId = null) {
    for (const [terminalId, session] of this.sessions.entries()) {
      if (terminalId === exceptTerminalId || session?.status !== 'connecting') {
        continue;
      }

      return {
        terminalId,
        type: session.type || 'terminal',
        serverId: session.serverId || null,
        serverName: session.serverName || 'Connecting terminal'
      };
    }

    return null;
  }

  async create({ terminalId, server, secrets, sender, defaultCols, defaultRows }) {
    const id = terminalId || crypto.randomUUID();
    const connectingSession = this.getConnectingSessionInfo(id);

    if (connectingSession) {
      const error = new Error(`Another server connection is still in progress: ${connectingSession.serverName}. Wait for it to finish connecting.`);
      error.code = 'CONNECTION_BUSY';
      error.activeTerminalId = connectingSession.terminalId;
      throw error;
    }

    if (this.sessions.has(id)) {
      this.close(id);
    }

    if (server.type === 'local') {
      this.createLocalSession({ id, server, sender, defaultCols, defaultRows });
      return id;
    }

    this.createRemoteSshSession({ id, server, secrets, sender, defaultCols, defaultRows });
    return id;
  }

  createLocalSession({ id, server, sender, defaultCols, defaultRows }) {
    if (!nodePty) {
      safeSend(sender, 'terminal:data', {
        terminalId: id,
        data: '\r\nLocal terminal engine is not available. Rebuild the installer, then reinstall Advance Terminal.\r\n'
      });
      safeSend(sender, 'terminal:exit', { terminalId: id, code: 1 });
      return;
    }

    const profile = server.terminalProfile && typeof server.terminalProfile === 'object'
      ? server.terminalProfile
      : null;
    const shell = String(profile?.executable || server.shell || '').trim()
      || (process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash'));

    const hasStartFolder = Boolean(String(server.workingDirectory || profile?.workingDirectory || '').trim());
    const requestedCwd = hasStartFolder
      ? String(server.workingDirectory || profile?.workingDirectory || '').trim()
      : getLocalRootDirectory();
    const isWslProfile = profile?.kind === 'wsl';
    const cwd = isWslProfile
      ? getLocalRootDirectory()
      : (requestedCwd && fs.existsSync(requestedCwd) ? requestedCwd : getLocalRootDirectory());

    if (!hasStartFolder) {
      safeSend(sender, 'terminal:data', {
        terminalId: id,
        data: `Start Folder is empty. Opening root folder: ${cwd}\r\n`
      });
    } else if (!isWslProfile && cwd !== requestedCwd) {
      safeSend(sender, 'terminal:data', {
        terminalId: id,
        data: `Start Folder not found: ${requestedCwd}\r\nOpening root folder: ${cwd}\r\n`
      });
    }

    const initialSize = normalizeTerminalSize(defaultCols, defaultRows);
    let spawnArgs = getTerminalProfileArgs(profile, shell);

    if (isWslProfile && hasStartFolder && !spawnArgs.includes('--cd')) {
      spawnArgs = ['--cd', requestedCwd, ...spawnArgs];
    }

    const pty = nodePty.spawn(shell, spawnArgs, {
      name: 'xterm-256color',
      cols: initialSize.cols,
      rows: initialSize.rows,
      cwd,
      env: getTerminalProfileEnv(profile)
    });

    this.sessions.set(id, {
      type: 'local',
      status: 'connected',
      serverId: server.id || null,
      serverName: server.name || profile?.name || 'Local Terminal',
      profileId: profile?.id || server.profileId || null,
      pty,
      sender,
      cols: initialSize.cols,
      rows: initialSize.rows
    });

    pty.onData((data) => {
      safeSend(sender, 'terminal:data', { terminalId: id, data });
    });

    pty.onExit((event) => {
      safeSend(sender, 'terminal:exit', { terminalId: id, code: event.exitCode });
      this.sessions.delete(id);
    });
  }

  createRemoteSshSession({ id, server, secrets, sender, defaultCols, defaultRows }) {
    const authType = getRemoteAuthType(server);
    const password = getPassword(server, secrets);
    const host = valueOrEmpty(server?.host).trim();
    const username = valueOrEmpty(server?.username).trim();
    const port = Number(server?.port || 22);

    if (!host) {
      throw createTerminalError(
        'SSH_HOST_MISSING',
        'SSH Host/IP is not configured. Open Add / Manage and enter the server host.'
      );
    }

    if (!username) {
      throw createTerminalError(
        'SSH_USERNAME_MISSING',
        'SSH Username is not configured. Open Add / Manage and enter the SSH username.'
      );
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw createTerminalError(
        'SSH_PORT_INVALID',
        'SSH Port must be a number between 1 and 65535.'
      );
    }

    if (!authType) {
      throw createTerminalError(
        'SSH_AUTH_TYPE_MISSING',
        'Authentication type is not configured. Open Add / Manage and select Password or Private Key.'
      );
    }

    let privateKey = null;

    if (authType === 'password' && !password) {
      throw createTerminalError(
        'SSH_PASSWORD_MISSING',
        'SSH password is not configured. Enter a password when prompted or save it in Add / Manage.'
      );
    }

    if (authType === 'key') {
      const privateKeyPath = valueOrEmpty(server?.privateKeyPath).trim();

      if (!privateKeyPath) {
        throw createTerminalError(
          'SSH_PRIVATE_KEY_PATH_MISSING',
          'Private key path is not configured. Open Add / Manage and select a private key.'
        );
      }

      try {
        const stat = fs.statSync(privateKeyPath);

        if (!stat.isFile()) {
          throw createTerminalError(
            'SSH_PRIVATE_KEY_NOT_FILE',
            'The configured private key path is not a file. Select a valid private key in Add / Manage.'
          );
        }

        privateKey = fs.readFileSync(privateKeyPath);
      } catch (error) {
        if (error?.code && String(error.code).startsWith('SSH_PRIVATE_KEY_')) {
          throw error;
        }

        if (error?.code === 'ENOENT') {
          throw createTerminalError(
            'SSH_PRIVATE_KEY_NOT_FOUND',
            'Private key file was not found. Open Add / Manage and select an existing key.'
          );
        }

        throw createTerminalError(
          'SSH_PRIVATE_KEY_UNREADABLE',
          'Private key file cannot be read. Check the selected path and Windows file permissions.'
        );
      }
    }

    const conn = new Client();
    const initialSize = normalizeTerminalSize(defaultCols, defaultRows);

    this.sessions.set(id, {
      type: 'remote',
      status: 'connecting',
      serverId: server.id || null,
      serverName: server.name || host || 'SSH Server',
      conn,
      stream: null,
      sender,
      cols: initialSize.cols,
      rows: initialSize.rows,
      exitSent: false
    });

    const sendTerminalExit = (code, details = {}) => {
      const session = this.sessions.get(id);

      if (!session || session.exitSent) {
        return false;
      }

      session.exitSent = true;

      return safeSend(sender, 'terminal:exit', {
        terminalId: id,
        code,
        errorCode: details.errorCode || null,
        errorMessage: details.errorMessage || '',
        authFailure: Boolean(details.authFailure)
      });
    };

    const failConnection = (failure, detail = '') => {
      const current = this.sessions.get(id);

      if (!current || current.exitSent) {
        return false;
      }

      const safeFailure = failure || {
        code: 'SSH_CONNECTION_FAILED',
        authFailure: false,
        message: 'SSH connection failed.'
      };

      safeSend(sender, 'terminal:data', {
        terminalId: id,
        data: `${safeFailure.message}\r\n${detail ? `${detail}\r\n` : ''}`
      });

      sendTerminalExit(1, {
        errorCode: safeFailure.code,
        errorMessage: safeFailure.message,
        authFailure: safeFailure.authFailure
      });

      this.sessions.delete(id);
      return true;
    };

    safeSend(sender, 'terminal:data', {
      terminalId: id,
      data: `Connecting to ${username}@${host}:${port} using integrated SSH engine...\r\n`
    });

    conn.on('ready', () => {
      safeSend(sender, 'terminal:data', {
        terminalId: id,
        data: 'SSH connected.\r\n'
      });

      const shellSize = normalizeTerminalSize(initialSize.cols, initialSize.rows);

      conn.shell({
        term: 'xterm-256color',
        cols: shellSize.cols,
        rows: shellSize.rows
      }, (error, stream) => {
        if (error) {
          failConnection({
            code: 'SSH_SHELL_FAILED',
            authFailure: false,
            message: 'SSH authenticated, but the server refused the interactive terminal shell.'
          }, `SSH shell detail: ${valueOrEmpty(error.message || error)}`);

          try {
            conn.end();
          } catch (_) {
            // Ignore close failures after a rejected shell.
          }
          return;
        }

        const session = this.sessions.get(id);
        if (!session || session.exitSent) {
          try {
            stream.end();
          } catch (_) {
            // Ignore cleanup failure after a cancelled connection.
          }
          return;
        }

        session.status = 'connected';
        session.stream = stream;
        applyRemoteWindowSize(stream, normalizeTerminalSize(session.cols, session.rows));

        const remoteStartFolder = valueOrEmpty(server.workingDirectory).trim();

        if (remoteStartFolder) {
          stream.write(`cd ${quoteForPosixShell(remoteStartFolder)}\n`);
        } else {
          safeSend(sender, 'terminal:data', {
            terminalId: id,
            data: 'Start Folder is empty. Opening root folder: /\r\n'
          });
          stream.write('cd /\n');
        }

        stream.on('data', (data) => {
          safeSend(sender, 'terminal:data', {
            terminalId: id,
            data: data.toString('utf8')
          });
        });

        stream.stderr.on('data', (data) => {
          safeSend(sender, 'terminal:data', {
            terminalId: id,
            data: data.toString('utf8')
          });
        });

        stream.on('close', () => {
          const current = this.sessions.get(id);

          if (!current || current.exitSent) {
            this.sessions.delete(id);
            return;
          }

          safeSend(sender, 'terminal:data', {
            terminalId: id,
            data: '\r\nSSH session closed.\r\n'
          });
          sendTerminalExit(0);

          try {
            conn.end();
          } catch (_) {
            // Ignore close failures from an already closed SSH connection.
          }

          this.sessions.delete(id);
        });
      });
    });

    if (authType === 'password') {
      conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
        finish(prompts.map(() => password));
      });
    }

    conn.on('error', (error) => {
      const failure = classifySshConnectionError(error, authType);
      const rawMessage = valueOrEmpty(error?.message || error).trim();
      failConnection(failure, rawMessage && rawMessage !== failure.message ? `SSH detail: ${rawMessage}` : '');
    });

    conn.on('end', () => {
      const session = this.sessions.get(id);
      if (session && !session.exitSent) {
        safeSend(sender, 'terminal:data', {
          terminalId: id,
          data: '\r\nSSH connection ended.\r\n'
        });
      }
    });

    conn.on('close', () => {
      const session = this.sessions.get(id);

      if (!session || session.exitSent) {
        return;
      }

      const wasConnected = session.status === 'connected';
      const failure = {
        code: wasConnected ? 'SSH_CONNECTION_CLOSED' : 'SSH_CONNECTION_ENDED_EARLY',
        authFailure: false,
        message: wasConnected
          ? 'SSH connection closed.'
          : 'SSH connection ended before the terminal prompt opened.'
      };

      failConnection(failure);
    });

    const config = {
      host,
      port,
      username,
      readyTimeout: 20000
    };

    if (keepAliveEnabled(server)) {
      config.keepaliveInterval = 15000;
      config.keepaliveCountMax = 4;
    }

    if (authType === 'password') {
      config.password = password;
      config.tryKeyboard = true;
    } else {
      config.privateKey = privateKey;
      const passphrase = valueOrEmpty(secrets?.passphrase || server.passphrase);

      if (passphrase) {
        config.passphrase = passphrase;
      }
    }

    try {
      conn.connect(config);
    } catch (error) {
      const failure = classifySshConnectionError(error, authType);
      const rawMessage = valueOrEmpty(error?.message || error).trim();
      failConnection(failure, rawMessage && rawMessage !== failure.message ? `SSH detail: ${rawMessage}` : '');
    }
  }

  write(terminalId, data) {
    const session = this.sessions.get(terminalId);

    if (!session) {
      return;
    }

    if (session.type === 'local' && session.pty) {
      session.pty.write(data);
      return;
    }

    if (session.type === 'remote' && session.stream) {
      session.stream.write(data);
    }
  }

  resize(terminalId, cols, rows) {
    const session = this.sessions.get(terminalId);

    if (!session) {
      return;
    }

    const size = normalizeTerminalSize(cols, rows);
    session.cols = size.cols;
    session.rows = size.rows;

    if (session.type === 'local' && session.pty) {
      try {
        session.pty.resize(size.cols, size.rows);
      } catch (_) {
        // Ignore resize failures from closed local terminals.
      }
      return;
    }

    if (session.type === 'remote') {
      applyRemoteWindowSize(session.stream, size);
    }
  }

  close(terminalId) {
    const session = this.sessions.get(terminalId);

    if (!session) {
      return;
    }

    if (session.type === 'local' && session.pty) {
      try {
        session.pty.kill();
      } catch (_) {
        // Ignore close failure.
      }
    }

    if (session.type === 'remote') {
      try {
        if (session.stream) {
          session.stream.end();
        }
        if (session.conn) {
          session.conn.end();
        }
      } catch (_) {
        // Ignore close failure.
      }
    }

    this.sessions.delete(terminalId);
  }

  closeAll() {
    for (const terminalId of Array.from(this.sessions.keys())) {
      this.close(terminalId);
    }
  }
}

module.exports = {
  TerminalManager
};
