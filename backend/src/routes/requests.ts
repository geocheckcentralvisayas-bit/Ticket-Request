import { Router, Response } from 'express';
import { getDb } from '../utils/db.js';
import { authenticate, AuthenticatedRequest, requirePermission } from '../middleware/auth.js';
import { accessRequestStatusSchema, accessRequestReplySchema } from '../utils/validation.js';
import { canViewAll } from '@envis/shared';
import { sendEmail, generateAccessRequestReplyEmail } from '../services/email.js';
import { mapRequestRow, mapRequestMessageRow } from '../utils/serialize.js';

const router = Router();

router.get('/', authenticate, requirePermission('view_all'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const { status, search, page = '1', limit = '20' } = req.query;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (status && status !== 'all') {
    whereClause += ' AND r.status = ?';
    params.push(status);
  }
  if (search) {
    whereClause += ' AND (r.ref_number LIKE ? OR r.full_name LIKE ? OR r.email LIKE ? OR r.subject LIKE ? OR r.message LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
  const offset = (pageNum - 1) * limitNum;

  const rows = db.prepare(`
    SELECT r.*,
           u.username as assignee_username, u.full_name as assignee_name, u.email as assignee_email,
           u.role as assignee_role, u.division as assignee_division,
           (SELECT COUNT(*) FROM access_request_messages m WHERE m.request_id = r.id) as message_count
    FROM access_requests r
    LEFT JOIN users u ON r.assigned_to = u.id
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset) as any[];

  const total = db.prepare(`SELECT COUNT(*) as count FROM access_requests r ${whereClause}`).get(...params) as { count: number };

  res.json({ requests: rows.map(mapRequestRow), total: total.count, page: pageNum, limit: limitNum });
});

router.get('/stats', authenticate, requirePermission('view_all'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END), 0) as new,
      COALESCE(SUM(CASE WHEN status = 'In Review' THEN 1 ELSE 0 END), 0) as in_review,
      COALESCE(SUM(CASE WHEN status = 'Contacted' THEN 1 ELSE 0 END), 0) as contacted,
      COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0) as approved,
      COALESCE(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END), 0) as rejected,
      COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0) as closed
    FROM access_requests
  `).get() as any;
  res.json(stats);
});

router.get('/:id', authenticate, requirePermission('view_all'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  const row = db.prepare(`
    SELECT r.*,
           u.username as assignee_username, u.full_name as assignee_name, u.email as assignee_email,
           u.role as assignee_role, u.division as assignee_division
    FROM access_requests r
    LEFT JOIN users u ON r.assigned_to = u.id
    WHERE r.id = ?
  `).get(id) as any;
  if (!row) return res.status(404).json({ error: 'Request not found' });

  const messages = (db.prepare(`
    SELECT m.*, u.username, u.full_name, u.role
    FROM access_request_messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.request_id = ?
    ORDER BY m.created_at ASC, m.id ASC
  `).all(id) as any[]).map(mapRequestMessageRow);

  res.json({ ...mapRequestRow(row), messages });
});

router.patch('/:id/status', authenticate, requirePermission('view_all'), (req: AuthenticatedRequest, res) => {
  const result = accessRequestStatusSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }
  const { status, note } = result.data;
  const id = parseInt(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'Request not found' });

  db.prepare(`
    UPDATE access_requests
    SET status = ?, updated_at = datetime('now'),
        resolved_at = CASE WHEN ? IN ('Approved','Rejected','Closed') THEN datetime('now') ELSE resolved_at END,
        internal_notes = CASE WHEN ? IS NOT NULL AND ? != '' THEN COALESCE(internal_notes,'') || char(10) || ? ELSE internal_notes END
    WHERE id = ?
  `).run(status, status, note ?? null, note ?? null, note ? `[${new Date().toISOString()}] ${req.user!.username}: ${note}` : null, id);

  if (note) {
    db.prepare(`
      INSERT INTO access_request_messages (request_id, direction, channel, sender_name, body, user_id, is_internal)
      VALUES (?, 'outbound', 'internal', ?, ?, ?, 1)
    `).run(id, req.user!.username, `Status changed to ${status}. ${note}`, req.user!.userId);
  } else {
    db.prepare(`
      INSERT INTO access_request_messages (request_id, direction, channel, sender_name, body, user_id, is_internal)
      VALUES (?, 'outbound', 'internal', ?, ?, ?, 1)
    `).run(id, req.user!.username, `Status changed to ${status}.`, req.user!.userId);
  }

  const updated = db.prepare(`
    SELECT r.*, u.username as assignee_username, u.full_name as assignee_name, u.email as assignee_email, u.role as assignee_role, u.division as assignee_division
    FROM access_requests r LEFT JOIN users u ON r.assigned_to = u.id WHERE r.id = ?
  `).get(id) as any;
  res.json(mapRequestRow(updated));
});

router.post('/:id/reply', authenticate, requirePermission('view_all'), async (req: AuthenticatedRequest, res) => {
  const result = accessRequestReplySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }
  const { subject, body, cc, sendEmail: shouldSend, isInternal } = result.data;
  const id = parseInt(req.params.id);
  const db = getDb();
  const requestRow = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(id) as any;
  if (!requestRow) return res.status(404).json({ error: 'Request not found' });

  let emailLogId: number | null = null;
  let sendResult: { success: boolean; error?: string } = { success: true };

  if (isInternal) {
    db.prepare(`
      INSERT INTO access_request_messages (request_id, direction, channel, sender_name, sender_email, subject, body, user_id, is_internal)
      VALUES (?, 'outbound', 'internal', ?, ?, ?, ?, ?, 1)
    `).run(id, req.user!.username, null, subject, body, req.user!.userId);
  } else if (shouldSend) {
    const template = generateAccessRequestReplyEmail(requestRow.ref_number, requestRow.full_name, subject, body, req.user!.username);
    const delivered = await sendEmail({
      to: [requestRow.email],
      cc: cc && cc.length ? cc : undefined,
      subject: template.subject,
      body: template.body,
      requestId: id,
    });
    emailLogId = delivered.logId ?? null;
    sendResult = { success: delivered.success, error: delivered.error };
    db.prepare(`
      INSERT INTO access_request_messages (request_id, direction, channel, sender_name, sender_email, recipient_emails, subject, body, email_log_id, user_id, is_internal)
      VALUES (?, 'outbound', 'email', ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(id, req.user!.username, null, [requestRow.email, ...(cc || [])].join(', '), template.subject, body, emailLogId, req.user!.userId);

    // auto-move to Contacted if New/In Review
    if (['New', 'In Review'].includes(requestRow.status)) {
      db.prepare("UPDATE access_requests SET status = 'Contacted', updated_at = datetime('now') WHERE id = ?").run(id);
    }
  } else {
    db.prepare(`
      INSERT INTO access_request_messages (request_id, direction, channel, sender_name, subject, body, user_id, is_internal)
      VALUES (?, 'outbound', 'web', ?, ?, ?, ?, 0)
    `).run(id, req.user!.username, subject, body, req.user!.userId);
  }

  db.prepare("UPDATE access_requests SET updated_at = datetime('now') WHERE id = ?").run(id);

  const messages = (db.prepare(`
    SELECT m.*, u.username, u.full_name, u.role
    FROM access_request_messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.request_id = ?
    ORDER BY m.created_at ASC, m.id ASC
  `).all(id) as any[]).map(mapRequestMessageRow);

  res.status(201).json({ messages, email: sendResult, email_log_id: emailLogId });
});

router.patch('/:id/assign', authenticate, requirePermission('view_all'), (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);
  const { assignee_id } = req.body as { assignee_id?: number | null };
  const db = getDb();
  const existing = db.prepare('SELECT id FROM access_requests WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Request not found' });
  db.prepare("UPDATE access_requests SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?").run(assignee_id ?? null, id);
  res.json({ ok: true });
});

export default router;
