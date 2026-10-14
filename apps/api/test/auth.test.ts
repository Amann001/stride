import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { call, createUser, manualActivity, PASSWORD, startApp, uniqueEmail, type TestUser } from './helpers';

// A pretend mailbox: emails are captured here instead of being sent.
const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; text: string }[] }));
vi.mock('../src/mailer', () => ({
  mailConfigured: () => true,
  sendMail: async (to: string, subject: string, text: string) => {
    mail.sent.push({ to, subject, text });
  },
}));
const lastCode = (to: string) => {
  const m = [...mail.sent].reverse().find((e) => e.to === to);
  return m?.text.match(/\b(\d{6})\b/)?.[1] ?? null;
};

let app: FastifyInstance;
beforeAll(async () => {
  app = await startApp();
});
afterAll(() => app.close());
beforeEach(() => {
  mail.sent.length = 0;
});

// Each sign-up comes from its own address, so the sign-up limit (5 an hour) isn't hit.
let ip = 1;
const fromNewAddress = () => ({ remoteAddress: `10.0.0.${ip++}` });

describe('sign up and log in', () => {
  it('creates an account and its login token works', async () => {
    const email = uniqueEmail('Asha');
    const res = await call(app, null, 'POST', '/auth/register', { name: 'Asha', email, password: PASSWORD }, fromNewAddress());
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Asha', email });
    expect(res.body.user).not.toHaveProperty('password_hash');

    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${res.body.token}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe(email);
  });

  it('stores emails in lowercase and refuses a second account with the same email', async () => {
    const email = uniqueEmail('Dup');
    const first = await call(app, null, 'POST', '/auth/register', { name: 'A', email: email.toUpperCase(), password: PASSWORD }, fromNewAddress());
    expect(first.body.user.email).toBe(email);
    const second = await call(app, null, 'POST', '/auth/register', { name: 'B', email, password: PASSWORD }, fromNewAddress());
    expect(second.status).toBe(409);
  });

  it('rejects short passwords and bad emails with a clear message', async () => {
    const short = await call(app, null, 'POST', '/auth/register', { name: 'A', email: uniqueEmail('x'), password: 'short' }, fromNewAddress());
    expect(short.status).toBe(400);
    expect(short.body.error).toMatch(/at least 8/);
    const bad = await call(app, null, 'POST', '/auth/register', { name: 'A', email: 'not-an-email', password: PASSWORD }, fromNewAddress());
    expect(bad.status).toBe(400);
  });

  it('logs in with the right password, and gives the same answer for a wrong password or unknown email', async () => {
    const user = await createUser(app, 'Login');
    const ok = await call(app, null, 'POST', '/auth/login', { email: user.email.toUpperCase(), password: PASSWORD }, fromNewAddress());
    expect(ok.status).toBe(200);
    expect(ok.body.user.id).toBe(user.id);

    const wrong = await call(app, null, 'POST', '/auth/login', { email: user.email, password: 'wrong-password' }, fromNewAddress());
    const unknown = await call(app, null, 'POST', '/auth/login', { email: uniqueEmail('nobody'), password: PASSWORD }, fromNewAddress());
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('slows down password guessing: the 11th login try in 15 minutes is refused', async () => {
    const user = await createUser(app, 'Guess');
    const address = { remoteAddress: '10.9.9.9' };
    for (let i = 0; i < 10; i++) {
      expect((await call(app, null, 'POST', '/auth/login', { email: user.email, password: 'nope-nope' }, address)).status).toBe(401);
    }
    expect((await call(app, null, 'POST', '/auth/login', { email: user.email, password: PASSWORD }, address)).status).toBe(429);
  });

  it('needs a valid login for private pages', async () => {
    expect((await call(app, null, 'GET', '/me')).status).toBe(401);
    const fake = { id: 'x', name: 'x', email: 'x', token: 'not-a-token' };
    expect((await call(app, fake, 'GET', '/me')).status).toBe(401);
  });
});

describe('the web app (browsers)', () => {
  it('lets browsers edit and delete, not only read and create', async () => {
    // A browser asks first ("preflight") before PATCH, PUT or DELETE from another address.
    for (const method of ['PATCH', 'PUT', 'DELETE']) {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/me',
        headers: {
          origin: 'https://stride-amanswamy.vercel.app',
          'access-control-request-method': method,
          'access-control-request-headers': 'authorization,content-type',
        },
      });
      expect(res.statusCode).toBe(204);
      expect(String(res.headers['access-control-allow-methods'])).toContain(method);
    }
  });
});

describe('your account', () => {
  it('edits the profile, and empty text clears bio and location', async () => {
    const user = await createUser(app, 'Profile');
    const set = await call(app, user, 'PATCH', '/me', { name: 'New Name', bio: 'Runner', location: 'Pune' });
    expect(set.body).toMatchObject({ name: 'New Name', bio: 'Runner', location: 'Pune' });
    const cleared = await call(app, user, 'PATCH', '/me', { name: 'New Name', bio: '', location: '' });
    expect(cleared.body).toMatchObject({ bio: null, location: null });
  });

  it('changing the password logs out every other phone', async () => {
    const user = await createUser(app, 'Changer');
    expect((await call(app, user, 'POST', '/me/password', { currentPassword: 'wrong', newPassword: 'another-password' })).status).toBe(403);

    const res = await call(app, user, 'POST', '/me/password', { currentPassword: PASSWORD, newPassword: 'another-password' });
    expect(res.status).toBe(200);
    // The old login no longer works; the fresh one does.
    expect((await call(app, user, 'GET', '/me')).status).toBe(401);
    expect((await call(app, { ...user, token: res.body.token }, 'GET', '/me')).status).toBe(200);
    // And the new password logs in.
    const login = await call(app, null, 'POST', '/auth/login', { email: user.email, password: 'another-password' }, fromNewAddress());
    expect(login.status).toBe(200);
  });

  it('deleting the account needs the password and erases its data', async () => {
    const user = await createUser(app, 'Leaver');
    const activity = await manualActivity(app, user, { km: 5 });
    expect((await call(app, user, 'DELETE', '/me', { password: 'wrong' })).status).toBe(403);
    expect((await call(app, user, 'DELETE', '/me', { password: PASSWORD })).status).toBe(204);

    expect((await call(app, user, 'GET', '/me')).status).toBe(401);
    const other = await createUser(app, 'Viewer');
    expect((await call(app, other, 'GET', `/activities/${activity.id}`)).status).toBe(404);
  });
});

describe('forgot password', () => {
  it('emails a code, and the code sets a new password and logs out other phones', async () => {
    const user = await createUser(app, 'Forgetful');
    expect((await call(app, null, 'POST', '/auth/forgot-password', { email: user.email }, fromNewAddress())).status).toBe(200);
    const code = lastCode(user.email);
    expect(code).toMatch(/^\d{6}$/);

    const wrongCode = code === '000000' ? '111111' : '000000';
    const wrong = await call(app, null, 'POST', '/auth/reset-password', { email: user.email, code: wrongCode, newPassword: 'brand-new-pass' }, fromNewAddress());
    expect(wrong.status).toBe(400);

    const ok = await call(app, null, 'POST', '/auth/reset-password', { email: user.email, code, newPassword: 'brand-new-pass' }, fromNewAddress());
    expect(ok.status).toBe(200);
    expect((await call(app, user, 'GET', '/me')).status).toBe(401);
    // A code only works once.
    const again = await call(app, null, 'POST', '/auth/reset-password', { email: user.email, code, newPassword: 'third-password' }, fromNewAddress());
    expect(again.status).toBe(400);
  });

  it("answers the same for an email with no account, so it can't reveal who uses the app", async () => {
    const res = await call(app, null, 'POST', '/auth/forgot-password', { email: uniqueEmail('ghost') }, fromNewAddress());
    expect(res.status).toBe(200);
    expect(mail.sent).toHaveLength(0);
  });

  it('locks the code after 5 wrong tries', async () => {
    const user = await createUser(app, 'Locked');
    await call(app, null, 'POST', '/auth/forgot-password', { email: user.email }, fromNewAddress());
    const code = lastCode(user.email)!;
    const wrongCode = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
    const address = fromNewAddress();
    for (let i = 0; i < 5; i++) {
      await call(app, null, 'POST', '/auth/reset-password', { email: user.email, code: wrongCode, newPassword: 'brand-new-pass' }, address);
    }
    const right = await call(app, null, 'POST', '/auth/reset-password', { email: user.email, code, newPassword: 'brand-new-pass' }, address);
    expect(right.status).toBe(400);
  });
});

describe('change email', () => {
  let user: TestUser;
  beforeEach(async () => {
    user = await createUser(app, 'Mover');
  });

  it('sends a code to the new address, switches email, logs out other phones and tells the old address', async () => {
    const newEmail = uniqueEmail('moved');
    expect((await call(app, user, 'POST', '/me/email', { newEmail, password: 'wrong' })).status).toBe(403);
    expect((await call(app, user, 'POST', '/me/email', { newEmail, password: PASSWORD })).status).toBe(200);
    const code = lastCode(newEmail);
    expect(code).toMatch(/^\d{6}$/);

    const ok = await call(app, user, 'POST', '/me/email/confirm', { code });
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe(newEmail);
    expect((await call(app, user, 'GET', '/me')).status).toBe(401);
    expect(mail.sent.some((m) => m.to === user.email && /was changed/.test(m.subject))).toBe(true);
  });

  it("won't take an email that another account uses", async () => {
    const other = await createUser(app, 'Taken');
    const res = await call(app, user, 'POST', '/me/email', { newEmail: other.email, password: PASSWORD });
    expect(res.status).toBe(409);
  });

  it('rejects a wrong code', async () => {
    await call(app, user, 'POST', '/me/email', { newEmail: uniqueEmail('moved'), password: PASSWORD });
    const res = await call(app, user, 'POST', '/me/email/confirm', { code: '999999' === lastCode('x') ? '888888' : '999999' });
    expect(res.status).toBe(400);
    expect((await call(app, user, 'GET', '/me')).body.email).toBe(user.email);
  });
});
