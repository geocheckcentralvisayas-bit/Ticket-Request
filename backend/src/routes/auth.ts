import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../utils/db.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/auth.js';
import { loginSchema, changePasswordSchema, resetPasswordSchema, updateProfileSchema } from '../utils/validation.js';
import { authenticate, AuthenticatedRequest, requirePermission } from '../middleware/auth.js';
import { UserRole } from '@envis/shared';

const router = Router();

// Constant-time-ish behaviour: unknown usernames still run a bcrypt comparison,
// and all credential failures return the same message to prevent enumeration.
const DUMMY_PASSWORD_HASH = '$2a$12$qMO00xHPyQgTxdUm4KYtLuTcXkmB4.NcMe/Hi01UIKfqT.nlMwMFi';

router.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const { username, password } = result.data;
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

  const validPassword = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);

  if (!user || !user.is_active || !validPassword) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role as UserRole,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  const { password_hash, ...userWithoutPassword } = user;

  res.json({
    user: userWithoutPassword,
    tokens: { accessToken, refreshToken },
  });
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(payload.userId) as { id: number; is_active: number } | undefined;

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'User not found or inactive' });
  }

  const newPayload = {
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
  };

  const accessToken = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);

  res.json({ accessToken, refreshToken: newRefreshToken });
});

router.post('/change-password', authenticate, async (req: AuthenticatedRequest, res) => {
  const result = changePasswordSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const { currentPassword, newPassword } = result.data;
  const db = getDb();

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.userId) as { password_hash: string } | undefined;

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newHash, req.user!.userId);

  res.json({ message: 'Password changed successfully' });
});

router.post('/reset-password', authenticate, requirePermission('manage_users'), async (req: AuthenticatedRequest, res) => {
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const { username, newPassword } = result.data;
  const db = getDb();

  const targetUser = db.prepare('SELECT id, role FROM users WHERE username = ?').get(username) as { id: number; role: UserRole } | undefined;

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (targetUser.id === req.user!.userId) {
    return res.status(400).json({ error: 'Use change-password endpoint for your own password' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newHash, targetUser.id);

  res.json({ message: 'Password reset successfully' });
});

router.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, email, full_name, role, division, is_active, notification_prefs, created_at, updated_at FROM users WHERE id = ?').get(req.user!.userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

router.patch('/profile', authenticate, (req: AuthenticatedRequest, res) => {
  const result = updateProfileSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const db = getDb();
  const { full_name, email, notification_prefs } = result.data;
  const updates: string[] = [];
  const params: any[] = [];

  if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name); }
  if (email !== undefined) { updates.push('email = ?'); params.push(email); }
  if (notification_prefs !== undefined) { updates.push('notification_prefs = ?'); params.push(notification_prefs); }

  if (email) {
    const emailTaken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user!.userId);
    if (emailTaken) {
      return res.status(409).json({ error: 'That email address is already in use' });
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push("updated_at = datetime('now')");
  params.push(req.user!.userId);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT id, username, email, full_name, role, division, is_active, notification_prefs, created_at, updated_at FROM users WHERE id = ?').get(req.user!.userId);
  res.json(updated);
});

export default router;