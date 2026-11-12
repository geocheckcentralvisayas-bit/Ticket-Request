import './utils/secrets.js';
import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import authRoutes from './routes/auth.js';
import ticketRoutes from './routes/tickets.js';
import userRoutes from './routes/users.js';
import emailRoutes from './routes/emails.js';
import accountRoutes from './routes/accounts.js';
import publicRoutes from './routes/public.js';
import requestRoutes from './routes/requests.js';
import { seedDatabase } from './db/seed.js';
import { securityHeaders, rateLimit, noCache } from './middleware/security.js';
import { redactSecrets } from './utils/redact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Do not advertise the framework/version.
app.disable('x-powered-by');
// Trust forwarded headers only when running behind a known reverse proxy.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

app.use(securityHeaders);
// API responses must never be cached; static frontend assets may be.
app.use('/api', noCache);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Same-origin requests (curl, server-side, packaged builds) have no Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

app.use(express.json({ limit: '256kb' }));

// Broad protection for the whole API surface.
app.use('/api', rateLimit({ name: 'api', limit: 300, windowMs: 60 * 1000 }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Tighter limits on sensitive entry points.
app.use('/api/auth/login', rateLimit({ name: 'login', limit: 8, windowMs: 5 * 60 * 1000, message: 'Too many sign-in attempts. Try again in a few minutes.' }));
app.use('/api/public/access-requests', rateLimit({ name: 'public-intake', limit: 5, windowMs: 10 * 60 * 1000, message: 'Too many requests submitted from this network. Please try again later.' }));

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/accounts', accountRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// In production the built frontend can be served from the same origin.
const frontendDist = resolve(__dirname, '../../frontend/dist');
if (process.env.NODE_ENV === 'production' && existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(resolve(frontendDist, 'index.html'));
  });
}

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', redactSecrets(err?.message ?? err, 2000));
  if (res.headersSent) return next(err);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'production' ? {} : { details: redactSecrets(err?.message ?? err) }),
  });
});

async function start() {
  await seedDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 ENVIS Backend running on http://localhost:${PORT}`);
    console.log(`📝 API Health: http://localhost:${PORT}/api/health`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exitCode = 1;
});

export default app;
