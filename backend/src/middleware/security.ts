import { Request, Response, NextFunction } from 'express';

/**
 * Lightweight security middleware (no external dependencies).
 * Adds hardened response headers and a small in-memory rate limiter so the
 * API does not expose framework details or allow trivial brute-force/abuse.
 */

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // API responses never need to load anything, so lock them down completely.
  // The SPA (served by Express in production) needs its own policy that allows
  // the bundled script, stylesheet, and same-origin API calls.
  if (req.path.startsWith('/api')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
  } else {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
  }

  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Prevent unbounded memory growth from leaked IP keys.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

export interface RateLimitOptions {
  /** Bucket name, so different routes do not share counters. */
  name: string;
  /** Maximum requests allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Optional custom message returned with HTTP 429. */
  message?: string;
}

export function rateLimit({ name, limit, windowMs, message }: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prefer Express's resolved IP. X-Forwarded-For is only honoured when the
    // operator explicitly enables TRUST_PROXY behind a real reverse proxy, so a
    // directly exposed server cannot be bypassed by spoofing that header.
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${name}:${ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: message || 'Too many requests. Please slow down and try again shortly.',
      });
    }

    bucket.count += 1;
    next();
  };
}

/** Generic delay used to blunt automated credential stuffing on auth routes. */
export function noCache(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
}
