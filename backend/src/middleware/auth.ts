import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader } from '../utils/auth.js';
import { getDb } from '../utils/db.js';
import { UserRole, ROLE_PERMISSIONS, JWTPayload } from '@envis/shared';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload & { dbUser?: { id: number; is_active: boolean } };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractTokenFromHeader(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(payload.userId) as { id: number; is_active: number } | undefined;

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'User not found or inactive' });
  }

  req.user = { ...payload, dbUser: { id: user.id, is_active: !!user.is_active } };
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const permissions = ROLE_PERMISSIONS[req.user.role] || [];

    if (!permissions.includes(permission)) {
      return res.status(403).json({ error: `Permission '${permission}' required` });
    }

    next();
  };
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractTokenFromHeader(req.headers.authorization);
  if (!token) {
    return next();
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return next();
  }

  const db = getDb();
  const user = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(payload.userId) as { id: number; is_active: number } | undefined;

  if (user && user.is_active) {
    req.user = { ...payload, dbUser: { id: user.id, is_active: !!user.is_active } };
  }

  next();
}
