import bcrypt from 'bcryptjs';
import { Router, Response } from 'express';
import type Database from 'better-sqlite3';
import { getDb } from '../utils/db.js';
import { createTicketSchema, updateTicketStatusSchema, approveRejectAccountSchema } from '../utils/validation.js';
import { authenticate, AuthenticatedRequest, requirePermission } from '../middleware/auth.js';
import { generateTicketNumber, generatePassword, canApprove, canViewAll } from '@envis/shared';
import {
  sendEmail,
  generateApprovalEmail,
  generateRejectionEmail,
  generateCredentialEmail,
  generateStatusChangeEmail,
} from '../services/email.js';
import { mapTicketRow, mapMessageRow } from '../utils/serialize.js';

const router = Router();

const TICKET_SELECT = `
  SELECT t.*,
         u.username as requester_username, u.full_name as requester_name, u.email as requester_email,
         u.role as requester_role, u.division as requester_division,
         a.username as assignee_username, a.full_name as assignee_name, a.email as assignee_email,
         a.role as assignee_role, a.division as assignee_division
  FROM tickets t
  LEFT JOIN users u ON t.requester_id = u.id
  LEFT JOIN users a ON t.assignee_id = a.id
`;

function getTicketWithAccounts(db: Database.Database, ticketId: number) {
  const row = db.prepare(`${TICKET_SELECT} WHERE t.id = ?`).get(ticketId) as any;
  if (!row) return null;
  row.accounts = db.prepare('SELECT * FROM ticket_accounts WHERE ticket_id = ? ORDER BY id ASC').all(ticketId);
  return mapTicketRow(row);
}

function getHandlerEmails(db: Database.Database) {
  return db.prepare(`
    SELECT email FROM users
    WHERE role IN ('Admin', 'Regional Director', 'EMED', 'CPD', 'MIS') AND is_active = 1
  `).all() as { email: string }[];
}

router.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const { status, category, assignee_id, search, page = '1', limit = '20' } = req.query;

  let whereClause = '';
  const params: any[] = [];

  if (!canViewAll(req.user!.role)) {
    whereClause += 'WHERE t.requester_id = ?';
    params.push(req.user!.userId);
  } else {
    whereClause += 'WHERE 1=1';
  }

  if (status) {
    whereClause += ' AND t.status = ?';
    params.push(status);
  }

  if (category) {
    whereClause += ' AND t.category = ?';
    params.push(category);
  }

  if (assignee_id) {
    whereClause += ' AND t.assignee_id = ?';
    params.push(assignee_id);
  }

  if (search) {
    whereClause += ' AND (t.title LIKE ? OR t.description LIKE ? OR t.ticket_number LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
  const offset = (pageNum - 1) * limitNum;

  const rows = db.prepare(`
    ${TICKET_SELECT}
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset) as any[];

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM tickets t ${whereClause}
  `).get(...params) as { count: number };

  const tickets = rows.map((row) => {
    row.accounts = db.prepare('SELECT * FROM ticket_accounts WHERE ticket_id = ?').all(row.id);
    return mapTicketRow(row);
  });

  res.json({ tickets, total: total.count, page: pageNum, limit: limitNum });
});

router.get('/stats', authenticate, (req: AuthenticatedRequest, res) => {
  const db = getDb();

  let whereClause = '';
  const params: any[] = [];

  if (!canViewAll(req.user!.role)) {
    whereClause += 'WHERE requester_id = ?';
    params.push(req.user!.userId);
  }

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END), 0) as open,
      COALESCE(SUM(CASE WHEN status = 'In Review' THEN 1 ELSE 0 END), 0) as in_review,
      COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0) as approved,
      COALESCE(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END), 0) as rejected,
      COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0) as closed
    FROM tickets ${whereClause}
  `).get(...params) as any;

  const categoryStats = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM tickets ${whereClause}
    GROUP BY category
  `).all(...params) as any[];

  res.json({ ...stats, byCategory: categoryStats });
});

router.get('/:id', authenticate, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const ticketId = parseInt(req.params.id);

  const ticket = getTicketWithAccounts(db, ticketId);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (!canViewAll(req.user!.role) && ticket.requester_id !== req.user!.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const internalFilter = canApprove(req.user!.role) ? '' : 'AND m.is_internal = 0';
  ticket.messages = (db.prepare(`
    SELECT m.*, u.username, u.full_name, u.role
    FROM messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.ticket_id = ? ${internalFilter}
    ORDER BY m.created_at ASC, m.id ASC
  `).all(ticketId) as any[]).map(mapMessageRow);

  res.json(ticket);
});

router.post('/', authenticate, (req: AuthenticatedRequest, res) => {
  const result = createTicketSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const { title, description, category, priority, accounts } = result.data;
  const db = getDb();

  const createTicket = db.transaction(() => {
    const ticketNumber = generateTicketNumber();

    const ticketResult = db.prepare(`
      INSERT INTO tickets (ticket_number, title, description, category, status, priority, requester_id)
      VALUES (?, ?, ?, ?, 'Open', ?, ?)
    `).run(ticketNumber, title, description, category, priority, req.user!.userId);

    const ticketId = Number(ticketResult.lastInsertRowid);

    const insertAccount = db.prepare(`
      INSERT INTO ticket_accounts (ticket_id, username, email, full_name, role, division, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Pending')
    `);

    for (const account of accounts) {
      insertAccount.run(ticketId, account.username, account.email, account.full_name, account.role, account.division);
    }

    db.prepare(`
      INSERT INTO messages (ticket_id, user_id, content, type, is_internal)
      VALUES (?, ?, ?, 'system', 0)
    `).run(ticketId, req.user!.userId, `Ticket created: ${title}`);

    return ticketId;
  });

  let ticketId: number;
  try {
    ticketId = createTicket();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ error: 'Failed to create ticket', details: message });
  }

  res.status(201).json(getTicketWithAccounts(db, ticketId));
});

router.patch('/:id/status', authenticate, requirePermission('approve'), (req: AuthenticatedRequest, res) => {
  const result = updateTicketStatusSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const { status, note } = result.data;
  const ticketId = parseInt(req.params.id);
  const db = getDb();

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  const oldStatus = ticket.status;

  const applyStatus = db.transaction(() => {
    db.prepare(`
      UPDATE tickets
      SET status = ?, updated_at = datetime('now'),
          closed_at = CASE WHEN ? = 'Closed' THEN datetime('now') ELSE closed_at END
      WHERE id = ?
    `).run(status, status, ticketId);

    if (note) {
      db.prepare(`
        INSERT INTO messages (ticket_id, user_id, content, type, is_internal)
        VALUES (?, ?, ?, 'handler', 0)
      `).run(ticketId, req.user!.userId, note);
    }

    db.prepare(`
      INSERT INTO messages (ticket_id, user_id, content, type, is_internal)
      VALUES (?, ?, ?, 'system', 0)
    `).run(ticketId, req.user!.userId, `Status changed from ${oldStatus} to ${status}`);
  });

  applyStatus();

  const updatedTicket = getTicketWithAccounts(db, ticketId)!;

  if (updatedTicket.requester_email) {
    const emailTemplate = generateStatusChangeEmail(updatedTicket.ticket_number, updatedTicket.title, oldStatus, status, note);
    sendEmail({
      to: [updatedTicket.requester_email],
      cc: getHandlerEmails(db).map((handler) => handler.email),
      subject: emailTemplate.subject,
      body: emailTemplate.body,
      ticketId,
    });
  }

  res.json(updatedTicket);
});

router.post('/:id/accounts/action', authenticate, requirePermission('approve'), (req: AuthenticatedRequest, res) => {
  const result = approveRejectAccountSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const { accountIds, action, note } = result.data;
  const ticketId = parseInt(req.params.id);
  const db = getDb();

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  const placeholders = accountIds.map(() => '?').join(',');
  const accounts = db.prepare(`SELECT * FROM ticket_accounts WHERE id IN (${placeholders}) AND ticket_id = ?`).all(...accountIds, ticketId) as any[];

  if (accounts.length === 0) {
    return res.status(404).json({ error: 'No matching accounts found' });
  }

  const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
  const now = new Date().toISOString();
  const passwords: Record<number, string> = {};

  try {
    const processAccounts = db.transaction(() => {
      for (const account of accounts) {
        if (action === 'approve') {
          const password = account.generated_password || generatePassword();
          passwords[account.id] = password;

          db.prepare(`
            UPDATE ticket_accounts
            SET status = ?, generated_password = ?, approved_at = ?, approved_by = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(newStatus, password, now, req.user!.userId, account.id);

          const hash = bcrypt.hashSync(password, 10);
          const existingByUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(account.username) as { id: number } | undefined;
          const existingByEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(account.email) as { id: number } | undefined;

          if (existingByUsername && existingByEmail && existingByUsername.id !== existingByEmail.id) {
            throw new Error(`Username ${account.username} and email ${account.email} belong to different users`);
          }

          if (!existingByUsername && existingByEmail) {
            throw new Error(`Email ${account.email} already belongs to another user`);
          }

          const existing = existingByUsername || existingByEmail;
          if (existing) {
            db.prepare(`
              UPDATE users
              SET username = ?, email = ?, password_hash = ?, full_name = ?, role = ?, division = ?, is_active = 1, updated_at = datetime('now')
              WHERE id = ?
            `).run(account.username, account.email, hash, account.full_name, account.role, account.division, existing.id);
          } else {
            db.prepare(`
              INSERT INTO users (username, email, password_hash, full_name, role, division, is_active)
              VALUES (?, ?, ?, ?, ?, ?, 1)
            `).run(account.username, account.email, hash, account.full_name, account.role, account.division);
          }
        } else {
          db.prepare(`
            UPDATE ticket_accounts
            SET status = ?, approved_at = ?, approved_by = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(newStatus, now, req.user!.userId, account.id);
        }
      }
    });

    processAccounts();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(409).json({ error: 'Failed to process accounts', details: message });
  }

  if (note) {
    db.prepare(`
      INSERT INTO messages (ticket_id, user_id, content, type, is_internal)
      VALUES (?, ?, ?, 'handler', 0)
    `).run(ticketId, req.user!.userId, note);
  }

  db.prepare(`
    INSERT INTO messages (ticket_id, user_id, content, type, is_internal)
    VALUES (?, ?, ?, 'system', 0)
  `).run(ticketId, req.user!.userId, `${action === 'approve' ? 'Approved' : 'Rejected'} ${accounts.length} account(s)`);

  let updatedTicket = getTicketWithAccounts(db, ticketId)!;

  const allApproved = updatedTicket.accounts!.every((account: any) => account.status === 'Approved');
  const allRejected = updatedTicket.accounts!.every((account: any) => account.status === 'Rejected');
  const anyApproved = updatedTicket.accounts!.some((account: any) => account.status === 'Approved');

  let newTicketStatus = ticket.status;
  if (allApproved) newTicketStatus = 'Approved';
  else if (allRejected) newTicketStatus = 'Rejected';
  else if (anyApproved) newTicketStatus = 'In Review';

  if (newTicketStatus !== ticket.status) {
    db.prepare("UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newTicketStatus, ticketId);
    updatedTicket = getTicketWithAccounts(db, ticketId)!;
  }

  if (updatedTicket.requester_email) {
    const handlerEmails = getHandlerEmails(db).map((handler) => handler.email);

    if (action === 'approve') {
      const emailAccounts = accounts.map((account) => ({
        fullName: account.full_name,
        username: account.username,
        email: account.email,
        role: account.role,
        division: account.division,
        password: passwords[account.id],
      }));

      const approvalTemplate = generateApprovalEmail(updatedTicket.ticket_number, updatedTicket.title, emailAccounts, note);
      sendEmail({
        to: [updatedTicket.requester_email],
        cc: handlerEmails,
        subject: approvalTemplate.subject,
        body: approvalTemplate.body,
        ticketId,
      });

      const credentialTemplate = generateCredentialEmail(updatedTicket.ticket_number, updatedTicket.title, emailAccounts);
      sendEmail({
        to: [updatedTicket.requester_email],
        subject: credentialTemplate.subject,
        body: credentialTemplate.body,
        ticketId,
      });
    } else {
      const rejectionAccounts = accounts.map((account) => ({
        fullName: account.full_name,
        username: account.username,
      }));
      const rejectionTemplate = generateRejectionEmail(updatedTicket.ticket_number, updatedTicket.title, rejectionAccounts, note);
      sendEmail({
        to: [updatedTicket.requester_email],
        cc: handlerEmails,
        subject: rejectionTemplate.subject,
        body: rejectionTemplate.body,
        ticketId,
      });
    }
  }

  res.json(updatedTicket);
});

router.post('/:id/messages', authenticate, (req: AuthenticatedRequest, res) => {
  const { content, is_internal } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  const ticketId = parseInt(req.params.id);
  const db = getDb();

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (!canViewAll(req.user!.role) && ticket.requester_id !== req.user!.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const isHandler = canApprove(req.user!.role);
  const internalFlag = is_internal && isHandler ? 1 : 0;
  const type = internalFlag ? 'internal' : (isHandler ? 'handler' : 'user');

  const insert = db.prepare(`
    INSERT INTO messages (ticket_id, user_id, content, type, is_internal)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = insert.run(ticketId, req.user!.userId, content.trim(), type, internalFlag);

  db.prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").run(ticketId);

  const message = db.prepare(`
    SELECT m.*, u.username, u.full_name, u.role
    FROM messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid) as any;

  res.status(201).json(mapMessageRow(message));
});

router.get('/:id/messages', authenticate, (req: AuthenticatedRequest, res) => {
  const ticketId = parseInt(req.params.id);
  const db = getDb();

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (!canViewAll(req.user!.role) && ticket.requester_id !== req.user!.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const internalFilter = canApprove(req.user!.role) ? '' : 'AND m.is_internal = 0';
  const messages = (db.prepare(`
    SELECT m.*, u.username, u.full_name, u.role
    FROM messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.ticket_id = ? ${internalFilter}
    ORDER BY m.created_at ASC, m.id ASC
  `).all(ticketId) as any[]).map(mapMessageRow);

  res.json(messages);
});

export default router;
