import 'dotenv/config';
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { ensureSchema } from '../db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH
  ? resolve(__dirname, '../../../', process.env.DB_PATH)
  : resolve(__dirname, '../../../data/envis.db');

mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

ensureSchema(db);

export function getDb() {
  return db;
}
