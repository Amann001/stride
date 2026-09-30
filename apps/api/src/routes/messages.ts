import { afterSchema, messageSchema, startConversationSchema, type Conversation, type Message } from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { pool } from '../db';

// Private one-to-one messages. You can start a chat with someone if either of you follows
// the other, which keeps strangers from messaging you out of the blue.

const idParams = z.object({ id: z.uuid() });

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: Date | string;
}

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  body: r.body,
  createdAt: new Date(r.created_at).toISOString(),
});

async function isMember(conversationId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId],
  );
  return !!rowCount;
}

// Your conversations, most recent first. `onlyId` narrows it to one.
async function listConversations(userId: string, onlyId?: string): Promise<Conversation[]> {
  const { rows } = await pool.query<{
    id: string; other_id: string; other_name: string; last: MessageRow | null; unread: number;
  }>(
    `SELECT c.id, o.user_id AS other_id, u.name AS other_name,
       (SELECT row_to_json(m) FROM (
          SELECT id, conversation_id, sender_id, body, created_at FROM messages
          WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) m) AS last,
       (SELECT count(*)::int FROM messages m
          WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND m.created_at > me.last_read_at) AS unread
     FROM conversation_members me
     JOIN conversations c ON c.id = me.conversation_id
     JOIN conversation_members o ON o.conversation_id = c.id AND o.user_id <> $1
     JOIN users u ON u.id = o.user_id
     WHERE me.user_id = $1 AND ($2::uuid IS NULL OR c.id = $2)
     ORDER BY c.last_message_at DESC
     LIMIT 100`,
    [userId, onlyId ?? null],
  );
  return rows.map((r) => ({
    id: r.id,
    other: { id: r.other_id, name: r.other_name },
    lastMessage: r.last ? toMessage(r.last) : null,
    unreadCount: r.unread,
  }));
}

export async function messageRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Chats that have at least one message (a chat you opened but never wrote in stays hidden).
  app.get('/conversations', async (req) => (await listConversations(req.user.sub)).filter((c) => c.lastMessage));

  // Open a chat with someone: reuses the existing one if there is one.
  app.post('/conversations', async (req, reply) => {
    const { athleteId } = startConversationSchema.parse(req.body);
    const me = req.user.sub;
    if (athleteId === me) return reply.code(400).send({ error: "You can't message yourself" });

    const existing = await pool.query<{ id: string }>(
      `SELECT a.conversation_id AS id FROM conversation_members a
       JOIN conversation_members b ON b.conversation_id = a.conversation_id AND b.user_id = $2
       WHERE a.user_id = $1 LIMIT 1`,
      [me, athleteId],
    );
    if (existing.rows[0]) return (await listConversations(me, existing.rows[0].id))[0];

    const allowed = await pool.query(
      `SELECT 1 FROM follows WHERE (follower_id = $1 AND followee_id = $2) OR (follower_id = $2 AND followee_id = $1)`,
      [me, athleteId],
    );
    if (!allowed.rowCount) {
      return reply.code(403).send({ error: 'Follow them (or have them follow you) to start a conversation' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ id: string }>('INSERT INTO conversations DEFAULT VALUES RETURNING id');
      await client.query(
        'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
        [rows[0].id, me, athleteId],
      );
      await client.query('COMMIT');
      return reply.code(201).send((await listConversations(me, rows[0].id))[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Messages in a chat, oldest first. With ?after=<time>, only newer ones (for checking
  // for new messages every few seconds). Otherwise, the latest 100.
  app.get('/conversations/:id/messages', async (req, reply): Promise<Message[] | undefined> => {
    const { id } = idParams.parse(req.params);
    const { after } = afterSchema.parse(req.query);
    if (!(await isMember(id, req.user.sub))) return reply.code(404).send({ error: 'Conversation not found' });
    const { rows } = after
      ? await pool.query<MessageRow>(
          'SELECT * FROM messages WHERE conversation_id = $1 AND created_at > $2 ORDER BY created_at LIMIT 200',
          [id, after],
        )
      : await pool.query<MessageRow>(
          `SELECT * FROM (SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 100) m
           ORDER BY created_at`,
          [id],
        );
    return rows.map(toMessage);
  });

  app.post('/conversations/:id/messages', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { body } = messageSchema.parse(req.body);
    if (!(await isMember(id, req.user.sub))) return reply.code(404).send({ error: 'Conversation not found' });
    const { rows } = await pool.query<MessageRow>(
      'INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING *',
      [id, req.user.sub, body],
    );
    await pool.query('UPDATE conversations SET last_message_at = $2 WHERE id = $1', [id, rows[0].created_at]);
    // Your own message counts as read.
    await pool.query('UPDATE conversation_members SET last_read_at = $3 WHERE conversation_id = $1 AND user_id = $2',
      [id, req.user.sub, rows[0].created_at]);
    return reply.code(201).send(toMessage(rows[0]));
  });

  app.post('/conversations/:id/read', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await pool.query(
      'UPDATE conversation_members SET last_read_at = clock_timestamp() WHERE conversation_id = $1 AND user_id = $2',
      [id, req.user.sub],
    );
    return reply.code(204).send();
  });
}
