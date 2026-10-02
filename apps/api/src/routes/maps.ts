import {
  decodePolyline,
  distanceBetween,
  heatmapParamsSchema,
  hidePolylineEnds,
  nearbySchema,
  planRouteSchema,
  routeDifficulty,
  saveRouteSchema,
  SUGGESTION_KM,
  suggestRoutesSchema,
  type ActivityType,
  type LatLng,
  type PlannedRoute,
  type ProfileSample,
  type RouteSummary,
} from '@repo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { pool } from '../db';
import { EMPTY_TILE, renderTile, tileBounds } from '../heatmap';
import { elevationAlong, loopRoute, routeThrough, RoutingError, straightLine, toPolyline, TtlCache } from '../routing';

const ROUTE_NOUN: Record<ActivityType, string> = { run: 'Running', ride: 'Riding', walk: 'Walking', hike: 'Hiking' };

interface RouteRow {
  id: string;
  name: string;
  sport: ActivityType;
  distance_meters: number;
  elevation_gain_meters: number;
  polyline: string;
  elevation_profile: ProfileSample[];
  start_lat: number;
  start_lng: number;
  created_at: Date;
}

function savedRoute(r: RouteRow): RouteSummary {
  return {
    id: r.id,
    source: 'saved',
    name: r.name,
    sport: r.sport,
    distanceMeters: r.distance_meters,
    elevationGainMeters: r.elevation_gain_meters,
    polyline: r.polyline,
    elevationProfile: r.elevation_profile,
    start: { lat: r.start_lat, lng: r.start_lng },
    difficulty: routeDifficulty(r.sport, r.distance_meters, r.elevation_gain_meters),
    createdAt: r.created_at.toISOString(),
  };
}

function pathLength(coords: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += distanceBetween(coords[i - 1], coords[i]);
  return d;
}

// Three target lengths: the sport's defaults, or spread across the chosen Length filter.
function targetKms(sport: ActivityType, minKm?: number, maxKm?: number): number[] {
  if (minKm == null || maxKm == null) return SUGGESTION_KM[sport];
  const lo = Math.min(minKm, maxKm);
  const hi = Math.max(minKm, maxKm);
  return [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.1].map((k) => Math.round(k * 10) / 10);
}

const idParams = z.object({ id: z.uuid() });

// Elevation is nice to have: if the lookup fails, save the route anyway without it.
async function elevationOrNothing(req: FastifyRequest, coords: LatLng[]) {
  try {
    return await elevationAlong(coords);
  } catch (err) {
    req.log.warn({ err }, 'elevation lookup failed');
    return { profile: [] as ProfileSample[], gainMeters: 0 };
  }
}

// Each suggestion request makes several calls to shared free services, so one person
// can only have a few running at once.
const suggestionsInFlight = new Map<string, number>();
const MAX_SUGGESTIONS_IN_FLIGHT = 3;

// Routes: suggestions, planning, and your saved routes. All need login.
export async function routeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Loops that start and end where you are, e.g. three running routes of 2, 5 and 8 km.
  app.post('/routes/suggest', async (req, reply) => {
    const input = suggestRoutesSchema.parse(req.body);
    const userId = req.user.sub;
    const running = suggestionsInFlight.get(userId) ?? 0;
    if (running >= MAX_SUGGESTIONS_IN_FLIGHT) {
      return reply.code(429).send({ error: 'Still finding routes. Give it a moment.' });
    }
    suggestionsInFlight.set(userId, running + 1);
    const kms = targetKms(input.sport, input.minKm, input.maxKm);
    // Each loop heads off in a different direction; `variant` turns them for a fresh set.
    const base = (input.variant * 47 + Math.round(Math.abs(input.start.lat * 1000 + input.start.lng * 1000))) % 360;
    const results = await Promise.allSettled(
      kms.map(async (km, i): Promise<RouteSummary> => {
        const bearing = (base + i * 120) % 360;
        const loop = await loopRoute(input.sport, input.start, km * 1000, bearing);
        const elevation = await elevationOrNothing(req, loop.coords);
        return {
          id: `suggested:${input.sport}:${input.start.lat.toFixed(4)},${input.start.lng.toFixed(4)}:${km}:${bearing}`,
          source: 'suggested',
          name: `${ROUTE_NOUN[input.sport]} Route`,
          sport: input.sport,
          distanceMeters: Math.round(loop.distanceMeters),
          elevationGainMeters: elevation.gainMeters,
          polyline: toPolyline(loop.coords),
          elevationProfile: elevation.profile,
          start: input.start,
          difficulty: routeDifficulty(input.sport, loop.distanceMeters, elevation.gainMeters),
          createdAt: null,
        };
      }),
    ).finally(() => {
      const left = (suggestionsInFlight.get(userId) ?? 1) - 1;
      if (left > 0) suggestionsInFlight.set(userId, left);
      else suggestionsInFlight.delete(userId);
    });
    const found = results
      .flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
    // With a Length filter, drop loops the road network pushed well outside it (unless
    // that would leave nothing to show).
    const inRange = input.minKm != null && input.maxKm != null
      ? found.filter((r) => r.distanceMeters >= input.minKm! * 750 && r.distanceMeters <= input.maxKm! * 1250)
      : found;
    const routes = inRange.length ? inRange : found;
    // Two loops can come out almost the same on a small road network; keep one.
    const unique = routes.filter(
      (r, i) => !routes.slice(0, i).some((o) => Math.abs(o.distanceMeters - r.distanceMeters) < o.distanceMeters * 0.03),
    );
    if (unique.length === 0) {
      req.log.warn({ errors: results.map((r) => (r.status === 'rejected' ? String(r.reason) : null)) }, 'route suggestions failed');
      return reply.code(502).send({ error: "Couldn't find routes here. Try a spot with more roads or paths." });
    }
    return unique;
  });

  // A route through the points you tapped, following roads and paths (or straight lines).
  app.post('/routes/plan', async (req, reply): Promise<PlannedRoute | undefined> => {
    const input = planRouteSchema.parse(req.body);
    try {
      const route = input.snap ? await routeThrough(input.sport, input.waypoints) : straightLine(input.waypoints);
      return { polyline: toPolyline(route.coords), distanceMeters: Math.round(route.distanceMeters) };
    } catch (err) {
      if (err instanceof RoutingError) return reply.code(502).send({ error: err.message });
      throw err;
    }
  });

  // Save a route (a suggestion you liked, or one you drew). We work out its length and
  // climbing ourselves from the line.
  app.post('/routes', async (req, reply) => {
    const input = saveRouteSchema.parse(req.body);
    const coords = decodePolyline(input.polyline);
    if (coords.length < 2) return reply.code(400).send({ error: 'A route needs at least 2 points' });
    const elevation = await elevationOrNothing(req, coords);
    const { rows } = await pool.query<RouteRow>(
      `INSERT INTO routes (user_id, name, sport, distance_meters, elevation_gain_meters, polyline, elevation_profile, start_lat, start_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.sub, input.name, input.sport, Math.round(pathLength(coords)), elevation.gainMeters, input.polyline,
        JSON.stringify(elevation.profile), coords[0].lat, coords[0].lng],
    );
    return reply.code(201).send(savedRoute(rows[0]));
  });

  app.get('/routes', async (req): Promise<RouteSummary[]> => {
    const { rows } = await pool.query<RouteRow>('SELECT * FROM routes WHERE user_id = $1 ORDER BY created_at DESC', [req.user.sub]);
    return rows.map(savedRoute);
  });

  app.get('/routes/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { rows } = await pool.query<RouteRow>('SELECT * FROM routes WHERE id = $1 AND user_id = $2', [id, req.user.sub]);
    if (!rows[0]) return reply.code(404).send({ error: 'Route not found' });
    return savedRoute(rows[0]);
  });

  app.delete('/routes/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { rowCount } = await pool.query('DELETE FROM routes WHERE id = $1 AND user_id = $2', [id, req.user.sub]);
    if (!rowCount) return reply.code(404).send({ error: 'Route not found' });
    return reply.code(204).send();
  });

  // "Runs around here": your saved routes and past activities of this sport that start
  // within about 10 km.
  app.get('/routes/nearby', async (req): Promise<RouteSummary[]> => {
    const { lat, lng, sport } = nearbySchema.parse(req.query);
    const d = 0.1; // about 10 km of latitude
    const box = [lat - d, lat + d, lng - d, lng + d];
    const [saved, activities] = await Promise.all([
      pool.query<RouteRow>(
        `SELECT * FROM routes WHERE user_id = $1 AND sport = $2
           AND start_lat BETWEEN $3 AND $4 AND start_lng BETWEEN $5 AND $6
         ORDER BY created_at DESC LIMIT 10`,
        [req.user.sub, sport, ...box],
      ),
      pool.query<{ id: string; title: string; distance_meters: number; elevation_gain_meters: number; polyline: string; started_at: Date }>(
        `SELECT id, title, distance_meters, elevation_gain_meters, polyline, started_at FROM activities
         WHERE user_id = $1 AND type = $2 AND polyline <> ''
           AND max_lat >= $3 AND min_lat <= $4 AND max_lng >= $5 AND min_lng <= $6
         ORDER BY started_at DESC LIMIT 10`,
        [req.user.sub, sport, ...box],
      ),
    ]);
    const fromActivities = activities.rows.map((a): RouteSummary => {
      const coords = decodePolyline(a.polyline);
      return {
        id: a.id,
        source: 'activity',
        name: a.title,
        sport,
        distanceMeters: a.distance_meters,
        elevationGainMeters: a.elevation_gain_meters,
        polyline: a.polyline,
        elevationProfile: [],
        start: coords[0],
        difficulty: routeDifficulty(sport, a.distance_meters, a.elevation_gain_meters),
        createdAt: a.started_at.toISOString(),
      };
    });
    return [...saved.rows.map(savedRoute), ...fromActivities];
  });

  // A short-lived key the map uses to load heatmap tiles (maps can't send login headers).
  app.get('/heatmap/token', async (req) => ({
    token: app.jwt.sign({ sub: req.user.sub, scope: 'tiles' }, { expiresIn: '12h' }),
  }));
}

const tileCache = new TtlCache<Buffer>(1500, 2 * 60_000);
const tileQuery = z.object({ token: z.string().min(10) });

// Heatmap tiles: /heatmap/<global|weekly|night|personal>/<sport|all>/<z>/<x>/<y>.png?token=...
export async function heatmapRoutes(app: FastifyInstance) {
  app.get('/heatmap/:kind/:sport/:z/:x/:y', { logLevel: 'warn' }, async (req, reply) => {
    const params = heatmapParamsSchema.parse(req.params);
    let userId: string;
    try {
      const payload = app.jwt.verify<{ sub: string; scope?: string }>(tileQuery.parse(req.query).token);
      if (payload.scope !== 'tiles') throw new Error('wrong token');
      userId = payload.sub;
    } catch {
      return reply.code(401).send({ error: 'Please log in' });
    }
    const { kind, sport, z: zoom, x, y } = params;
    const key = `${kind}|${sport}|${kind === 'personal' ? userId : ''}|${zoom}/${x}/${y}`;
    let png = tileCache.get(key);
    if (!png) {
      const b = tileBounds(zoom, x, y);
      const { rows } = await pool.query<{ polyline: string; started_at: Date; lng: number }>(
        `SELECT polyline, started_at, (min_lng + max_lng) / 2 AS lng FROM activities
         WHERE polyline <> '' AND min_lat <= $1 AND max_lat >= $2 AND min_lng <= $3 AND max_lng >= $4
           AND ($5 = 'all' OR type = $5)
           AND (CASE WHEN $6 = 'personal' THEN user_id = $7 ELSE visibility = 'everyone' END)
           AND ($6 <> 'weekly' OR started_at >= now() - interval '7 days')
         LIMIT 5000`,
        [b.maxLat, b.minLat, b.maxLng, b.minLng, sport, kind, userId],
      );
      // Night: started between 7 pm and 5 am local time, estimated from the longitude
      // (every 15 degrees east is one hour ahead of UTC).
      const lines = rows
        .filter((r) => {
          if (kind !== 'night') return true;
          const hour = (r.started_at.getUTCHours() + r.started_at.getUTCMinutes() / 60 + r.lng / 15 + 48) % 24;
          return hour >= 19 || hour < 5;
        })
        // Shared heatmaps never show where people start or finish (privacy zone).
        .map((r) => (kind === 'personal' ? r.polyline : hidePolylineEnds(r.polyline)))
        .filter((p) => p !== '');
      png = lines.length ? renderTile(kind, zoom, x, y, lines) : EMPTY_TILE;
      tileCache.set(key, png);
    }
    return reply.header('Content-Type', 'image/png').header('Cache-Control', 'private, max-age=120').send(png);
  });
}
