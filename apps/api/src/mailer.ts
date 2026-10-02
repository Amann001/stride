import { createTransport, type Transporter } from 'nodemailer';

// Sends emails (password reset codes). Uses any SMTP mail service, set up with these
// server settings (on Render):
//   SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, MAIL_FROM (e.g. "Stride <you@example.com>")
// Free choices: Brevo's free plan, or a dedicated Gmail with an app password.
// Until these are set, password reset says it isn't available, and nothing else is affected.

export function mailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);
}

let transport: Transporter | null = null;

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  transport ??= createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
}
