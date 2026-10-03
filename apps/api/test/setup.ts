import { inject, vi } from 'vitest';

// Runs before each test file, before any app code is loaded.

const databaseUrl = inject('databaseUrl');
// Safety net: tests may only ever talk to the throwaway database on this computer.
if (!/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\//.test(databaseUrl)) {
  throw new Error(`Refusing to run tests against ${databaseUrl}`);
}
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = 'test-only-secret';
for (const key of ['MAIL_FROM', 'BREVO_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'CONTACT_EMAIL']) delete process.env[key];

// No real network calls: map and elevation services answer with an error, as if offline.
vi.stubGlobal('fetch', async () => {
  throw new Error('Network is switched off in tests');
});
