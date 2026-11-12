import './secrets.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWTPayload, UserRole } from '@envis/shared';

/**
 * Secrets are never hardcoded. In development, if they are missing we generate
 * ephemeral secrets (tokens are invalidated on restart) and warn instead of
 * shipping a predictable fallback that could be abused in production.
 */
function resolveSecret(name: string, minLength = 32): string {
  const value = process.env[name];
  if (value && value.length >= minLength) return value;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set to a random string of at least ${minLength} characters.`);
  }

  const ephemeral = crypto.randomBytes(48).toString('base64url');
  console.warn(`⚠️  ${name} is missing or too short; using an ephemeral development secret.`);
  process.env[name] = ephemeral;
  return ephemeral;
}

const JWT_SECRET = resolveSecret('JWT_SECRET');
const JWT_REFRESH_SECRET = resolveSecret('JWT_REFRESH_SECRET');
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Admin': 7,
  'Regional Director': 6,
  'EMED': 5,
  'CPD': 4,
  'MIS': 3,
  'Extractor': 2,
  'GIS': 1,
};

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}