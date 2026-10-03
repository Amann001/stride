import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { call, createUser, follow, manualActivity, recordActivity, startApp, type TestUser } from './helpers';

const TZ = 'tz=Asia%2FKolkata';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const plusDays = (n: number) => new Date(Date.parse(`${today()}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);

let app: FastifyInstance;
beforeAll(async () => {
  app = await startApp();
});
afterAll(() => app.close());

describe('monthly challenges', () => {
  it("lists this month's 7 challenges", async () => {
    const user = await createUser(app, 'Viewer');
    const { body } = await call(app, user, 'GET', `/challenges?${TZ}`);
    expect(body.current).toHaveLength(7);
    expect(body.current.every((c: { id: string; custom: unknown }) => c.id.startsWith(thisMonth()) && c.custom === null)).toBe(true);
  });

  it('fills the progress bar from your activities, and a finished one goes in the trophy case', async () => {
    const user = await createUser(app, 'Joiner');
    const id = `${thisMonth()}:run-5k`;
    expect((await call(app, user, 'POST', `/challenges/${encodeURIComponent(id)}/join?${TZ}`)).status).toBe(204);
    let mine = (await call(app, user, 'GET', `/challenges?${TZ}`)).body.current.find((c: { id: string }) => c.id === id);
    expect(mine).toMatchObject({ joined: true, progress: 0, completed: false, participants: 1 });

    await manualActivity(app, user, { km: 5.2, hoursAgo: 0.05 });
    const after = (await call(app, user, 'GET', `/challenges?${TZ}`)).body;
    mine = after.current.find((c: { id: string }) => c.id === id);
    expect(mine).toMatchObject({ progress: 5200, completed: true });
    expect(after.completed.map((c: { id: string }) => c.id)).toContain(id);
  });

  it("can't join last month's challenge, or one that doesn't exist", async () => {
    const user = await createUser(app, 'Late');
    expect((await call(app, user, 'POST', `/challenges/${encodeURIComponent('2020-01:run-5k')}/join?${TZ}`)).status).toBe(400);
    expect((await call(app, user, 'POST', `/challenges/${encodeURIComponent(`${thisMonth()}:run-9000k`)}/join?${TZ}`)).status).toBe(400);
  });
});

describe('creating your own challenge', () => {
  let asha: TestUser, bala: TestUser, chen: TestUser, dev: TestUser;
  beforeEach(async () => {
    [asha, bala, chen, dev] = await Promise.all(['Asha', 'Bala', 'Chen', 'Dev'].map((n) => createUser(app, n)));
    await follow(app, asha, bala);
    await follow(app, asha, chen);
  });

  const create = (user: TestUser, body: Record<string, unknown>) => call(app, user, 'POST', `/custom-challenges?${TZ}`, {
    title: 'Diwali 25K', sport: 'run', metric: 'distance', goal: 25_000, startDate: today(), endDate: plusDays(20), ...body,
  });

  it('checks the form: name, dates, length and goal', async () => {
    expect((await create(asha, { title: 'X' })).body.error).toMatch(/name/);
    expect((await create(asha, { endDate: plusDays(100) })).body.error).toMatch(/3 months/);
    expect((await create(asha, { startDate: plusDays(-2) })).body.error).toMatch(/past/);
    expect((await create(asha, { startDate: plusDays(70), endDate: plusDays(75) })).body.error).toMatch(/2 months/);
    expect((await create(asha, { metric: 'activeDays', goal: 9, endDate: plusDays(4) })).body.error).toMatch(/up to 5/);
    expect((await create(asha, { goal: 0 })).status).toBe(400);
  });

  it('invites only people the creator follows, and they get a notification', async () => {
    const res = await create(asha, { inviteIds: [bala.id, chen.id, dev.id] });
    expect(res.status).toBe(201);
    const page = (await call(app, asha, 'GET', `/custom-challenges/${res.body.id}`)).body;
    expect(page.invited.map((p: { id: string }) => p.id).sort()).toEqual([bala.id, chen.id].sort());
    expect(page).toMatchObject({ isCreator: true, joined: true, participants: 1 });
    expect(page.description).toBe(`Run a total of 25.00 km from ${Number(today().slice(8))} ${new Date(`${today()}T00:00:00Z`).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })} to ${Number(plusDays(20).slice(8))} ${new Date(`${plusDays(20)}T00:00:00Z`).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}.`);

    const note = (await call(app, bala, 'GET', '/notifications')).body.find((n: { kind: string }) => n.kind === 'challenge_invite');
    expect(note).toMatchObject({ actor: { id: asha.id }, challenge: { id: res.body.id, title: 'Diwali 25K' } });
    // Someone who wasn't invited can't see it.
    expect((await call(app, dev, 'GET', `/custom-challenges/${res.body.id}`)).status).toBe(404);
  });

  it('counts everyone between the dates, but not other sports or "Only you" activities', async () => {
    const { id } = (await create(asha, { inviteIds: [bala.id] })).body;
    await call(app, bala, 'POST', `/custom-challenges/${id}/join`);
    await manualActivity(app, asha, { km: 6, hoursAgo: 0.05 });
    await manualActivity(app, bala, { km: 12, hoursAgo: 0.05 });
    await manualActivity(app, bala, { type: 'ride', km: 40, hoursAgo: 0.05 });
    const secret = await manualActivity(app, bala, { km: 30, hoursAgo: 0.05 });
    await call(app, bala, 'PATCH', `/activities/${secret.id}`, { visibility: 'only_me' });

    const page = (await call(app, bala, 'GET', `/custom-challenges/${id}`)).body;
    expect(page.progress).toBe(12_000);
    expect(page.leaderboard.map((l: { athlete: { id: string }; progress: number }) => [l.athlete.id, l.progress]))
      .toEqual([[bala.id, 12_000], [asha.id, 6_000]]);
  });

  it('accept, decline, invite more, leave and delete', async () => {
    const { id } = (await create(asha, { inviteIds: [bala.id, chen.id] })).body;
    // Invited people show it as an invite in their list.
    const listed = (await call(app, bala, 'GET', `/challenges?${TZ}`)).body.custom.find((c: { id: string }) => c.id === id);
    expect(listed.custom).toMatchObject({ invited: true, status: 'active', creator: { id: asha.id } });

    expect((await call(app, bala, 'POST', `/custom-challenges/${id}/invite`, { ids: [asha.id] })).status).toBe(403);
    expect((await call(app, bala, 'POST', `/custom-challenges/${id}/join`)).status).toBe(204);
    expect((await call(app, chen, 'DELETE', `/custom-challenges/${id}/join`)).status).toBe(204);
    expect((await call(app, chen, 'GET', `/custom-challenges/${id}`)).status).toBe(404);

    expect((await call(app, asha, 'DELETE', `/custom-challenges/${id}/join`)).status).toBe(400);
    expect((await call(app, asha, 'POST', `/custom-challenges/${id}/invite`, { ids: [chen.id] })).status).toBe(204);
    expect((await call(app, bala, 'DELETE', `/custom-challenges/${id}/join`)).status).toBe(204);

    expect((await call(app, bala, 'DELETE', `/custom-challenges/${id}`)).status).toBe(404);
    expect((await call(app, asha, 'DELETE', `/custom-challenges/${id}`)).status).toBe(204);
    expect((await call(app, chen, 'GET', `/custom-challenges/${id}`)).status).toBe(404);
    // Its invite notifications go with it.
    expect((await call(app, chen, 'GET', '/notifications')).body.some((n: { challenge: { id: string } | null }) => n.challenge?.id === id)).toBe(false);
  });

  it('a finished challenge goes in the trophy case', async () => {
    const { id } = (await create(asha, { title: 'Quick 3K', goal: 3_000 })).body;
    await recordActivity(app, asha, { km: 3.1, secondsPerKm: 300, start: new Date(Date.now() - 30 * 60_000) });
    const list = (await call(app, asha, 'GET', `/challenges?${TZ}`)).body;
    expect(list.completed.map((c: { id: string }) => c.id)).toContain(id);
  });

  it('an upcoming challenge starts later and counts nothing yet', async () => {
    const { id } = (await create(asha, { startDate: plusDays(3), endDate: plusDays(10), metric: 'activeDays', sport: null, goal: 5 })).body;
    await manualActivity(app, asha, { km: 2, hoursAgo: 0.05 });
    const page = (await call(app, asha, 'GET', `/custom-challenges/${id}`)).body;
    expect(page.custom.status).toBe('upcoming');
    expect(page.progress).toBe(0);
    expect(page.description).toMatch(/^Be active on 5 days from /);
  });

  it("blocking the creator hides their challenge from you", async () => {
    const { id } = (await create(asha, { inviteIds: [bala.id] })).body;
    await call(app, bala, 'POST', `/athletes/${asha.id}/block`);
    expect((await call(app, bala, 'GET', `/challenges?${TZ}`)).body.custom.some((c: { id: string }) => c.id === id)).toBe(false);
  });
});
