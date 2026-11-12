import { Router } from 'express';
import { getDb } from '../utils/db.js';
import { authenticate, AuthenticatedRequest, requirePermission } from '../middleware/auth.js';
import { sendEmailSchema } from '../utils/validation.js';
import { sendEmail, retryEmailLog, testEmailConnection } from '../services/email.js';
import { redactSecrets } from '../utils/redact.js';

const router = Router();

router.get('/', authenticate, requirePermission('view_all'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const { status, search, page = '1', limit = '50' } = req.query;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (status) {
    whereClause += ' AND el.status = ?';
    params.push(status);
  }

  if (search) {
    whereClause += ' AND (el.to_emails LIKE ? OR el.cc_emails LIKE ? OR el.subject LIKE ? OR t.ticket_number LIKE ? OR ar.ref_number LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
  const offset = (pageNum - 1) * limitNum;

  const emails = db.prepare(`
    SELECT el.*, t.ticket_number, t.title as ticket_title,
           ar.ref_number as request_ref, ar.subject as request_subject
    FROM email_logs el
    LEFT JOIN tickets t ON el.ticket_id = t.id
    LEFT JOIN access_requests ar ON el.request_id = ar.id
    ${whereClause}
    ORDER BY el.created_at DESC, el.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM email_logs el
    LEFT JOIN tickets t ON el.ticket_id = t.id
    LEFT JOIN access_requests ar ON el.request_id = ar.id
    ${whereClause}
  `).get(...params) as { count: number };

  res.json({ emails, total: total.count, page: pageNum, limit: limitNum });
});

router.get('/stats', authenticate, requirePermission('view_all'), (req: AuthenticatedRequest, res) => {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) as sent,
      COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending
    FROM email_logs
  `).get() as any;

  res.json(stats);
});

router.post('/send', authenticate, requirePermission('view_all'), async (req: AuthenticatedRequest, res) => {
  const result = sendEmailSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const { to, cc, subject, body, ticketId } = result.data;
  const sendResult = await sendEmail({ to, cc, subject, body, ticketId });

  if (sendResult.success) {
    res.json({ message: 'Email sent successfully' });
  } else {
    console.error('Email send failed:', sendResult.error);
    res.status(500).json({ error: 'Failed to send email', details: redactSecrets(sendResult.error) });
  }
});

router.post('/test', authenticate, requirePermission('view_all'), async (req: AuthenticatedRequest, res) => {
  const result = await testEmailConnection();
  if (result.success) {
    res.json({ message: 'SMTP connection successful' });
  } else {
    console.error('SMTP test failed:', result.error);
    res.status(500).json({ error: 'SMTP connection failed', details: redactSecrets(result.error) });
  }
});

router.post('/:id/retry', authenticate, requirePermission('view_all'), async (req: AuthenticatedRequest, res) => {
  const logId = parseInt(req.params.id);
  const result = await retryEmailLog(logId);

  if (result.success) {
    res.json({ message: 'Email sent successfully' });
  } else {
    console.error('Email retry failed:', result.error);
    const statusCode = result.error === 'Email log not found' ? 404 : 500;
    res.status(statusCode).json({ error: redactSecrets(result.error || 'Failed to send email') });
  }
});

// Deleting delivery records is restricted to administrators. It removes the
// outbox entry only; it cannot recall an email that was already delivered.
router.delete('/:id', authenticate, requirePermission('manage_settings'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const logId = parseInt(req.params.id, 10);

  if (!Number.isInteger(logId) || logId < 1) {
    return res.status(400).json({ error: 'Invalid email log id' });
  }

  const existing = db.prepare('SELECT id FROM email_logs WHERE id = ?').get(logId);
  if (!existing) {
    return res.status(404).json({ error: 'Email log not found' });
  }

  const remove = db.transaction(() => {
    db.prepare('UPDATE access_request_messages SET email_log_id = NULL WHERE email_log_id = ?').run(logId);
    db.prepare('DELETE FROM email_logs WHERE id = ?').run(logId);
  });

  remove();
  res.json({ message: 'Email log deleted', deleted: 1 });
});

router.delete('/', authenticate, requirePermission('manage_settings'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  if (status && !['sent', 'failed', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status filter' });
  }

  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];

  const total = db.prepare(`SELECT COUNT(*) as count FROM email_logs ${where}`).get(...params) as { count: number };

  const remove = db.transaction(() => {
    if (status) {
      db.prepare(`
        UPDATE access_request_messages
        SET email_log_id = NULL
        WHERE email_log_id IN (SELECT id FROM email_logs WHERE status = ?)
      `).run(status);
      db.prepare('DELETE FROM email_logs WHERE status = ?').run(status);
    } else {
      db.prepare('UPDATE access_request_messages SET email_log_id = NULL WHERE email_log_id IS NOT NULL').run();
      db.prepare('DELETE FROM email_logs').run();
    }
  });

  remove();
  res.json({ message: 'Email logs deleted', deleted: total.count });
});

export default router;
