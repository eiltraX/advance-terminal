const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

function sanitizeKeyName(name) {
  const safe = String(name || 'advance-terminal')
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return safe || 'advance-terminal';
}

function readDerLength(buffer, offset) {
  const first = buffer[offset];

  if (first < 0x80) {
    return { length: first, offset: offset + 1 };
  }

  const bytes = first & 0x7f;
  if (bytes <= 0 || bytes > 4) {
    throw new Error('Unsupported DER length.');
  }

  let length = 0;
  for (let i = 0; i < bytes; i += 1) {
    length = (length << 8) + buffer[offset + 1 + i];
  }

  return { length, offset: offset + 1 + bytes };
}

function readDerElement(buffer, offset, expectedTag) {
  if (buffer[offset] !== expectedTag) {
    throw new Error('Unexpected DER element.');
  }

  const lengthInfo = readDerLength(buffer, offset + 1);
  const start = lengthInfo.offset;
  const end = start + lengthInfo.length;

  if (end > buffer.length) {
    throw new Error('Invalid DER element length.');
  }

  return {
    value: buffer.subarray(start, end),
    nextOffset: end
  };
}

function trimIntegerPrefix(value) {
  let output = Buffer.from(value);

  while (output.length > 1 && output[0] === 0x00) {
    output = output.subarray(1);
  }

  return output;
}

function parseRsaPublicKey(publicKeyPem) {
  const der = crypto.createPublicKey(publicKeyPem).export({
    type: 'pkcs1',
    format: 'der'
  });

  const sequence = readDerElement(der, 0, 0x30).value;
  const modulusElement = readDerElement(sequence, 0, 0x02);
  const exponentElement = readDerElement(sequence, modulusElement.nextOffset, 0x02);

  return {
    modulus: trimIntegerPrefix(modulusElement.value),
    exponent: trimIntegerPrefix(exponentElement.value)
  };
}

function sshString(value) {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, data]);
}

function sshMpint(value) {
  let data = trimIntegerPrefix(value);

  if (data.length && (data[0] & 0x80)) {
    data = Buffer.concat([Buffer.from([0x00]), data]);
  }

  return sshString(data);
}

function buildOpenSshRsaPublicKey(publicKeyPem, comment) {
  const rsa = parseRsaPublicKey(publicKeyPem);
  const blob = Buffer.concat([
    sshString('ssh-rsa'),
    sshMpint(rsa.exponent),
    sshMpint(rsa.modulus)
  ]);

  const publicKey = `ssh-rsa ${blob.toString('base64')} ${comment}`;
  const fingerprint = `SHA256:${crypto
    .createHash('sha256')
    .update(blob)
    .digest('base64')
    .replace(/=+$/g, '')}`;

  return { publicKey, fingerprint };
}

async function generateSshKey(payload) {
  const keyName = sanitizeKeyName(payload.keyName);
  const passphrase = String(payload.passphrase || '');
  const keyDir = path.join(app.getPath('userData'), 'ssh-keys');

  if (!fs.existsSync(keyDir)) {
    fs.mkdirSync(keyDir, { recursive: true, mode: 0o700 });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const privateKeyPath = path.join(keyDir, `${keyName}_${stamp}_rsa.pem`);
  const publicKeyPath = `${privateKeyPath}.pub`;
  const comment = `${keyName}@advance-terminal-v3`;

  const privateKeyEncoding = passphrase
    ? {
      type: 'pkcs1',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase
    }
    : {
      type: 'pkcs1',
      format: 'pem'
    };

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'pkcs1',
      format: 'pem'
    },
    privateKeyEncoding
  });

  const publicKeyResult = buildOpenSshRsaPublicKey(publicKey, comment);

  fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
  fs.writeFileSync(publicKeyPath, `${publicKeyResult.publicKey}\n`, { mode: 0o644 });

  try {
    if (process.platform !== 'win32') {
      fs.chmodSync(privateKeyPath, 0o600);
      fs.chmodSync(publicKeyPath, 0o644);
    }
  } catch (_) {
    // Permissions can fail on some filesystems. The key is still generated.
  }

  return {
    privateKeyPath,
    publicKeyPath,
    publicKey: publicKeyResult.publicKey,
    fingerprint: `${publicKeyResult.fingerprint} ${comment} (RSA 4096)`,
    createdAt: new Date().toISOString(),
    engine: 'Integrated Node Crypto'
  };
}

module.exports = {
  generateSshKey
};
