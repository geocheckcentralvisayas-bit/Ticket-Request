import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../utils/db.js';
import { authenticate, AuthenticatedRequest, requirePermission } from '../middleware/auth.js';
import { updateUserSchema } from '../utils/validation.js';
import { generatePassword, USER_ROLES } from '@envis/shared';

const router = Router();

router.get('/', authenticate, requirePermission('manage_users'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const { role, is_active, search, page = '1', limit = '50' } = req.query;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (role) {
    whereClause += ' AND role = ?';
    params.push(role);
  }

  if (is_active !== undefined) {
    whereClause += ' AND is_active = ?';
    params.push(is_active === 'true' ? 1 : 0);
  }

  if (search) {
    whereClause += ' AND (username LIKE ? OR full_name LIKE ? OR email LIKE ? OR division LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
  const offset = (pageNum - 1) * limitNum;

  const users = db.prepare(`
    SELECT id, username, email, full_name, role, division, is_active, created_at, updated_at
    FROM users ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  const total = db.prepare(`SELECT COUNT(*) as count FROM users ${whereClause}`).get(...params) as { count: number };

  res.json({ users, total: total.count, page: pageNum, limit: limitNum });
});

router.get('/roles', authenticate, (req: AuthenticatedRequest, res) => {
  res.json(USER_ROLES);
});

router.get('/:id', authenticate, requirePermission('manage_users'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, email, full_name, role, division, is_active, created_at, updated_at FROM users WHERE id = ?').get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

router.patch('/:id', authenticate, requirePermission('manage_users'), (req: AuthenticatedRequest, res) => {
  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const db = getDb();
  const userId = parseInt(req.params.id);

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { full_name, email, role, division, is_active } = result.data;

  if (email && email !== existing.email) {
    const emailTaken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
    if (emailTaken) {
      return res.status(409).json({ error: 'That email address is already in use' });
    }
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name); }
  if (email !== undefined) { updates.push('email = ?'); params.push(email); }
  if (role !== undefined) { updates.push('role = ?'); params.push(role); }
  if (division !== undefined) { updates.push('division = ?'); params.push(division); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push("updated_at = datetime('now')");
  params.push(userId);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT id, username, email, full_name, role, division, is_active, created_at, updated_at FROM users WHERE id = ?').get(userId);
  res.json(updated);
});

router.post('/:id/reset-password', authenticate, requirePermission('manage_users'), async (req: AuthenticatedRequest, res) => {
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const db = getDb();
  const userId = parseInt(req.params.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, userId);

  res.json({ message: 'Password reset successfully' });
});

router.post('/:id/generate-password', authenticate, requirePermission('manage_users'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const userId = parseInt(req.params.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const password = generatePassword();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, userId);

  res.json({ password, message: 'Password generated. This is the only time it will be shown.' });
});

router.delete('/:id', authenticate, requirePermission('manage_users'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const userId = parseInt(req.params.id);

  if (userId === req.user!.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const references = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM tickets WHERE requester_id = @id OR assignee_id = @id) +
      (SELECT COUNT(*) FROM messages WHERE user_id = @id) +
      (SELECT COUNT(*) FROM ticket_accounts WHERE approved_by = @id) AS count
  `).get({ id: userId }) as { count: number };

  if (references.count > 0) {
    return res.status(409).json({
      error: 'This user has ticket history and cannot be deleted. Deactivate the account instead.',
    });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ message: 'User deleted successfully' });
});

export default router;
