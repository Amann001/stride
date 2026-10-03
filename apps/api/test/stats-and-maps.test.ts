import { encodePolyline } from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { call, createUser, manualActivity, recordActivity, startApp } from './helpers';

let app: FastifyInstance;
beforeAll(async () => {
  app = await startApp();
});
afterAll(() => app.close());

describe('the server itself', () => {
  it('answers the health check', async () => {
    expect((await call(app, null, 'GET', '/health')).body).toEqual({ ok: true });
  });

  it('serves the privacy policy and terms pages', async () => {
    const privacy = await app.inject({ method: 'GET', url: '/privacy' });
    expect(privacy.statusCode).toBe(200);
    expect(privacy.headers['content-type']).toMatch(/html/);
    expect(privacy.body).toMatch(/Privacy/);
    expect((await app.inject({ method: 'GET', url: '/terms' })).statusCode).toBe(200);
  });

  it('answers unknown addresses with a plain 404', async () => {
    expect((await call(app, null, 'GET', '/nope')).body).toEqual({ error: 'Not found' });
  });

  it('accepts crash reports from the app', async () => {
    const res = await call(app, null, 'POST', '/diagnostics/errors', { message: 'Test crash', context: { platform: 'android', fatal: false } });
    expect(res.status).toBe(204);
  });
});

describe('stats and weekly goals', () => {
  it('adds up totals by sport and for this week', async () => {
    const user = await createUser(app, 'Counter');
    await manualActivity(app, user, { km: 5, hoursAgo: 0.1 });
    await manualActivity(app, user, { km: 3, hoursAgo: 0.1 });
    await manualActivity(app, user, { type: 'ride', km: 20, hoursAgo: 0.1 });
    const stats = (await call(app, user, 'GET', '/stats?tz=UTC')).body;
    expect(stats.activityCount).toBe(3);
    expect(stats.byType.run.allTime).toMatchObject({ count: 2, distanceMeters: 8000 });
    expect(stats.byType.ride.allTime.distanceMeters).toBe(20_000);
    expect(stats.thisWeek.distanceMeters).toBe(28_000);
    expect(stats.streakWeeks).toBeGreaterThanOrEqual(1);
  });

  it('keeps your fastest efforts as personal records', async () => {
    const user = await createUser(app, 'Racer');
    await recordActivity(app, user, { km: 1.2, secondsPerKm: 360, start: new Date(Date.now() - 5 * 3600_000) });
    await recordActivity(app, user, { km: 1.2, secondsPerKm: 300 });
    const oneK = (await call(app, user, 'GET', '/stats?tz=UTC')).body.byType.run.bestEfforts
      .filter((e: { distanceMeters: number }) => e.distanceMeters === 1000);
    expect(oneK.map((e: { rank: number }) => e.rank)).toEqual([1, 2]);
    expect(oneK[0].value).toBeLessThan(oneK[1].value);
  });

  it('sets and clears a weekly goal', async () => {
    const user = await createUser(app, 'Goal');
    expect((await call(app, user, 'PUT', '/goals/run', { targetMeters: 20_000 })).status).toBe(204);
    expect((await call(app, user, 'GET', '/stats?tz=UTC')).body.byType.run.weeklyGoalMeters).toBe(20_000);
    await call(app, user, 'PUT', '/goals/run', { targetMeters: 0 });
    expect((await call(app, user, 'GET', '/stats?tz=UTC')).body.byType.run.weeklyGoalMeters).toBeNull();
    expect((await call(app, user, 'PUT', '/goals/swim', { targetMeters: 1000 })).status).toBe(400);
  });
});

describe('saved routes and heatmaps', () => {
  const line = encodePolyline([
    { lat: 18.52, lng: 73.85 },
    { lat: 18.53, lng: 73.86 },
    { lat: 18.54, lng: 73.86 },
  ]);

  it('saves a route, works out its length, and keeps it private to you', async () => {
    const user = await createUser(app, 'Planner');
    const saved = await call(app, user, 'POST', '/routes', { name: 'Lake loop', sport: 'run', polyline: line });
    expect(saved.status).toBe(201);
    expect(saved.body.distanceMeters).toBeGreaterThan(2000);
    expect(saved.body.distanceMeters).toBeLessThan(3000);
    // The elevation service is unreachable in tests: the route still saves, just without a climb.
    expect(saved.body.elevationGainMeters).toBe(0);

    expect((await call(app, user, 'GET', '/routes')).body).toHaveLength(1);
    const other = await createUser(app, 'Nosy');
    expect((await call(app, other, 'GET', `/routes/${saved.body.id}`)).status).toBe(404);
    expect((await call(app, other, 'DELETE', `/routes/${saved.body.id}`)).status).toBe(404);
    expect((await call(app, user, 'DELETE', `/routes/${saved.body.id}`)).status).toBe(204);
  });

  it('finds your saved routes and past activities near a place', async () => {
    const user = await createUser(app, 'Local');
    await call(app, user, 'POST', '/routes', { name: 'Lake loop', sport: 'run', polyline: line });
    await recordActivity(app, user, { km: 2, secondsPerKm: 300, lat: 18.525, lng: 73.855 });
    const near = (await call(app, user, 'GET', '/routes/nearby?lat=18.52&lng=73.85&sport=run')).body;
    expect(near.map((r: { source: string }) => r.source).sort()).toEqual(['activity', 'saved']);
    const far = (await call(app, user, 'GET', '/routes/nearby?lat=28.6&lng=77.2&sport=run')).body;
    expect(far).toEqual([]);
  });

  it("a heatmap key can only load map tiles, and can't be used to log in", async () => {
    const user = await createUser(app, 'Mapper');
    const { token } = (await call(app, user, 'GET', '/heatmap/token')).body;
    expect((await call(app, { ...user, token }, 'GET', '/me')).status).toBe(401);
    const tile = await app.inject({ method: 'GET', url: `/heatmap/personal/run/12/2877/1797.png?token=${token}` });
    expect(tile.statusCode).toBe(200);
    expect(tile.headers['content-type']).toMatch(/png/);
    // A normal login token doesn't open tiles.
    expect((await app.inject({ method: 'GET', url: `/heatmap/personal/run/12/2877/1797.png?token=${user.token}` })).statusCode).toBe(401);
  });
});
