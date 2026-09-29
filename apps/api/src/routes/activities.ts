import {
  computeStats,
  createActivitySchema,
  encodePolyline,
  type ActivityDetail,
  type ActivitySummary,
  type ActivityType,
  type TrackPoint,
} from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

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
  polyline: string;
  points?: TrackPoint[];
  created_at: Date;
}

const SUMMARY_COLUMNS = `id, user_id, type, title, description, started_at, elapsed_seconds, moving_seconds,
  distance_meters, elevation_gain_meters, polyline, created_at`;

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
    polyline: row.polyline,
    createdAt: row.created_at.toISOString(),
  };
}

const idParams = z.object({ id: z.uuid() });

export async function activityRoutes(app: FastifyInstance) {
  // Every route in this file requires login.
  app.addHook('onRequest', app.authenticate);

  // Save a recorded activity. The server works out the stats itself
  // from the GPS points instead of trusting numbers sent by the phone.
  app.post('/activities', async (req, reply) => {
    const input = createActivitySchema.parse(req.body);
    const points = [...input.points].sort((a, b) => a.t - b.t);
    const stats = computeStats(points);
    const { rows } = await pool.query<ActivityRow>(
      `INSERT INTO activities (user_id, type, title, description, started_at, elapsed_seconds, moving_seconds,
         distance_meters, elevation_gain_meters, polyline, points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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

  app.delete('/activities/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { rowCount } = await pool.query('DELETE FROM activities WHERE id = $1 AND user_id = $2', [id, req.user.sub]);
    if (!rowCount) return reply.code(404).send({ error: 'Activity not found' });
    return reply.code(204).send();
  });
}
