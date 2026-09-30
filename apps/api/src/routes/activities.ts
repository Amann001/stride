import {
  CATEGORIES,
  cleanTrack,
  computeAchievements,
  createActivitySchema,
  encodePolyline,
  manualActivitySchema,
  type Achievement,
  type ActivityDetail,
  type ActivitySummary,
  type ActivityType,
  type BestEffort,
  type TrackPoint,
  type Visibility,
  updateActivitySchema,
} from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { analyseActivity, earlierActivities } from '../analysis';
import { pool } from '../db';

interface ActivityRow {
  id: string;
  user_id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  started_at: Date;
  elapsed_seconds: number;
  moving_seconds: number;
  distance_meters: number;
  elevation_gain_meters: number;
  max_speed_mps: number;
  steps: number | null;
  best_efforts: BestEffort[] | null;
  achievements: Achievement[];
  visibility: Visibility;
  polyline: string;
  points?: TrackPoint[];
  created_at: Date;
}

const SUMMARY_COLUMNS = `id, user_id, type, title, description, started_at, elapsed_seconds, moving_seconds,
  distance_meters, elevation_gain_meters, max_speed_mps, steps, best_efforts, achievements, visibility, polyline, created_at`;

function toSummary(row: ActivityRow): ActivitySummary {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    description: row.description,
    startedAt: row.started_at.toISOString(),
    elapsedSeconds: row.elapsed_seconds,
    movingSeconds: row.moving_seconds,
    distanceMeters: row.distance_meters,
    elevationGainMeters: row.elevation_gain_meters,
    maxSpeedMps: row.max_speed_mps,
    steps: row.steps,
    bestEfforts: row.best_efforts ?? [],
    achievements: row.achievements,
    visibility: row.visibility,
    polyline: row.polyline,
    createdAt: row.created_at.toISOString(),
  };
}

const idParams = z.object({ id: z.uuid() });

// [minLat, maxLat, minLng, maxLng] of a track.
function boundingBox(points: TrackPoint[]): [number, number, number, number] {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return [minLat, maxLat, minLng, maxLng];
}

export async function activityRoutes(app: FastifyInstance) {
  // Every route in this file requires login.
  app.addHook('onRequest', app.authenticate);

  // Save a recorded activity. The server works out the stats itself
  // from the GPS points instead of trusting numbers sent by the phone.
  app.post('/activities', async (req, reply) => {
    const input = createActivitySchema.parse(req.body);
    // Sort by time and drop GPS glitches (impossible jumps) before doing any maths.
    const points = cleanTrack(input.points, input.type);
    if (points.length < 2) {
      return reply.code(400).send({ error: 'Not enough good GPS points to save this activity' });
    }
    // Rides don't count steps, even if the phone sent some.
    const steps = CATEGORIES[input.type].countsSteps ? (input.steps ?? null) : null;
    const { stats, maxSpeedMps, bestEfforts, achievements } = await analyseActivity(
      pool,
      req.user.sub,
      input.type,
      points,
      steps,
    );
    const { rows } = await pool.query<ActivityRow>(
      `INSERT INTO activities (user_id, type, title, description, started_at, elapsed_seconds, moving_seconds,
         distance_meters, elevation_gain_meters, polyline, points, steps, max_speed_mps, best_efforts, achievements,
         min_lat, max_lat, min_lng, max_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING ${SUMMARY_COLUMNS}`,
      [
        req.user.sub,
        input.type,
        input.title,
        input.description ?? null,
        new Date(points[0].t),
        stats.elapsedSeconds,
        stats.movingSeconds,
        stats.distanceMeters,
        stats.elevationGainMeters,
        encodePolyline(points),
        JSON.stringify(points),
        steps,
        maxSpeedMps,
        JSON.stringify(bestEfforts),
        JSON.stringify(achievements),
        // The box around the route, so heatmap tiles can find it quickly.
        ...boundingBox(points),
      ],
    );
    return reply.code(201).send(toSummary(rows[0]));
  });

  // Save an activity typed in by hand (e.g. a treadmill run or a ride without the phone).
  // There's no GPS track, so no map, splits or best efforts, but it counts for totals,
  // streaks, challenges, and the longest/biggest-climb achievements.
  app.post('/activities/manual', async (req, reply) => {
    const input = manualActivitySchema.parse(req.body);
    const startedAt = new Date(input.startedAt);
    const previous = await earlierActivities(pool, req.user.sub, input.type, startedAt);
    const achievements = computeAchievements(
      input.type,
      { distanceMeters: input.distanceMeters, elevationGainMeters: input.elevationGainMeters, steps: null, bestEfforts: [] },
      previous,
    );
    const { rows } = await pool.query<ActivityRow>(
      `INSERT INTO activities (user_id, type, title, description, started_at, elapsed_seconds, moving_seconds,
         distance_meters, elevation_gain_meters, polyline, points, max_speed_mps, best_efforts, achievements)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, '', '[]', 0, '[]', $9)
       RETURNING ${SUMMARY_COLUMNS}`,
      [
        req.user.sub,
        input.type,
        input.title,
        input.description ?? null,
        startedAt,
        input.elapsedSeconds,
        input.distanceMeters,
        input.elevationGainMeters,
        JSON.stringify(achievements),
      ],
    );
    return reply.code(201).send(toSummary(rows[0]));
  });

  // Your own activities, newest first.
  app.get('/activities', async (req): Promise<ActivitySummary[]> => {
    const { rows } = await pool.query<ActivityRow>(
      `SELECT ${SUMMARY_COLUMNS} FROM activities WHERE user_id = $1 ORDER BY started_at DESC LIMIT 50`,
      [req.user.sub],
    );
    return rows.map(toSummary);
  });

  app.get('/activities/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { rows } = await pool.query<ActivityRow>(
      `SELECT ${SUMMARY_COLUMNS}, points FROM activities WHERE id = $1 AND user_id = $2`,
      [id, req.user.sub],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Activity not found' });
    const detail: ActivityDetail = { ...toSummary(rows[0]), points: rows[0].points ?? [] };
    return detail;
  });

  // Edit your activity's title, description, or who can see it.
  app.patch('/activities/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const input = updateActivitySchema.parse(req.body);
    const { rows } = await pool.query<ActivityRow>(
      `UPDATE activities SET
         title = coalesce($3, title),
         description = CASE WHEN $4::boolean THEN $5 ELSE description END,
         visibility = coalesce($6, visibility)
       WHERE id = $1 AND user_id = $2
       RETURNING ${SUMMARY_COLUMNS}`,
      [id, req.user.sub, input.title ?? null, input.description !== undefined, input.description ?? null, input.visibility ?? null],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Activity not found' });
    return toSummary(rows[0]);
  });

  app.delete('/activities/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { rowCount } = await pool.query('DELETE FROM activities WHERE id = $1 AND user_id = $2', [id, req.user.sub]);
    if (!rowCount) return reply.code(404).send({ error: 'Activity not found' });
    return reply.code(204).send();
  });
}
