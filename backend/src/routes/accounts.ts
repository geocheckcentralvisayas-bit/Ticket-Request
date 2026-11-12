import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { getDb } from '../utils/db.js';
import { authenticate, AuthenticatedRequest, requirePermission } from '../middleware/auth.js';
import { USER_ROLES, generatePassword } from '@envis/shared';

const router = Router();

const EDITABLE_STATUSES = ['Pending', 'Approved', 'Rejected', 'Active', 'Disabled'];

router.get('/', authenticate, requirePermission('manage_accounts'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const { status, role, division, search, page = '1', limit = '50' } = req.query;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (status) {
    whereClause += ' AND ta.status = ?';
    params.push(status);
  }

  if (role) {
    whereClause += ' AND ta.role = ?';
    params.push(role);
  }

  if (division) {
    whereClause += ' AND ta.division = ?';
    params.push(division);
  }

  if (search) {
    whereClause += ' AND (ta.username LIKE ? OR ta.full_name LIKE ? OR ta.email LIKE ? OR ta.division LIKE ? OR t.ticket_number LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
  const offset = (pageNum - 1) * limitNum;

  const accounts = db.prepare(`
    SELECT ta.*, t.ticket_number, t.title as ticket_title,
           u.username as approved_by_username, u.full_name as approved_by_name
    FROM ticket_accounts ta
    LEFT JOIN tickets t ON ta.ticket_id = t.id
    LEFT JOIN users u ON ta.approved_by = u.id
    ${whereClause}
    ORDER BY ta.created_at DESC, ta.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM ticket_accounts ta
    LEFT JOIN tickets t ON ta.ticket_id = t.id
    ${whereClause}
  `).get(...params) as { count: number };

  res.json({ accounts, total: total.count, page: pageNum, limit: limitNum });
});

router.get('/stats', authenticate, requirePermission('manage_accounts'), (req: AuthenticatedRequest, res) => {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0) as approved,
      COALESCE(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END), 0) as rejected,
      COALESCE(SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END), 0) as active,
      COALESCE(SUM(CASE WHEN status = 'Disabled' THEN 1 ELSE 0 END), 0) as disabled
    FROM ticket_accounts
  `).get() as any;

  const byRole = db.prepare(`
    SELECT role, COUNT(*) as count
    FROM ticket_accounts
    GROUP BY role
  `).all() as any[];

  const byDivision = db.prepare(`
    SELECT division, COUNT(*) as count
    FROM ticket_accounts
    GROUP BY division
  `).all() as any[];

  res.json({ ...stats, byRole, byDivision });
});

router.get('/roles', authenticate, (req: AuthenticatedRequest, res) => {
  res.json(USER_ROLES);
});

router.patch('/:id', authenticate, requirePermission('manage_accounts'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const accountId = parseInt(req.params.id);
  const { status, role, division, username, email, full_name } = req.body;

  const account = db.prepare('SELECT * FROM ticket_accounts WHERE id = ?').get(accountId) as any;
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (status !== undefined && !EDITABLE_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid account status' });
  }

  if (role !== undefined && !USER_ROLES.some((item) => item.value === role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  for (const [field, value] of Object.entries({ username, email, full_name, division })) {
    if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
      return res.status(400).json({ error: `${field.replace('_', ' ')} cannot be empty` });
    }
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (role !== undefined) { updates.push('role = ?'); params.push(role); }
  if (division !== undefined) { updates.push('division = ?'); params.push(division); }
  if (username !== undefined) { updates.push('username = ?'); params.push(username); }
  if (email !== undefined) { updates.push('email = ?'); params.push(email); }
  if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push("updated_at = datetime('now')");
  params.push(accountId);

  db.prepare(`UPDATE ticket_accounts SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare(`
    SELECT ta.*, t.ticket_number, t.title as ticket_title
    FROM ticket_accounts ta
    LEFT JOIN tickets t ON ta.ticket_id = t.id
    WHERE ta.id = ?
  `).get(accountId);

  res.json(updated);
});

router.post('/:id/enable', authenticate, requirePermission('manage_accounts'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const accountId = parseInt(req.params.id);

  const account = db.prepare('SELECT * FROM ticket_accounts WHERE id = ?').get(accountId) as any;
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  db.prepare("UPDATE ticket_accounts SET status = 'Active', updated_at = datetime('now') WHERE id = ?").run(accountId);

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(account.username) as any;
  if (user) {
    db.prepare("UPDATE users SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(user.id);
  }

  res.json({ message: 'Account enabled successfully' });
});

router.post('/:id/disable', authenticate, requirePermission('manage_accounts'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const accountId = parseInt(req.params.id);

  const account = db.prepare('SELECT * FROM ticket_accounts WHERE id = ?').get(accountId) as any;
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  db.prepare("UPDATE ticket_accounts SET status = 'Disabled', updated_at = datetime('now') WHERE id = ?").run(accountId);

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(account.username) as any;
  if (user) {
    db.prepare("UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(user.id);
  }

  res.json({ message: 'Account disabled successfully' });
});

router.post('/:id/reset-password', authenticate, requirePermission('manage_accounts'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const accountId = parseInt(req.params.id);

  const account = db.prepare('SELECT * FROM ticket_accounts WHERE id = ?').get(accountId) as any;
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const password = generatePassword();
  const hash = bcrypt.hashSync(password, 10);

  db.prepare("UPDATE ticket_accounts SET generated_password = ?, updated_at = datetime('now') WHERE id = ?").run(password, accountId);

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(account.username) as any;
  if (user) {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, user.id);
  }

  res.json({ password, message: 'Password reset. This is the only time it will be shown.' });
});

router.post('/bulk-action', authenticate, requirePermission('manage_accounts'), (req: AuthenticatedRequest, res) => {
  const { accountIds, action } = req.body;
  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    return res.status(400).json({ error: 'Account IDs array is required' });
  }

  if (!['enable', 'disable', 'reset-password'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be enable, disable, or reset-password' });
  }

  const db = getDb();
  const placeholders = accountIds.map(() => '?').join(',');
  const accounts = db.prepare(`SELECT * FROM ticket_accounts WHERE id IN (${placeholders})`).all(...accountIds) as any[];

  const results: Array<{ id: number; success: boolean; password?: string }> = [];

  const runBulk = db.transaction(() => {
    for (const account of accounts) {
      if (action === 'enable') {
        db.prepare("UPDATE ticket_accounts SET status = 'Active', updated_at = datetime('now') WHERE id = ?").run(account.id);
        db.prepare("UPDATE users SET is_active = 1, updated_at = datetime('now') WHERE username = ?").run(account.username);
        results.push({ id: account.id, success: true });
      } else if (action === 'disable') {
        db.prepare("UPDATE ticket_accounts SET status = 'Disabled', updated_at = datetime('now') WHERE id = ?").run(account.id);
        db.prepare("UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE username = ?").run(account.username);
        results.push({ id: account.id, success: true });
      } else {
        const password = generatePassword();
        const hash = bcrypt.hashSync(password, 10);
        db.prepare("UPDATE ticket_accounts SET generated_password = ?, updated_at = datetime('now') WHERE id = ?").run(password, account.id);
        db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE username = ?").run(hash, account.username);
        results.push({ id: account.id, success: true, password });
      }
    }
  });

  runBulk();

  res.json({ results, message: `${action} completed for ${results.length} account(s)` });
});

export default router;
