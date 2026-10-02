import { createTransport, type Transporter } from 'nodemailer';

import { pool } from './db';

// Sends emails (password reset codes). Two ways, set up with server settings (on Render):
//
// 1. Brevo's web API (free, 300 emails a day): BREVO_API_KEY and MAIL_FROM.
//    Use this on Render's free plan, which blocks the normal email (SMTP) ports.
// 2. Any SMTP mail service: SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS and MAIL_FROM.
//    Works on paid hosting.
//
// MAIL_FROM looks like "Stride <stride.supportteam@gmail.com>". Until one of these is set,
// password reset says it isn't available, and nothing else is affected.

const useBrevo = () => !!process.env.BREVO_API_KEY;
const useSmtp = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export function mailConfigured(): boolean {
  return !!process.env.MAIL_FROM && (useBrevo() || useSmtp());
}

// "Stride <a@b.com>" -> { name: 'Stride', email: 'a@b.com' }
function sender(): { name?: string; email: string } {
  const from = process.env.MAIL_FROM ?? '';
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return match ? { name: match[1] || undefined, email: match[2] } : { email: from.trim() };
}

async function sendWithBrevo(to: string, subject: string, text: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: sender(), to: [{ email: to }], subject, textContent: text }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Brevo answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

let transport: Transporter | null = null;

async function sendWithSmtp(to: string, subject: string, text: string) {
  transport ??= createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15_000,
  });
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  try {
    if (useBrevo()) await sendWithBrevo(to, subject, text);
    else await sendWithSmtp(to, subject, text);
  } catch (err) {
    // Saved so it shows up in `npm run ops` (the address isn't saved, just what went wrong).
    const message = `Email not sent (${useBrevo() ? 'Brevo' : 'SMTP'}): ${err instanceof Error ? err.message : String(err)}`;
    await pool
      .query("INSERT INTO error_reports (source, message, context) VALUES ('server', $1, $2)", [
        message.slice(0, 2000),
        { kind: 'email' },
      ])
      .catch(() => {});
    throw err;
  }
}
