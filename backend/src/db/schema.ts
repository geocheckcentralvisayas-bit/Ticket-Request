import Database from 'better-sqlite3';

export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    division TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    notification_prefs TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'Open',
    priority TEXT DEFAULT 'Medium',
    requester_id INTEGER NOT NULL,
    assignee_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    closed_at TEXT,
    FOREIGN KEY (requester_id) REFERENCES users(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ticket_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    division TEXT NOT NULL,
    status TEXT DEFAULT 'Pending',
    generated_password TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    approved_at TEXT,
    approved_by INTEGER,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'user',
    is_internal INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER,
    request_id INTEGER,
    to_emails TEXT NOT NULL,
    cc_emails TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
  );

  CREATE TABLE IF NOT EXISTS access_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    organization TEXT,
    division TEXT,
    requested_role TEXT,
    request_type TEXT DEFAULT 'Access Request',
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'New',
    assigned_to INTEGER,
    internal_notes TEXT,
    source TEXT DEFAULT 'web',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS access_request_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    direction TEXT NOT NULL,
    channel TEXT DEFAULT 'email',
    sender_name TEXT,
    sender_email TEXT,
    recipient_emails TEXT,
    subject TEXT,
    body TEXT NOT NULL,
    email_log_id INTEGER,
    user_id INTEGER,
    is_internal INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (request_id) REFERENCES access_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (email_log_id) REFERENCES email_logs(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_ticket_accounts_ticket ON ticket_accounts(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_email_logs_ticket ON email_logs(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
  CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
  CREATE INDEX IF NOT EXISTS idx_access_requests_ref ON access_requests(ref_number);
  CREATE INDEX IF NOT EXISTS idx_access_request_messages_request ON access_request_messages(request_id);
`;

/**
 * Creates any missing tables/indexes and applies lightweight migrations for
 * databases created by older versions of the app.
 */
export function ensureSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);

  const userColumns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!userColumns.some((column) => column.name === 'notification_prefs')) {
    db.exec('ALTER TABLE users ADD COLUMN notification_prefs TEXT');
  }

  const emailColumns = db.prepare('PRAGMA table_info(email_logs)').all() as { name: string }[];
  if (!emailColumns.some((column) => column.name === 'request_id')) {
    db.exec('ALTER TABLE email_logs ADD COLUMN request_id INTEGER');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_email_logs_request ON email_logs(request_id)');
}
