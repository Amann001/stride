import type { TrackPoint } from '@repo/shared';
import type { FastifyInstance, InjectOptions } from 'fastify';

import { buildApp } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/passwords';

// Shared helpers for the API tests: a running app, test users, and GPS tracks.

export const PASSWORD = 'correct-horse-battery';
let passwordHash: Promise<string> | null = null;

export interface TestUser {
  id: string;
  name: string;
  email: string;
  token: string;
}

export interface Reply<T = any> {
  status: number;
  body: T;
}

export async function startApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

let counter = 0;
// A unique email for this test run.
export const uniqueEmail = (name: string) => `${name.toLowerCase().replace(/\W/g, '')}.${Date.now()}.${counter++}@test.dev`;

// Makes an account straight in the database (sign-up itself has its own tests, and its rate
// limit would get in the way here) and a login token for it.
export async function createUser(app: FastifyInstance, name: string): Promise<TestUser> {
  passwordHash ??= hashPassword(PASSWORD);
  const email = uniqueEmail(name);
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [email, name, await passwordHash],
  );
  return { id: rows[0].id, name, email, token: app.jwt.sign({ sub: rows[0].id, tv: 0 }) };
}

// Calls the API as `user` (or logged out with null).
export async function call<T = any>(
  app: FastifyInstance,
  user: TestUser | null,
  method: InjectOptions['method'],
  url: string,
  body?: unknown,
  extra: Partial<InjectOptions> = {},
): Promise<Reply<T>> {
  const res = await app.inject({
    method,
    url,
    headers: user ? { authorization: `Bearer ${user.token}` } : {},
    ...(body !== undefined ? { payload: body as InjectOptions['payload'] } : {}),
    ...extra,
  });
  return { status: res.statusCode, body: res.body ? safeJson(res.body) : null };
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// The same Earth size the app uses (see distanceBetween), so 5 km here measures 5 km there.
const METERS_PER_DEGREE_LAT = (6_371_000 * Math.PI) / 180;
// Tracks run half a meter long, so rounding can't make a 5 km run measure 4999.99 m.
const EXTRA_METERS = 0.5;

// A straight GPS track heading north: `km` long at a steady pace, one point every 5 seconds.
export function makeTrack({
  km,
  secondsPerKm,
  start = new Date(Date.now() - 2 * 3600_000),
  lat = 28.6139,
  lng = 77.209,
  alt = 200,
  climbMeters = 0,
}: {
  km: number;
  secondsPerKm: number;
  start?: Date;
  lat?: number;
  lng?: number;
  alt?: number;
  climbMeters?: number;
}): TrackPoint[] {
  const totalSeconds = km * secondsPerKm;
  const points: TrackPoint[] = [];
  for (let s = 0; s <= totalSeconds; s += 5) {
    const f = s / totalSeconds;
    points.push({
      lat: lat + (f * (km * 1000 + EXTRA_METERS)) / METERS_PER_DEGREE_LAT,
      lng,
      alt: alt + f * climbMeters,
      t: start.getTime() + s * 1000,
    });
  }
  return points;
}

// Uploads a recorded activity for `user`.
export async function recordActivity(
  app: FastifyInstance,
  user: TestUser,
  opts: Parameters<typeof makeTrack>[0] & { type?: 'run' | 'ride' | 'walk' | 'hike'; title?: string; clientId?: string },
) {
  const res = await call(app, user, 'POST', '/activities', {
    type: opts.type ?? 'run',
    title: opts.title ?? 'Test activity',
    points: makeTrack(opts),
    ...(opts.clientId ? { clientId: opts.clientId } : {}),
  });
  if (res.status >= 300) throw new Error(`Upload failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

// Adds an activity typed in by hand.
export async function manualActivity(
  app: FastifyInstance,
  user: TestUser,
  { type = 'run', km, hoursAgo = 1, minutes = 30 }: { type?: 'run' | 'ride' | 'walk' | 'hike'; km: number; hoursAgo?: number; minutes?: number },
) {
  const res = await call(app, user, 'POST', '/activities/manual', {
    type,
    title: `${km} km ${type}`,
    startedAt: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
    elapsedSeconds: minutes * 60,
    distanceMeters: km * 1000,
    elevationGainMeters: 0,
  });
  if (res.status >= 300) throw new Error(`Manual activity failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export const follow = (app: FastifyInstance, a: TestUser, b: TestUser) => call(app, a, 'POST', `/athletes/${b.id}/follow`);
