import { decodePolyline, distanceBetween } from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { call, createUser, follow, makeTrack, manualActivity, recordActivity, startApp, type TestUser } from './helpers';

let app: FastifyInstance;
let runner: TestUser;
beforeAll(async () => {
  app = await startApp();
  runner = await createUser(app, 'Runner');
});
afterAll(() => app.close());

describe('recording an activity', () => {
  it('works out distance, time and pace on the server from the GPS points', async () => {
    const a = await recordActivity(app, runner, { km: 5, secondsPerKm: 300 });
    expect(a.distanceMeters).toBeGreaterThan(4950);
    expect(a.distanceMeters).toBeLessThan(5050);
    expect(a.elapsedSeconds).toBe(1500);
    expect(a.movingSeconds).toBeGreaterThan(1450);
    expect(a.achievements[0]).toMatchObject({ kind: 'first', title: 'Your first run!' });
    // Fastest 1K and 5K are found inside the track.
    const fiveK = a.bestEfforts.find((e: { distanceMeters: number }) => e.distanceMeters === 5000);
    expect(fiveK.seconds).toBeGreaterThan(1480);
    expect(fiveK.seconds).toBeLessThan(1520);
  });

  it('awards a PR when a later run is faster', async () => {
    const user = await createUser(app, 'Improver');
    await recordActivity(app, user, { km: 5, secondsPerKm: 330, start: new Date(Date.now() - 48 * 3600_000) });
    const faster = await recordActivity(app, user, { km: 5, secondsPerKm: 300 });
    expect(faster.achievements.map((x: { title: string }) => x.title)).toContain('PR: 5K');
  });

  it('drops GPS glitches instead of counting them as distance', async () => {
    const points = makeTrack({ km: 2, secondsPerKm: 300 });
    // One point 50 km away for a moment: an impossible jump for a runner.
    points.splice(100, 0, { ...points[100], lat: points[100].lat + 0.45, t: points[100].t + 1 });
    const res = await call(app, runner, 'POST', '/activities', { type: 'run', title: 'Glitchy', points });
    expect(res.status).toBe(201);
    expect(res.body.distanceMeters).toBeLessThan(2100);
  });

  it('a retried upload of the same recording returns the first copy, not a duplicate', async () => {
    const user = await createUser(app, 'Retry');
    const first = await recordActivity(app, user, { km: 1, secondsPerKm: 300, clientId: 'phone-recording-123' });
    const again = await call(app, user, 'POST', '/activities', {
      type: 'run', title: 'Same', points: makeTrack({ km: 1, secondsPerKm: 300 }), clientId: 'phone-recording-123',
    });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.id);
    expect((await call(app, user, 'GET', '/activities')).body).toHaveLength(1);
  });

  it('refuses an activity without enough good GPS points', async () => {
    const res = await call(app, runner, 'POST', '/activities', { type: 'run', title: 'Tiny', points: makeTrack({ km: 0.01, secondsPerKm: 300 }).slice(0, 1) });
    expect(res.status).toBe(400);
  });

  it("doesn't count steps for rides", async () => {
    const res = await call(app, runner, 'POST', '/activities', {
      type: 'ride', title: 'Ride', steps: 5000, points: makeTrack({ km: 10, secondsPerKm: 120 }),
    });
    expect(res.status).toBe(201);
    expect(res.body.steps).toBeNull();
  });

  it('saves an activity typed in by hand (no GPS)', async () => {
    const a = await manualActivity(app, runner, { type: 'walk', km: 3.5, minutes: 40 });
    expect(a).toMatchObject({ type: 'walk', distanceMeters: 3500, elapsedSeconds: 2400, polyline: '' });
  });
});

describe('editing and deleting', () => {
  it('lets the owner edit the title and who can see it', async () => {
    const a = await manualActivity(app, runner, { km: 4 });
    const res = await call(app, runner, 'PATCH', `/activities/${a.id}`, { title: 'Sunday long run', visibility: 'only_me' });
    expect(res.body).toMatchObject({ title: 'Sunday long run', visibility: 'only_me' });
  });

  it("doesn't let anyone else edit or delete it", async () => {
    const a = await manualActivity(app, runner, { km: 4 });
    const stranger = await createUser(app, 'Stranger');
    expect((await call(app, stranger, 'PATCH', `/activities/${a.id}`, { title: 'Mine now' })).status).toBe(404);
    expect((await call(app, stranger, 'DELETE', `/activities/${a.id}`)).status).toBe(404);
    expect((await call(app, runner, 'DELETE', `/activities/${a.id}`)).status).toBe(204);
    expect((await call(app, runner, 'GET', `/activities/${a.id}`)).status).toBe(404);
  });
});

describe('who can see an activity', () => {
  it('follows the visibility setting: Everyone, Followers, Only you', async () => {
    const owner = await createUser(app, 'Owner');
    const fan = await createUser(app, 'Fan');
    const stranger = await createUser(app, 'Stranger');
    await follow(app, fan, owner);

    const everyone = await manualActivity(app, owner, { km: 1 });
    await call(app, owner, 'PATCH', `/activities/${everyone.id}`, { visibility: 'everyone' });
    const followers = await manualActivity(app, owner, { km: 2 }); // the default
    const onlyMe = await manualActivity(app, owner, { km: 3 });
    await call(app, owner, 'PATCH', `/activities/${onlyMe.id}`, { visibility: 'only_me' });

    const sees = async (viewer: TestUser, id: string) => (await call(app, viewer, 'GET', `/activities/${id}`)).status === 200;
    expect(followers.visibility).toBe('followers');
    expect([await sees(fan, everyone.id), await sees(fan, followers.id), await sees(fan, onlyMe.id)]).toEqual([true, true, false]);
    expect([await sees(stranger, everyone.id), await sees(stranger, followers.id), await sees(stranger, onlyMe.id)]).toEqual([true, false, false]);
    expect(await sees(owner, onlyMe.id)).toBe(true);
  });

  it('hides the first and last 200 m of the route from everyone but the owner', async () => {
    const owner = await createUser(app, 'Home');
    const viewer = await createUser(app, 'Curious');
    const a = await recordActivity(app, owner, { km: 3, secondsPerKm: 300 });
    await call(app, owner, 'PATCH', `/activities/${a.id}`, { visibility: 'everyone' });

    const mine = (await call(app, owner, 'GET', `/activities/${a.id}`)).body;
    const theirs = (await call(app, viewer, 'GET', `/activities/${a.id}`)).body;
    // Same stats for both.
    expect(theirs.distanceMeters).toBe(mine.distanceMeters);
    // But the route they see starts at least 200 m from the real start, on the map and in the line.
    const realStart = mine.points[0];
    expect(distanceBetween(realStart, theirs.points[0])).toBeGreaterThanOrEqual(199);
    expect(distanceBetween(realStart, decodePolyline(theirs.polyline)[0])).toBeGreaterThanOrEqual(195);
    expect(distanceBetween(mine.points.at(-1), theirs.points.at(-1))).toBeGreaterThanOrEqual(199);
  });
});
