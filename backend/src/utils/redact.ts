/**
 * Removes sensitive values from any text that is returned to a client or
 * written to a log. Provider errors can sometimes echo configuration, so this
 * is applied defensively at the edges of the API.
 */
const SENSITIVE_KEYS = ['SMTP_PASS', 'SMTP_USER', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

export function redactSecrets(input: unknown, maxLength = 500): string {
  if (input === undefined || input === null) return 'Unknown error';
  let text = typeof input === 'string' ? input : String((input as Error)?.message ?? input);

  for (const key of SENSITIVE_KEYS) {
    const value = process.env[key];
    if (value && value.length >= 4) {
      text = text.split(value).join('[redacted]');
    }
  }

  // Gmail-style app passwords rendered with spaces.
  text = text.replace(/\b[A-Za-z0-9]{4}(?: [A-Za-z0-9]{4}){3}\b/g, '[redacted]');
  // Long bearer tokens / raw JWT fragments.
  text = text.replace(/eyJ[A-Za-z0-9._-]{20,}/g, '[redacted]');
  text = text.replace(/Bearer\s+[A-Za-z0-9._-]{20,}/gi, 'Bearer [redacted]');

  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
