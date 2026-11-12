import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type Database from 'better-sqlite3';
import { db as defaultDb } from '../utils/db.js';
import { UserRole } from '@envis/shared';

/**
 * Seed data intentionally contains NO passwords. Credentials are supplied at
 * runtime through environment variables (or generated randomly for brand-new
 * databases and written once to an ignored local file), and existing accounts
 * are never re-hashed on startup so changed passwords are preserved.
 */

interface SeedAccount {
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  division: string;
}

const ENVIS_ACCOUNTS: SeedAccount[] = [
  { username: 'rd.regional', email: 'rd.regional@envis.gov.ph', full_name: 'Regional Director', role: 'Regional Director', division: 'Office of the Regional Director' },
  { username: 'emed.enforce', email: 'emed.enforce@envis.gov.ph', full_name: 'EMED - Environmental Monitoring & Enforcement', role: 'EMED', division: 'Environmental Monitoring & Enforcement Division' },
  { username: 'cpd.permits', email: 'cpd.permits@envis.gov.ph', full_name: 'CPD - Clearance and Permitting', role: 'CPD', division: 'Clearance and Permitting Division' },
  { username: 'mis.systems', email: 'mis.systems@envis.gov.ph', full_name: 'MIS - Management and Information System', role: 'MIS', division: 'Management and Information System' },
  { username: 'extractor', email: 'extractor@envis.gov.ph', full_name: 'Data Extractor', role: 'Extractor', division: 'Data Extraction' },
  { username: 'gis.spatial', email: 'gis.spatial@envis.gov.ph', full_name: 'GIS Spatial', role: 'GIS', division: 'GIS Unit' },
  { username: 'admin', email: 'admin@envis.gov.ph', full_name: 'System Administrator', role: 'Admin', division: 'IT Administration' },
];

function generatePassword(): string {
  // 24 URL-safe characters ≈ 144 bits of entropy.
  return crypto.randomBytes(18).toString('base64url');
}

function envKey(username: string, prefix: string): string {
  return `${prefix}_${username.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
}

function credentialFor(account: SeedAccount): string | null {
  const perUser = process.env[envKey(account.username, 'SEED_PASSWORD')];
  if (perUser && perUser.length >= 8) return perUser;
  if (process.env.SEED_DEFAULT_PASSWORD && process.env.SEED_DEFAULT_PASSWORD.length >= 8) {
    return process.env.SEED_DEFAULT_PASSWORD;
  }
  return null;
}

function bootstrapPasswordFor(account: SeedAccount): string | null {
  const perUser = process.env[envKey(account.username, 'BOOTSTRAP_PASSWORD')];
  if (perUser && perUser.length >= 8) return perUser;
  if (process.env.BOOTSTRAP_PASSWORD && process.env.BOOTSTRAP_PASSWORD.length >= 8) {
    return process.env.BOOTSTRAP_PASSWORD;
  }
  return null;
}

export async function seedDatabase(database: Database.Database = defaultDb) {
  const insertUser = database.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, role, division, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
  `);

  // Refresh display metadata. Passwords are only changed when an explicit
  // BOOTSTRAP_PASSWORD(_<USERNAME>) is provided (e.g. first deploy/recovery).
  const updateUser = database.prepare(`
    UPDATE users
    SET email = ?, full_name = ?, role = ?, division = ?, updated_at = datetime('now')
    WHERE username = ?
  `);

  const updatePassword = database.prepare(`
    UPDATE users
    SET password_hash = ?, updated_at = datetime('now')
    WHERE username = ?
  `);

  const findUser = database.prepare('SELECT id FROM users WHERE username = ?');

  const generated: Array<{ username: string; password: string }> = [];

  for (const account of ENVIS_ACCOUNTS) {
    const existing = findUser.get(account.username) as { id: number } | undefined;

    if (existing) {
      updateUser.run(account.email, account.full_name, account.role, account.division, account.username);

      const bootstrap = bootstrapPasswordFor(account);
      if (bootstrap) {
        const hash = await bcrypt.hash(bootstrap, 12);
        updatePassword.run(hash, account.username);
        console.warn(`Password reset via bootstrap for: ${account.username}`);
      }
      continue;
    }

    const password = credentialFor(account) ?? bootstrapPasswordFor(account) ?? generatePassword();
    const hash = await bcrypt.hash(password, 12);
    insertUser.run(account.username, account.email, hash, account.full_name, account.role, account.division);

    if (!credentialFor(account) && !bootstrapPasswordFor(account)) {
      generated.push({ username: account.username, password });
    }
    console.log(`Created account: ${account.username} (${account.role})`);
  }

  if (generated.length > 0) {
    const outPath = resolve(process.cwd(), 'data', 'initial-credentials.txt');
    try {
      mkdirSync(dirname(outPath), { recursive: true });
      const lines = [
        'ENVIS Ticket Request - generated initial credentials',
        `Created: ${new Date().toISOString()}`,
        'Keep this file private. Delete it after distributing credentials and change passwords on first login.',
        '',
        ...generated.map((entry) => `${entry.username}\t${entry.password}`),
        '',
      ];
      const prefix = existsSync(outPath) ? '\n' : '';
      writeFileSync(outPath, `${prefix}${lines.join('\n')}`, { mode: 0o600 });
      console.warn(`Initial credentials for ${generated.length} new account(s) written to data/initial-credentials.txt`);
    } catch (error) {
      console.warn('Could not write generated credentials file:', error instanceof Error ? error.message : error);
    }
  }

  console.log('Account seed check complete.');
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  seedDatabase().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
