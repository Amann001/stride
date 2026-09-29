import { loginSchema, registerSchema, type AuthResponse, type User } from '@repo/shared';
import type { FastifyInstance } from 'fastify';

import { pool } from '../db';
import { hashPassword, verifyPassword } from '../passwords';

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: Date;
}

export function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at.toISOString() };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (req, reply) => {
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

  app.post('/auth/login', async (req, reply) => {
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
}
