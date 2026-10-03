import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import {
  changeEmailConfirmSchema,
  changeEmailStartSchema,
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  pushTokenSchema,
  removePushTokenSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  type AuthResponse,
  type User,
} from '@repo/shared';
import type { FastifyInstance } from 'fastify';

import { config } from '../config';
import { pool } from '../db';
import { mailConfigured, sendMail } from '../mailer';
import { hashPassword, verifyPassword } from '../passwords';
import { LIMITS } from '../rate-limits';

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  bio: string | null;
  location: string | null;
  token_version: number;
  created_at: Date;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    bio: row.bio ?? null,
    location: row.location ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

// Reset codes: 6 digits, valid 15 minutes, 5 wrong tries, stored only as a keyed hash.
const RESET_CODE_MINUTES = 15;
const RESET_MAX_ATTEMPTS = 5;
const hashCode = (userId: string, code: string) =>
  createHmac('sha256', config.jwtSecret).update(`${userId}:${code}`).digest('hex');

export async function authRoutes(app: FastifyInstance) {
  // A login token for this account, at its current version.
  const tokenFor = (row: UserRow) => app.jwt.sign({ sub: row.id, tv: row.token_version });
  const respond = (row: UserRow): AuthResponse => ({ token: tokenFor(row), user: toUser(row) });

  app.post('/auth/register', { config: { rateLimit: LIMITS.signup } }, async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const passwordHash = await hashPassword(input.password);
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING *`,
      [input.email, input.name, passwordHash],
    );
    if (rows.length === 0) {
      return reply.code(409).send({ error: 'An account with this email already exists' });
    }
    return reply.code(201).send(respond(rows[0]));
  });

  app.post('/auth/login', { config: { rateLimit: LIMITS.login } }, async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [input.email]);
    const row = rows[0];
    // Same message either way, so nobody can find out which emails have accounts.
    if (!row || !(await verifyPassword(input.password, row.password_hash))) {
      return reply.code(401).send({ error: 'Wrong email or password' });
    }
    return respond(row);
  });

  // ---------- Forgot password ----------

  // Step 1: email a 6-digit code. The answer is the same whether or not the email has an
  // account, so this can't be used to find out who uses Stride.
  app.post('/auth/forgot-password', { config: { rateLimit: LIMITS.passwordReset } }, async (req, reply) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    if (!mailConfigured()) {
      return reply.code(503).send({ error: "Password reset by email isn't available yet. Please try again later." });
    }
    const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
    const row = rows[0];
    if (row) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await pool.query(
        `INSERT INTO password_resets (user_id, code_hash, expires_at, attempts)
         VALUES ($1, $2, now() + make_interval(mins => $3), 0)
         ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
           attempts = 0, created_at = now()`,
        [row.id, hashCode(row.id, code), RESET_CODE_MINUTES],
      );
      // Sent in the background: waiting for it would make the reply slower only for emails
      // that have an account, which would give away who uses Stride.
      sendMail(
        row.email,
        `Your Stride code: ${code}`,
        `Hi ${row.name},\n\nYour code to reset your Stride password is ${code}.\n` +
          `It works for ${RESET_CODE_MINUTES} minutes.\n\n` +
          "If you didn't ask for this, you can ignore this email. Your password won't change.",
      ).catch((err) => req.log.error(err, 'could not send reset email'));
    }
    return { ok: true };
  });

  // Step 2: the code plus a new password. Logs you in, and logs out every other phone.
  app.post('/auth/reset-password', { config: { rateLimit: LIMITS.passwordResetCode } }, async (req, reply) => {
    const { email, code, newPassword } = resetPasswordSchema.parse(req.body);
    const wrong = () => reply.code(400).send({ error: 'That code is wrong or has expired. Ask for a new one.' });
    const { rows } = await pool.query<UserRow & { code_hash: string; expires_at: Date; attempts: number }>(
      `SELECT u.*, r.code_hash, r.expires_at, r.attempts
       FROM users u JOIN password_resets r ON r.user_id = u.id WHERE u.email = $1`,
      [email],
    );
    const row = rows[0];
    if (!row || row.expires_at.getTime() < Date.now() || row.attempts >= RESET_MAX_ATTEMPTS) return wrong();
    const given = Buffer.from(hashCode(row.id, code));
    const expected = Buffer.from(row.code_hash);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      await pool.query('UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = $1', [row.id]);
      return wrong();
    }
    const { rows: updated } = await pool.query<UserRow>(
      'UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1 RETURNING *',
      [row.id, await hashPassword(newPassword)],
    );
    await pool.query('DELETE FROM password_resets WHERE user_id = $1', [row.id]);
    return respond(updated[0]);
  });

  // ---------- Your account ----------

  app.get('/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    if (!rows[0]) return reply.code(404).send({ error: 'User not found' });
    return toUser(rows[0]);
  });

  // Edit profile: name, and optionally bio and location (empty text clears them).
  app.patch('/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { name, bio, location } = updateProfileSchema.parse(req.body);
    const { rows } = await pool.query<UserRow>(
      `UPDATE users SET name = $2,
         bio = CASE WHEN $3::boolean THEN nullif($4, '') ELSE bio END,
         location = CASE WHEN $5::boolean THEN nullif($6, '') ELSE location END
       WHERE id = $1 RETURNING *`,
      [req.user.sub, name, bio !== undefined, bio ?? null, location !== undefined, location ?? null],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'User not found' });
    return toUser(rows[0]);
  });

  // Change your password. Every other phone signed in to your account is logged out; this
  // one gets a fresh login token so you stay signed in here.
  app.post('/me/password', { onRequest: [app.authenticate], config: { rateLimit: LIMITS.login } }, async (req, reply) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
      return reply.code(403).send({ error: 'Your current password is not right' });
    }
    const { rows: updated } = await pool.query<UserRow>(
      'UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1 RETURNING *',
      [req.user.sub, await hashPassword(newPassword)],
    );
    await pool.query('DELETE FROM password_resets WHERE user_id = $1', [req.user.sub]);
    return respond(updated[0]);
  });

  // ---------- Push notifications ----------

  // This phone wants push notifications for the logged-in account. A phone belongs to whoever
  // logged in on it last, so the token moves over if someone else used it before.
  app.put('/me/push-token', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { token, platform } = pushTokenSchema.parse(req.body);
    await pool.query(
      `INSERT INTO push_tokens (token, user_id, platform) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = now()`,
      [token, req.user.sub, platform],
    );
    return reply.code(204).send();
  });

  // Logging out on this phone: stop pushing to it.
  app.delete('/me/push-token', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { token } = removePushTokenSchema.parse(req.body);
    await pool.query('DELETE FROM push_tokens WHERE token = $1 AND user_id = $2', [token, req.user.sub]);
    return reply.code(204).send();
  });

  // ---------- Change email ----------

  // Step 1: your password and the new address. A 6-digit code goes to the NEW address,
  // proving it's yours before anything changes.
  app.post('/me/email', { onRequest: [app.authenticate], config: { rateLimit: LIMITS.emailChange } }, async (req, reply) => {
    const { newEmail, password } = changeEmailStartSchema.parse(req.body);
    if (!mailConfigured()) {
      return reply.code(503).send({ error: "Changing your email isn't available yet. Please try again later." });
    }
    const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    const me = rows[0];
    if (!me || !(await verifyPassword(password, me.password_hash))) {
      return reply.code(403).send({ error: 'That password is not right' });
    }
    if (newEmail === me.email) return reply.code(400).send({ error: "That's already your email" });
    const taken = await pool.query('SELECT 1 FROM users WHERE email = $1', [newEmail]);
    if (taken.rowCount) return reply.code(409).send({ error: 'An account with this email already exists' });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await pool.query(
      `INSERT INTO email_changes (user_id, new_email, code_hash, expires_at, attempts)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4), 0)
       ON CONFLICT (user_id) DO UPDATE SET new_email = EXCLUDED.new_email, code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at, attempts = 0, created_at = now()`,
      [me.id, newEmail, hashCode(`email:${me.id}`, code), RESET_CODE_MINUTES],
    );
    try {
      await sendMail(
        newEmail,
        `Your Stride code: ${code}`,
        `Hi ${me.name},\n\nYour code to use this email address for Stride is ${code}.\n` +
          `It works for ${RESET_CODE_MINUTES} minutes.\n\n` +
          "If you didn't ask for this, you can ignore this email. Nothing will change.",
      );
    } catch {
      return reply.code(503).send({ error: "We couldn't send the email right now. Please try again later." });
    }
    return { ok: true };
  });

  // Step 2: the code from the new address. Switches the email, logs out every other phone
  // (this one gets a fresh login), and lets the old address know, in case it wasn't you.
  app.post('/me/email/confirm', { onRequest: [app.authenticate], config: { rateLimit: LIMITS.emailChangeCode } }, async (req, reply) => {
    const { code } = changeEmailConfirmSchema.parse(req.body);
    const wrong = () => reply.code(400).send({ error: 'That code is wrong or has expired. Ask for a new one.' });
    const { rows } = await pool.query<{ new_email: string; code_hash: string; expires_at: Date; attempts: number }>(
      'SELECT new_email, code_hash, expires_at, attempts FROM email_changes WHERE user_id = $1',
      [req.user.sub],
    );
    const pending = rows[0];
    if (!pending || pending.expires_at.getTime() < Date.now() || pending.attempts >= RESET_MAX_ATTEMPTS) return wrong();
    const given = Buffer.from(hashCode(`email:${req.user.sub}`, code));
    const expected = Buffer.from(pending.code_hash);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      await pool.query('UPDATE email_changes SET attempts = attempts + 1 WHERE user_id = $1', [req.user.sub]);
      return wrong();
    }
    const { rows: before } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    let updated: UserRow[];
    try {
      ({ rows: updated } = await pool.query<UserRow>(
        'UPDATE users SET email = $2, token_version = token_version + 1 WHERE id = $1 RETURNING *',
        [req.user.sub, pending.new_email],
      ));
    } catch (err) {
      // Someone signed up with that address in the meantime.
      if ((err as { code?: string }).code === '23505') {
        return reply.code(409).send({ error: 'An account with this email already exists' });
      }
      throw err;
    }
    await pool.query('DELETE FROM email_changes WHERE user_id = $1', [req.user.sub]);
    const old = before[0];
    if (old) {
      sendMail(
        old.email,
        'Your Stride email was changed',
        `Hi ${old.name},\n\nThe email for your Stride account was just changed to ${pending.new_email}.\n\n` +
          `If this wasn't you, reply to this email or write to ${process.env.CONTACT_EMAIL ?? 'us'} straight away.`,
      ).catch(() => {});
    }
    return respond(updated[0]);
  });

  // Delete your account and everything in it (activities, routes, follows, kudos, comments,
  // messages, clubs you created). Needs your password, so nobody can do it from an unlocked
  // phone by accident. This cannot be undone.
  app.delete('/me', { onRequest: [app.authenticate], config: { rateLimit: LIMITS.login } }, async (req, reply) => {
    const { password } = deleteAccountSchema.parse(req.body);
    const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
      return reply.code(403).send({ error: 'That password is not right' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.sub]);
    return reply.code(204).send();
  });
}
