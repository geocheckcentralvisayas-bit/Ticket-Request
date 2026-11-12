import 'dotenv/config';
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Encrypted secret store.
 *
 * Secrets (JWT signing keys, SMTP credentials, notification addresses) are not
 * kept in .env or anywhere inside the repository. They live in an AES-256-GCM
 * encrypted file in the current user's profile directory, unlocked by a local
 * key file that is readable only by that operating-system account.
 *
 * Real environment variables always take precedence, so deployments can inject
 * secrets through the platform/secret manager instead of using the local store.
 */

export const SECRET_KEYS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'NOTIFICATION_EMAILS',
] as const;

export type SecretKey = (typeof SECRET_KEYS)[number];

const STORE_DIR =
  process.env.ENVIS_SECRETS_DIR ||
  path.join(process.env.APPDATA || process.env.XDG_CONFIG_HOME || os.homedir(), 'ENVIS-Ticket');

const KEY_FILE = path.join(STORE_DIR, 'master.key');
const STORE_FILE = path.join(STORE_DIR, 'secrets.enc.json');

interface EncryptedEnvelope {
  v: 1;
  iv: string;
  tag: string;
  data: string;
}

function ensureStoreDir() {
  fs.mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
}

function readKey(): Buffer | null {
  try {
    if (!fs.existsSync(KEY_FILE)) return null;
    const raw = fs.readFileSync(KEY_FILE, 'utf8').trim();
    const key = Buffer.from(raw, 'base64');
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

function writeKey(): Buffer {
  ensureStoreDir();
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString('base64'), { mode: 0o600 });
  return key;
}

export function hasSecretStore(): boolean {
  return fs.existsSync(STORE_FILE) && fs.existsSync(KEY_FILE);
}

export function loadSecretStore(): Record<string, string> {
  try {
    if (!fs.existsSync(STORE_FILE)) return {};
    const key = readKey();
    if (!key) return {};

    const envelope = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as EncryptedEnvelope;
    if (envelope?.v !== 1) return {};

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.data, 'base64')),
      decipher.final(),
    ]).toString('utf8');

    const parsed = JSON.parse(plaintext);
    return typeof parsed === 'object' && parsed ? (parsed as Record<string, string>) : {};
  } catch (error) {
    console.warn(
      '⚠️  Could not decrypt the ENVIS secret store. Falling back to environment variables.',
      error instanceof Error ? error.message : ''
    );
    return {};
  }
}

/**
 * Writes the encrypted store. The key file is created on first use. This is
 * only invoked by the local setup/rotation tool, never by the web server.
 */
export function saveSecretStore(values: Record<string, string>): void {
  ensureStoreDir();
  const key = readKey() ?? writeKey();

  const payload = JSON.stringify(values);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope: EncryptedEnvelope = {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: data.toString('base64'),
  };

  fs.writeFileSync(STORE_FILE, JSON.stringify(envelope, null, 2), { mode: 0o600 });
}

/**
 * Loads decrypted secrets into process.env for values that are not already
 * provided by the real environment. This module is imported before any other
 * application module so secrets are available at import time.
 */
function hydrateEnvironment(): void {
  const missing = SECRET_KEYS.filter((key) => !process.env[key]);
  if (missing.length === 0) return;

  const store = loadSecretStore();
  let loaded = 0;

  for (const key of missing) {
    const value = store[key];
    if (value) {
      process.env[key] = value;
      loaded += 1;
    }
  }

  if (loaded > 0) {
    console.log(`🔐 Loaded ${loaded} secret(s) from the encrypted local store.`);
  } else if (missing.some((key) => key.startsWith('SMTP_'))) {
    console.warn(
      '🔐 No encrypted secret store found. Email delivery is disabled until secrets are configured.'
    );
  }
}

hydrateEnvironment();

export function isSecretConfigured(key: SecretKey): boolean {
  return Boolean(process.env[key]);
}
