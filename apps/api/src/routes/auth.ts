import {
  deleteAccountSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  type AuthResponse,
  type User,
} from '@repo/shared';
import type { FastifyInstance } from 'fastify';

import { pool } from '../db';
import { hashPassword, verifyPassword } from '../passwords';

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  bio: string | null;
  location: string | null;
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

// Per visitor (IP address): stops someone trying thousands of passwords on an account,
// while a person who mistypes a few times is never blocked for long.
const LOGIN_LIMIT = { max: 10, timeWindow: '15 minutes' };
const SIGNUP_LIMIT = { max: 5, timeWindow: '1 hour' };

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', { config: { rateLimit: SIGNUP_LIMIT } }, async (req, reply) => {
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
    const user = toUser(rows[0]);
    const body: AuthResponse = { token: app.jwt.sign({ sub: user.id }), user };
    return reply.code(201).send(body);
  });

  app.post('/auth/login', { config: { rateLimit: LOGIN_LIMIT } }, async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [input.email]);
    const row = rows[0];
    // Same message either way, so nobody can find out which emails have accounts.
    if (!row || !(await verifyPassword(input.password, row.password_hash))) {
      return reply.code(401).send({ error: 'Wrong email or password' });
    }
    const user = toUser(row);
    const body: AuthResponse = { token: app.jwt.sign({ sub: user.id }), user };
    return body;
  });

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

  // Delete your account and everything in it (activities, routes, follows, kudos, comments,
  // messages, clubs you created). Needs your password, so nobody can do it from an unlocked
  // phone by accident. This cannot be undone.
  app.delete('/me', { onRequest: [app.authenticate], config: { rateLimit: LOGIN_LIMIT } }, async (req, reply) => {
    const { password } = deleteAccountSchema.parse(req.body);
    const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
      return reply.code(403).send({ error: 'That password is not right' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.sub]);
    return reply.code(204).send();
  });
}
