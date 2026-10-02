import { clubSearchSchema, createClubSchema, type ActivityType, type Club, type ClubDetail } from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { canSee, selectActivities, toSummary, type ActivityRow } from '../activity-sql';
import { pool } from '../db';

// Clubs: groups of athletes around a sport and place, with a weekly leaderboard.

const idParams = z.object({ id: z.uuid() });

interface ClubRow {
  id: string;
  name: string;
  sport: ActivityType;
  location: string | null;
  description: string | null;
  member_count: number;
  is_member: boolean;
  is_owner: boolean;
  created_at: Date;
}

// `$1` is the logged-in user.
const CLUB_COLUMNS = `c.id, c.name, c.sport, c.location, c.description, c.created_at,
  (SELECT count(*)::int FROM club_members m WHERE m.club_id = c.id) AS member_count,
  EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = $1) AS is_member,
  c.owner_id = $1 AS is_owner`;

const toClub = (r: ClubRow): Club => ({
  id: r.id,
  name: r.name,
  sport: r.sport,
  location: r.location,
  description: r.description,
  memberCount: r.member_count,
  isMember: r.is_member,
  isOwner: r.is_owner,
  createdAt: r.created_at.toISOString(),
});

async function findClub(id: string, userId: string): Promise<ClubRow | null> {
  const { rows } = await pool.query<ClubRow>(`SELECT ${CLUB_COLUMNS} FROM clubs c WHERE c.id = $2`, [userId, id]);
  return rows[0] ?? null;
}

export async function clubRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Search clubs by name or place, optionally for one sport. Biggest first.
  app.get('/clubs', async (req): Promise<Club[]> => {
    const { q, sport } = clubSearchSchema.parse(req.query);
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const { rows } = await pool.query<ClubRow>(
      `SELECT ${CLUB_COLUMNS} FROM clubs c
       WHERE (c.name ILIKE $2 OR coalesce(c.location, '') ILIKE $2) AND ($3::text IS NULL OR c.sport = $3)
       ORDER BY member_count DESC, c.created_at DESC LIMIT 50`,
      [req.user.sub, pattern, sport ?? null],
    );
    return rows.map(toClub);
  });

  app.get('/clubs/mine', async (req): Promise<Club[]> => {
    const { rows } = await pool.query<ClubRow>(
      `SELECT ${CLUB_COLUMNS} FROM clubs c JOIN club_members m ON m.club_id = c.id AND m.user_id = $1
       ORDER BY m.joined_at DESC`,
      [req.user.sub],
    );
    return rows.map(toClub);
  });

  app.post('/clubs', async (req, reply) => {
    const input = createClubSchema.parse(req.body);
    const { rows } = await pool.query<{ id: string }>(
      `WITH c AS (
         INSERT INTO clubs (name, sport, location, description, owner_id) VALUES ($1, $2, $3, $4, $5) RETURNING id
       )
       INSERT INTO club_members (club_id, user_id, role) SELECT id, $5, 'owner' FROM c RETURNING club_id AS id`,
      [input.name, input.sport, input.location || null, input.description || null, req.user.sub],
    );
    return reply.code(201).send(toClub((await findClub(rows[0].id, req.user.sub))!));
  });

  // A club's page: members, this week's leaderboard for its sport, and recent activities.
  app.get('/clubs/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const club = await findClub(id, req.user.sub);
    if (!club) return reply.code(404).send({ error: 'Club not found' });
    const [members, leaders, recent] = await Promise.all([
      pool.query<{ id: string; name: string }>(
        `SELECT u.id, u.name FROM club_members m JOIN users u ON u.id = m.user_id
         WHERE m.club_id = $1 ORDER BY m.role = 'owner' DESC, m.joined_at LIMIT 100`,
        [id],
      ),
      // Private ("only you") activities don't count towards the leaderboard.
      pool.query<{ id: string; name: string; distance: number; n: number }>(
        `SELECT u.id, u.name, sum(a.distance_meters)::float AS distance, count(*)::int AS n
         FROM club_members m
         JOIN users u ON u.id = m.user_id
         JOIN activities a ON a.user_id = m.user_id
         WHERE m.club_id = $1 AND a.type = $2 AND a.visibility <> 'only_me'
           AND a.started_at >= date_trunc('week', now())
         GROUP BY u.id, u.name ORDER BY distance DESC LIMIT 20`,
        [id, club.sport],
      ),
      pool.query<ActivityRow>(
        `${selectActivities('$1')}
         WHERE a.user_id IN (SELECT user_id FROM club_members WHERE club_id = $2) AND a.type = $3 AND ${canSee('$1')}
         ORDER BY a.started_at DESC LIMIT 20`,
        [req.user.sub, id, club.sport],
      ),
    ]);
    const detail: ClubDetail = {
      ...toClub(club),
      members: members.rows,
      leaderboard: leaders.rows.map((l) => ({ athlete: { id: l.id, name: l.name }, distanceMeters: l.distance, activityCount: l.n })),
      recentActivities: recent.rows.map(toSummary),
    };
    return detail;
  });

  app.post('/clubs/:id/join', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    if (!(await findClub(id, req.user.sub))) return reply.code(404).send({ error: 'Club not found' });
    await pool.query('INSERT INTO club_members (club_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, req.user.sub]);
    return reply.code(204).send();
  });

  app.delete('/clubs/:id/join', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const club = await findClub(id, req.user.sub);
    if (!club) return reply.code(404).send({ error: 'Club not found' });
    if (club.is_owner) return reply.code(400).send({ error: "You created this club, so you can't leave it" });
    await pool.query('DELETE FROM club_members WHERE club_id = $1 AND user_id = $2', [id, req.user.sub]);
    return reply.code(204).send();
  });
}
