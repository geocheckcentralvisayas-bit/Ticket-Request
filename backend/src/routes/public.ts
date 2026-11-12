import { Router } from 'express';
import { getDb } from '../utils/db.js';
import { publicAccessRequestSchema, accessRequestLookupSchema } from '../utils/validation.js';
import { generateRequestRef } from '@envis/shared';
import { sendEmail, generateAccessRequestAckEmail } from '../services/email.js';

const router = Router();

// Simple in-memory rate limit (per IP) for public submissions
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string, limit = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function createUniqueRef(db: ReturnType<typeof getDb>) {
  for (let i = 0; i < 10; i++) {
    const ref = generateRequestRef();
    const exists = db.prepare('SELECT 1 FROM access_requests WHERE ref_number = ?').get(ref);
    if (!exists) return ref;
  }
  return `${generateRequestRef()}-${Date.now().toString().slice(-4)}`;
}

router.post('/access-requests', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const result = publicAccessRequestSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const data = result.data;
  const db = getDb();
  const refNumber = createUniqueRef(db);

  const insert = db.prepare(`
    INSERT INTO access_requests (ref_number, full_name, email, organization, division, requested_role, request_type, subject, message, status, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'web')
  `);
  const info = insert.run(
    refNumber,
    data.full_name.trim(),
    data.email.trim().toLowerCase(),
    data.organization?.trim() || null,
    data.division?.trim() || null,
    data.requested_role?.trim() || null,
    data.request_type?.trim() || 'Access Request',
    data.subject.trim(),
    data.message.trim()
  );
  const requestId = Number(info.lastInsertRowid);

  db.prepare(`
    INSERT INTO access_request_messages (request_id, direction, channel, sender_name, sender_email, subject, body, is_internal)
    VALUES (?, 'inbound', 'web', ?, ?, ?, ?, 0)
  `).run(requestId, data.full_name.trim(), data.email.trim().toLowerCase(), data.subject.trim(), data.message.trim());

  // Send acknowledgement email (best-effort)
  const ack = generateAccessRequestAckEmail(refNumber, data.full_name.trim(), data.subject.trim());
  try {
    await sendEmail({
      to: [data.email.trim().toLowerCase()],
      subject: ack.subject,
      body: ack.body,
      requestId,
    });
  } catch {
    // ignore - logged by sendEmail
  }

  // Notify handlers (best-effort)
  try {
    const configured = (process.env.NOTIFICATION_EMAILS || process.env.NOTIFICATION_EMAIL || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    let handlerEmails = configured;
    if (handlerEmails.length === 0) {
      const handlers = db.prepare(`
        SELECT email FROM users WHERE role IN ('Admin', 'Regional Director', 'EMED', 'CPD', 'MIS') AND is_active = 1 AND email IS NOT NULL AND email != ''
      `).all() as { email: string }[];
      handlerEmails = [...new Set(handlers.map(h => h.email).filter(Boolean))];
    }
    if (handlerEmails.length > 0) {
      await sendEmail({
        to: handlerEmails,
        subject: `📥 New Access Request ${refNumber}: ${data.subject.trim()}`,
        body: `<p>A new access request was submitted.</p>
               <p><strong>Reference:</strong> ${refNumber}<br/>
               <strong>From:</strong> ${data.full_name} (${data.email})<br/>
               <strong>Division:</strong> ${data.division || '-'}<br/>
               <strong>Requested role:</strong> ${data.requested_role || '-'}<br/>
               <strong>Subject:</strong> ${data.subject}</p>
               <p><strong>Message:</strong></p>
               <div style="white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:8px;">${data.message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
               <p>Please review it in the ENVIS Inbox.</p>`,
        requestId,
      });
    }
  } catch {
    // ignore
  }

  const created = db.prepare('SELECT ref_number, status, created_at FROM access_requests WHERE id = ?').get(requestId) as any;
  res.status(201).json({
    ref_number: created.ref_number,
    status: created.status,
    created_at: created.created_at,
    message: 'Request submitted successfully. A confirmation email will be sent to you if SMTP is configured.',
  });
});

router.post('/access-requests/lookup', (req, res) => {
  const result = accessRequestLookupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }
  const { ref_number, email } = result.data;
  const db = getDb();
  const row = db.prepare(`
    SELECT ref_number, full_name, email, organization, division, requested_role, request_type, subject, status, created_at, updated_at, resolved_at
    FROM access_requests
    WHERE ref_number = ? AND lower(email) = lower(?)
  `).get(ref_number.trim(), email.trim()) as any;

  if (!row) {
    return res.status(404).json({ error: 'Request not found. Check your reference number and email.' });
  }

  // return public-safe messages (exclude internal notes)
  const messages = db.prepare(`
    SELECT id, direction, channel, sender_name, subject, body, is_internal, created_at
    FROM access_request_messages
    WHERE request_id = (SELECT id FROM access_requests WHERE ref_number = ? AND lower(email) = lower(?)) AND is_internal = 0
    ORDER BY created_at ASC, id ASC
  `).all(ref_number.trim(), email.trim());

  res.json({ request: row, messages });
});

export default router;
