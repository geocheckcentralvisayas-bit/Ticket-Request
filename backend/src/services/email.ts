import '../utils/secrets.js';
import nodemailer, { type Transporter } from 'nodemailer';
import { getDb } from '../utils/db.js';
import { EmailTemplate, SendEmailRequest } from '@envis/shared';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'ENVIS Ticket System <noreply@envis.gov.ph>';

let transporter: Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendEmail(request: SendEmailRequest): Promise<{ success: boolean; error?: string; logId?: number }> {
  const db = getDb();
  const { to, cc, subject, body, ticketId, requestId } = request as SendEmailRequest & { requestId?: number };

  const logStmt = db.prepare(`
    INSERT INTO email_logs (ticket_id, request_id, to_emails, cc_emails, subject, body, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `);

  const result = logStmt.run(ticketId || null, requestId || null, to.join(', '), cc?.join(', ') || null, subject, body);
  const logId = Number(result.lastInsertRowid);

  const delivered = await deliverEmailLog(logId, { to, cc, subject, body });
  return { ...delivered, logId };
}

async function deliverEmailLog(
  logId: number,
  message: { to: string[]; cc?: string[]; subject: string; body: string }
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  try {
    await getTransporter().sendMail({
      from: SMTP_FROM,
      to: message.to.join(', '),
      cc: message.cc?.join(', '),
      subject: message.subject,
      html: message.body,
    });

    db.prepare(`
      UPDATE email_logs SET status = 'sent', error_message = NULL, sent_at = datetime('now') WHERE id = ?
    `).run(logId);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    db.prepare(`
      UPDATE email_logs SET status = 'failed', error_message = ? WHERE id = ?
    `).run(errorMessage, logId);

    return { success: false, error: errorMessage };
  }
}

export async function retryEmailLog(logId: number): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  const log = db.prepare('SELECT * FROM email_logs WHERE id = ?').get(logId) as any;

  if (!log) {
    return { success: false, error: 'Email log not found' };
  }

  if (log.status === 'sent') {
    return { success: false, error: 'Email already sent' };
  }

  const to = log.to_emails.split(',').map((email: string) => email.trim()).filter(Boolean);
  const cc = log.cc_emails
    ? log.cc_emails.split(',').map((email: string) => email.trim()).filter(Boolean)
    : undefined;

  return deliverEmailLog(logId, { to, cc, subject: log.subject, body: log.body });
}

export function generateApprovalEmail(ticketNumber: string, ticketTitle: string, accounts: Array<{ username: string; email: string; fullName: string; role: string; division: string; password?: string }>, note?: string): EmailTemplate {
  const accountRows = accounts.map(acc => `
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(acc.fullName)}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(acc.username)}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(acc.email)}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(acc.role)}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(acc.division)}</td>
      ${acc.password ? `<td style="padding: 8px; border: 1px solid #e5e7eb; font-family: monospace; background: #f3f4f6;">${escapeHtml(acc.password)}</td>` : ''}
    </tr>
  `).join('');

  const passwordColumn = accounts[0]?.password ? `
    <th style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">Generated Password</th>
  ` : '';

  const subject = `✅ APPROVED: ${ticketNumber} - ${ticketTitle}`;
  const body = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎫 ENVIS Ticket System</h1>
        <p style="color: #d1fae5; margin: 10px 0 0;">Ticket Approved</p>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #059669; margin-top: 0;">Ticket Approved: ${ticketNumber}</h2>
        <p><strong>Title:</strong> ${escapeHtml(ticketTitle)}</p>
        ${note ? `<p><strong>Approver Note:</strong> ${escapeHtml(note)}</p>` : ''}

        <h3 style="color: #374151; margin-top: 30px;">Approved Accounts</h3>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Full Name</th>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Username</th>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Email</th>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Role</th>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Division</th>
                ${passwordColumn}
              </tr>
            </thead>
            <tbody>
              ${accountRows}
            </tbody>
          </table>
        </div>

        ${accounts[0]?.password ? `
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <strong style="color: #92400e;">⚠️ Important:</strong> The generated passwords above are shown <strong>only once</strong>. Please save them securely. Users should change their password on first login.
        </div>
        ` : ''}

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          This is an automated message from the ENVIS Ticket Request & Account Handler Manager.<br>
          Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `;

  return { subject, body };
}

export function generateRejectionEmail(ticketNumber: string, ticketTitle: string, accounts: Array<{ username: string; fullName: string }>, note?: string): EmailTemplate {
  const accountList = accounts.map(acc => `<li>${escapeHtml(acc.fullName)} (${escapeHtml(acc.username)})</li>`).join('');

  const subject = `❌ REJECTED: ${ticketNumber} - ${ticketTitle}`;
  const body = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎫 ENVIS Ticket System</h1>
        <p style="color: #fee2e2; margin: 10px 0 0;">Ticket Rejected</p>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #dc2626; margin-top: 0;">Ticket Rejected: ${ticketNumber}</h2>
        <p><strong>Title:</strong> ${escapeHtml(ticketTitle)}</p>
        ${note ? `<p><strong>Rejection Reason:</strong> ${escapeHtml(note)}</p>` : ''}

        <h3 style="color: #374151; margin-top: 30px;">Rejected Accounts</h3>
        <ul style="padding-left: 20px;">
          ${accountList}
        </ul>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          This is an automated message from the ENVIS Ticket Request & Account Handler Manager.<br>
          Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `;

  return { subject, body };
}

export function generateCredentialEmail(ticketNumber: string, ticketTitle: string, accounts: Array<{ username: string; email: string; fullName: string; role: string; division: string; password: string }>): EmailTemplate {
  const accountRows = accounts.map(acc => `
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(acc.fullName)}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(acc.username)}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(acc.email)}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(acc.role)}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(acc.division)}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; font-family: monospace; background: #f3f4f6;">${escapeHtml(acc.password)}</td>
    </tr>
  `).join('');

  const subject = `🔐 Credentials: ${ticketNumber} - ${ticketTitle}`;
  const body = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎫 ENVIS Ticket System</h1>
        <p style="color: #bfdbfe; margin: 10px 0 0;">Account Credentials Delivered</p>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #2563eb; margin-top: 0;">Account Credentials for ${ticketNumber}</h2>
        <p><strong>Title:</strong> ${escapeHtml(ticketTitle)}</p>

        <h3 style="color: #374151; margin-top: 30px;">Provisioned Accounts</h3>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Full Name</th>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Username</th>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Email</th>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Role</th>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Division</th>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Password</th>
              </tr>
            </thead>
            <tbody>
              ${accountRows}
            </tbody>
          </table>
        </div>

        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <strong style="color: #92400e;">⚠️ Security Notice:</strong> These credentials are shown <strong>only once</strong>. Please:<br>
          1. Save them securely immediately<br>
          2. Share with the respective users via secure channel<br>
          3. Instruct users to change password on first login<br>
          4. Delete this email after distribution
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          This is an automated message from the ENVIS Ticket Request & Account Handler Manager.<br>
          Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `;

  return { subject, body };
}

export function generateStatusChangeEmail(ticketNumber: string, ticketTitle: string, oldStatus: string, newStatus: string, note?: string): EmailTemplate {
  const statusColors: Record<string, string> = {
    'Open': '#22c55e',
    'In Review': '#eab308',
    'Approved': '#3b82f6',
    'Rejected': '#ef4444',
    'Closed': '#6b7280',
  };

  const newColor = statusColors[newStatus] || '#6b7280';

  const subject = `📋 Status Update: ${ticketNumber} - ${ticketTitle}`;
  const body = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${newColor} 0%, ${newColor}dd 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎫 ENVIS Ticket System</h1>
        <p style="color: white; margin: 10px 0 0;">Ticket Status Updated</p>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: ${newColor}; margin-top: 0;">Status Changed: ${ticketNumber}</h2>
        <p><strong>Title:</strong> ${escapeHtml(ticketTitle)}</p>
        <p><strong>Previous Status:</strong> <span style="background: ${statusColors[oldStatus] || '#6b7280'}22; color: ${statusColors[oldStatus] || '#6b7280'}; padding: 4px 12px; border-radius: 9999px;">${oldStatus}</span></p>
        <p><strong>New Status:</strong> <span style="background: ${newColor}22; color: ${newColor}; padding: 4px 12px; border-radius: 9999px;">${newStatus}</span></p>
        ${note ? `<p><strong>Note:</strong> ${escapeHtml(note)}</p>` : ''}

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          This is an automated message from the ENVIS Ticket Request & Account Handler Manager.<br>
          Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `;

  return { subject, body };
}

export function generateAccessRequestAckEmail(refNumber: string, fullName: string, subject: string): EmailTemplate {
  const subj = `📥 Received: ${refNumber} - ${escapeHtml(subject)}`;
  const body = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 700px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">ENVIS Ticket & Account Handler</h1>
        <p style="color: #dbeafe; margin: 8px 0 0;">Access Request Received</p>
      </div>
      <div style="background: #f9fafb; padding: 28px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p>Hello <strong>${escapeHtml(fullName)}</strong>,</p>
        <p>We have received your request. Please keep your reference number for follow-up:</p>
        <div style="background:#fff;border:1px dashed #93c5fd;border-radius:8px;padding:14px;text-align:center;margin:16px 0;">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">Reference Number</div>
          <div style="font-size:22px;font-weight:700;color:#1d4ed8;font-family:ui-monospace,monospace;">${escapeHtml(refNumber)}</div>
        </div>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p style="color:#4b5563;">Our team will review your request and contact you at this email address. You can also check your request status on the ENVIS request portal using your reference number and email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#6b7280;font-size:13px;margin:0;">This is an automated message from ENVIS Region VII Ticket Request & Account Handler Manager.</p>
      </div>
    </body>
    </html>`;
  return { subject: subj, body };
}

export function generateAccessRequestReplyEmail(refNumber: string, fullName: string, subject: string, message: string, senderName?: string): EmailTemplate {
  const subj = subject.startsWith('Re:') ? subject : `Re: ${refNumber} - ${subject}`;
  const body = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 700px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">ENVIS Ticket & Account Handler</h1>
        <p style="color: #ccfbf1; margin: 8px 0 0;">Message regarding ${escapeHtml(refNumber)}</p>
      </div>
      <div style="background: #f9fafb; padding: 28px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p>Hello <strong>${escapeHtml(fullName)}</strong>,</p>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;white-space:pre-wrap;">${escapeHtml(message)}</div>
        ${senderName ? `<p style="margin-top:16px;color:#374151;">Regards,<br><strong>${escapeHtml(senderName)}</strong><br>ENVIS Region VII</p>` : ''}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#6b7280;font-size:13px;margin:0;">Reference: ${escapeHtml(refNumber)}. This message was sent via the ENVIS Ticket Request & Account Handler Manager.</p>
      </div>
    </body>
    </html>`;
  return { subject: subj, body };
}

export async function testEmailConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    await getTransporter().verify();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}