import {
  athleteSearchSchema,
  beforeSchema,
  commentSchema,
  followAllSchema,
  reportSchema,
  type ActivitySummary,
  type AthleteProfile,
  type AthleteRef,
  type AthleteSummary,
  type Badges,
  type Comment,
  type Notification,
  type NotificationKind,
} from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { canSee, findActivity, noBlockBetween, selectActivities, toSummary, type ActivityRow } from '../activity-sql';
import { pool } from '../db';
import { LIMITS } from '../rate-limits';

const idParams = z.object({ id: z.uuid() });
const PAGE = 30;

// Columns for a person in a list, as seen by `$1` (the logged-in user).
const ATHLETE_COLUMNS = `u.id, u.name, u.location,
  EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = u.id) AS is_following,
  EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followee_id = $1) AS follows_you`;

interface AthleteRow {
  id: string;
  name: string;
  location: string | null;
  is_following: boolean;
  follows_you: boolean;
}

const toAthlete = (r: AthleteRow, reason?: string): AthleteSummary => ({
  id: r.id,
  name: r.name,
  location: r.location,
  isFollowing: r.is_following,
  followsYou: r.follows_you,
  ...(reason ? { reason } : {}),
});

// Adds a notification for `userId` (never for your own actions).
async function notify(userId: string, actorId: string, kind: NotificationKind, activityId: string | null = null, commentId: string | null = null) {
  if (userId === actorId) return;
  await pool.query(
    'INSERT INTO notifications (user_id, actor_id, kind, activity_id, comment_id) VALUES ($1, $2, $3, $4, $5)',
    [userId, actorId, kind, activityId, commentId],
  );
}

export async function socialRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // ---------- Feed ----------

  // Home feed: your activities and those of people you follow, newest first.
  // For older ones, pass ?before=<startedAt of the last one you have>.
  app.get('/feed', async (req): Promise<ActivitySummary[]> => {
    const { before } = beforeSchema.parse(req.query);
    const { rows } = await pool.query<ActivityRow>(
      `${selectActivities('$1')}
       WHERE (a.user_id = $1 OR a.user_id IN (SELECT followee_id FROM follows WHERE follower_id = $1))
         AND ${canSee('$1')}
         AND ($2::timestamptz IS NULL OR a.started_at < $2)
       ORDER BY a.started_at DESC LIMIT ${PAGE}`,
      [req.user.sub, before ?? null],
    );
    return rows.map((r) => toSummary(r, req.user.sub));
  });

  // ---------- People ----------

  app.get('/athletes/search', async (req): Promise<AthleteSummary[]> => {
    const { q } = athleteSearchSchema.parse(req.query);
    if (!q) return [];
    // Escape % and _ so they're searched for literally.
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const { rows } = await pool.query<AthleteRow>(
      `SELECT ${ATHLETE_COLUMNS} FROM users u
       WHERE u.id <> $1 AND u.name ILIKE $2 AND ${noBlockBetween('$1', 'u.id')}
       ORDER BY (u.name ILIKE $3) DESC, u.name LIMIT 30`,
      [req.user.sub, pattern, `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`],
    );
    return rows.map((r) => toAthlete(r));
  });

  // "Who to Follow": people who follow you, then friends of friends, then people
  // active on Stride lately. Never people you already follow.
  app.get('/athletes/suggested', async (req): Promise<AthleteSummary[]> => {
    const { rows } = await pool.query<AthleteRow & { mutual: number | null; via: string | null; recent: number }>(
      `WITH mine AS (SELECT followee_id FROM follows WHERE follower_id = $1),
       fof AS (
         SELECT f.followee_id AS id, count(*)::int AS mutual, min(v.name) AS via
         FROM follows f JOIN users v ON v.id = f.follower_id
         WHERE f.follower_id IN (SELECT followee_id FROM mine)
         GROUP BY f.followee_id
       ),
       recent AS (
         SELECT user_id AS id, count(*)::int AS n FROM activities
         WHERE started_at > now() - interval '30 days' AND visibility <> 'only_me'
         GROUP BY user_id
       )
       SELECT ${ATHLETE_COLUMNS}, fof.mutual, fof.via, coalesce(recent.n, 0) AS recent
       FROM users u
       LEFT JOIN fof ON fof.id = u.id
       LEFT JOIN recent ON recent.id = u.id
       WHERE u.id <> $1 AND u.id NOT IN (SELECT followee_id FROM mine) AND ${noBlockBetween('$1', 'u.id')}
       ORDER BY follows_you DESC, fof.mutual DESC NULLS LAST, recent DESC, u.created_at DESC
       LIMIT 15`,
      [req.user.sub],
    );
    return rows.map((r) =>
      toAthlete(
        r,
        r.follows_you
          ? 'Follows you'
          : r.mutual
            ? `Followed by ${r.via}${r.mutual > 1 ? ` and ${r.mutual - 1} more` : ''}`
            : r.recent
              ? `${r.recent} ${r.recent === 1 ? 'activity' : 'activities'} this month`
              : 'New to Stride',
      ),
    );
  });

  app.get('/athletes/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    // Someone who blocked you looks like they don't exist; someone you blocked shows an Unblock option.
    const blockedYou = await pool.query('SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [id, req.user.sub]);
    if (blockedYou.rowCount) return reply.code(404).send({ error: 'Athlete not found' });
    const { rows } = await pool.query<AthleteRow & {
      bio: string | null; followers: number; following: number; activities: number; week: number; year: number;
      blocked_by_you: boolean;
    }>(
      `SELECT ${ATHLETE_COLUMNS}, u.bio,
         EXISTS (SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = u.id) AS blocked_by_you,
         (SELECT count(*)::int FROM follows WHERE followee_id = u.id) AS followers,
         (SELECT count(*)::int FROM follows WHERE follower_id = u.id) AS following,
         (SELECT count(*)::int FROM activities a WHERE a.user_id = u.id AND ${canSee('$1')}) AS activities,
         (SELECT coalesce(sum(a.distance_meters), 0)::float FROM activities a
           WHERE a.user_id = u.id AND ${canSee('$1')} AND a.started_at >= date_trunc('week', now())) AS week,
         (SELECT coalesce(sum(a.distance_meters), 0)::float FROM activities a
           WHERE a.user_id = u.id AND ${canSee('$1')} AND a.started_at >= date_trunc('year', now())) AS year
       FROM users u WHERE u.id = $2`,
      [req.user.sub, id],
    );
    const r = rows[0];
    if (!r) return reply.code(404).send({ error: 'Athlete not found' });
    const profile: AthleteProfile = {
      ...toAthlete(r),
      bio: r.bio,
      followerCount: r.followers,
      followingCount: r.following,
      activityCount: r.activities,
      weekDistanceMeters: r.week,
      yearDistanceMeters: r.year,
      isMe: r.id === req.user.sub,
      blockedByYou: r.blocked_by_you,
    };
    return profile;
  });

  app.get('/athletes/:id/activities', async (req): Promise<ActivitySummary[]> => {
    const { id } = idParams.parse(req.params);
    const { before } = beforeSchema.parse(req.query);
    const { rows } = await pool.query<ActivityRow>(
      `${selectActivities('$1')}
       WHERE a.user_id = $2 AND ${canSee('$1')} AND ($3::timestamptz IS NULL OR a.started_at < $3)
       ORDER BY a.started_at DESC LIMIT ${PAGE}`,
      [req.user.sub, id, before ?? null],
    );
    return rows.map((r) => toSummary(r, req.user.sub));
  });

  for (const list of ['followers', 'following'] as const) {
    app.get(`/athletes/:id/${list}`, async (req): Promise<AthleteSummary[]> => {
      const { id } = idParams.parse(req.params);
      const join = list === 'followers' ? 'f.follower_id = u.id AND f.followee_id = $2' : 'f.followee_id = u.id AND f.follower_id = $2';
      const { rows } = await pool.query<AthleteRow>(
        `SELECT ${ATHLETE_COLUMNS} FROM users u JOIN follows f ON ${join}
         WHERE ${noBlockBetween('$1', 'u.id')} ORDER BY f.created_at DESC LIMIT 200`,
        [req.user.sub, id],
      );
      return rows.map((r) => toAthlete(r));
    });
  }

  // ---------- Following ----------

  app.post('/athletes/:id/follow', { config: { rateLimit: LIMITS.follow } }, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    if (id === req.user.sub) return reply.code(400).send({ error: "You can't follow yourself" });
    const exists = await pool.query(`SELECT 1 FROM users WHERE id = $1 AND ${noBlockBetween('$1', '$2')}`, [id, req.user.sub]);
    if (!exists.rowCount) return reply.code(404).send({ error: 'Athlete not found' });
    const { rowCount } = await pool.query(
      'INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.sub, id],
    );
    if (rowCount) await notify(id, req.user.sub, 'follow');
    return reply.code(204).send();
  });

  app.delete('/athletes/:id/follow', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await pool.query('DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2', [req.user.sub, id]);
    await pool.query("DELETE FROM notifications WHERE user_id = $1 AND actor_id = $2 AND kind = 'follow'", [id, req.user.sub]);
    return reply.code(204).send();
  });

  // "Follow All" on the suggestions list.
  app.post('/athletes/follow-all', { config: { rateLimit: LIMITS.followAll } }, async (req, reply) => {
    const { ids } = followAllSchema.parse(req.body);
    const { rows } = await pool.query<{ followee_id: string }>(
      `INSERT INTO follows (follower_id, followee_id)
       SELECT $1, u.id FROM users u WHERE u.id = ANY($2::uuid[]) AND u.id <> $1 AND ${noBlockBetween('$1', 'u.id')}
       ON CONFLICT DO NOTHING RETURNING followee_id`,
      [req.user.sub, ids],
    );
    for (const r of rows) await notify(r.followee_id, req.user.sub, 'follow');
    return reply.code(204).send();
  });

  // ---------- Kudos ----------

  app.post('/activities/:id/kudos', { config: { rateLimit: LIMITS.kudos } }, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const activity = await findActivity(id, req.user.sub);
    if (!activity) return reply.code(404).send({ error: 'Activity not found' });
    if (activity.user_id === req.user.sub) return reply.code(400).send({ error: "You can't give kudos to yourself" });
    const { rowCount } = await pool.query(
      'INSERT INTO kudos (activity_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, req.user.sub],
    );
    if (rowCount) await notify(activity.user_id, req.user.sub, 'kudos', id);
    return reply.code(204).send();
  });

  app.delete('/activities/:id/kudos', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await pool.query('DELETE FROM kudos WHERE activity_id = $1 AND user_id = $2', [id, req.user.sub]);
    await pool.query("DELETE FROM notifications WHERE activity_id = $1 AND actor_id = $2 AND kind = 'kudos'", [id, req.user.sub]);
    return reply.code(204).send();
  });

  // Who gave kudos.
  app.get('/activities/:id/kudos', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    if (!(await findActivity(id, req.user.sub))) return reply.code(404).send({ error: 'Activity not found' });
    const { rows } = await pool.query<AthleteRow>(
      `SELECT ${ATHLETE_COLUMNS} FROM kudos k JOIN users u ON u.id = k.user_id
       WHERE k.activity_id = $2 AND ${noBlockBetween('$1', 'u.id')} ORDER BY k.created_at DESC`,
      [req.user.sub, id],
    );
    return rows.map((r) => toAthlete(r));
  });

  // ---------- Comments ----------

  interface CommentRow { id: string; activity_id: string; user_id: string; name: string; body: string; created_at: Date }
  const toComment = (r: CommentRow): Comment => ({
    id: r.id,
    activityId: r.activity_id,
    athlete: { id: r.user_id, name: r.name },
    body: r.body,
    createdAt: r.created_at.toISOString(),
  });

  app.get('/activities/:id/comments', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    if (!(await findActivity(id, req.user.sub))) return reply.code(404).send({ error: 'Activity not found' });
    const { rows } = await pool.query<CommentRow>(
      `SELECT c.id, c.activity_id, c.user_id, u.name, c.body, c.created_at
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.activity_id = $1 AND ${noBlockBetween('$2', 'c.user_id')} ORDER BY c.created_at`,
      [id, req.user.sub],
    );
    return rows.map(toComment);
  });

  app.post('/activities/:id/comments', { config: { rateLimit: LIMITS.comment } }, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { body } = commentSchema.parse(req.body);
    const activity = await findActivity(id, req.user.sub);
    if (!activity) return reply.code(404).send({ error: 'Activity not found' });
    const { rows } = await pool.query<CommentRow>(
      `WITH c AS (INSERT INTO comments (activity_id, user_id, body) VALUES ($1, $2, $3) RETURNING *)
       SELECT c.id, c.activity_id, c.user_id, u.name, c.body, c.created_at FROM c JOIN users u ON u.id = c.user_id`,
      [id, req.user.sub, body],
    );
    await notify(activity.user_id, req.user.sub, 'comment', id, rows[0].id);
    return reply.code(201).send(toComment(rows[0]));
  });

  // Delete a comment: its author, or the owner of the activity, can.
  app.delete('/comments/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { rowCount } = await pool.query(
      `DELETE FROM comments c USING activities a
       WHERE c.id = $1 AND a.id = c.activity_id AND (c.user_id = $2 OR a.user_id = $2)`,
      [id, req.user.sub],
    );
    if (!rowCount) return reply.code(404).send({ error: 'Comment not found' });
    return reply.code(204).send();
  });

  // ---------- Notifications ----------

  app.get('/notifications', async (req): Promise<Notification[]> => {
    const { rows } = await pool.query<{
      id: string; kind: NotificationKind; actor_id: string; actor_name: string; activity_id: string | null;
      activity_title: string | null; challenge_id: string | null; challenge_title: string | null;
      comment: string | null; created_at: Date; read_at: Date | null;
    }>(
      `SELECT n.id, n.kind, n.actor_id, u.name AS actor_name, n.activity_id, a.title AS activity_title,
         n.challenge_id, ch.title AS challenge_title, c.body AS comment, n.created_at, n.read_at
       FROM notifications n
       JOIN users u ON u.id = n.actor_id
       LEFT JOIN activities a ON a.id = n.activity_id
       LEFT JOIN custom_challenges ch ON ch.id = n.challenge_id
       LEFT JOIN comments c ON c.id = n.comment_id
       WHERE n.user_id = $1 AND ${noBlockBetween('$1', 'n.actor_id')} ORDER BY n.created_at DESC LIMIT 60`,
      [req.user.sub],
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      actor: { id: r.actor_id, name: r.actor_name } satisfies AthleteRef,
      activity: r.activity_id ? { id: r.activity_id, title: r.activity_title ?? 'an activity' } : null,
      challenge: r.challenge_id ? { id: r.challenge_id, title: r.challenge_title ?? 'a challenge' } : null,
      text: r.comment,
      createdAt: r.created_at.toISOString(),
      read: r.read_at !== null,
    }));
  });

  app.post('/notifications/read', async (req, reply) => {
    await pool.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.sub]);
    return reply.code(204).send();
  });

  // Unread counts for the red dots on the Home header.
  app.get('/badges', async (req): Promise<Badges> => {
    const { rows } = await pool.query<{ notifications: number; messages: number }>(
      `SELECT
         (SELECT count(*)::int FROM notifications n
            WHERE n.user_id = $1 AND n.read_at IS NULL AND ${noBlockBetween('$1', 'n.actor_id')}) AS notifications,
         (SELECT count(*)::int FROM conversation_members me
            JOIN messages m ON m.conversation_id = me.conversation_id
            WHERE me.user_id = $1 AND m.sender_id <> $1 AND m.created_at > me.last_read_at
              AND ${noBlockBetween('$1', 'm.sender_id')}) AS messages`,
      [req.user.sub],
    );
    return rows[0];
  });

  // ---------- Safety: block and report ----------

  // Block someone: you stop following each other, and neither of you can see, follow,
  // message or comment on the other. They are not told.
  app.post('/athletes/:id/block', { config: { rateLimit: LIMITS.follow } }, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const me = req.user.sub;
    if (id === me) return reply.code(400).send({ error: "You can't block yourself" });
    const exists = await pool.query('SELECT 1 FROM users WHERE id = $1', [id]);
    if (!exists.rowCount) return reply.code(404).send({ error: 'Athlete not found' });
    await pool.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [me, id]);
    await pool.query(
      'DELETE FROM follows WHERE (follower_id = $1 AND followee_id = $2) OR (follower_id = $2 AND followee_id = $1)',
      [me, id],
    );
    return reply.code(204).send();
  });

  app.delete('/athletes/:id/block', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await pool.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.user.sub, id]);
    return reply.code(204).send();
  });

  // People you've blocked, so you can unblock them (they no longer show up anywhere else).
  app.get('/me/blocked', async (req): Promise<AthleteRef[]> => {
    const { rows } = await pool.query<{ id: string; name: string }>(
      `SELECT u.id, u.name FROM blocks b JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = $1 ORDER BY b.created_at DESC`,
      [req.user.sub],
    );
    return rows;
  });

  // Report a person, activity, comment or message. Saved for the app owner to review.
  app.post('/reports', { config: { rateLimit: LIMITS.report } }, async (req, reply) => {
    const input = reportSchema.parse(req.body);
    if (input.targetUserId === req.user.sub) return reply.code(400).send({ error: "You can't report yourself" });
    await pool.query(
      `INSERT INTO reports (reporter_id, target_user_id, activity_id, comment_id, message_id, reason, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user.sub, input.targetUserId, input.activityId ?? null, input.commentId ?? null, input.messageId ?? null,
        input.reason, input.details ?? null],
    );
    return reply.code(201).send({ ok: true });
  });
}
