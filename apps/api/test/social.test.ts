import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { call, createUser, follow, manualActivity, startApp, type TestUser } from './helpers';

let app: FastifyInstance;
let asha: TestUser;
let bala: TestUser;
beforeAll(async () => {
  app = await startApp();
});
afterAll(() => app.close());
beforeEach(async () => {
  asha = await createUser(app, 'Asha');
  bala = await createUser(app, 'Bala');
});

const kinds = async (user: TestUser) => (await call(app, user, 'GET', '/notifications')).body.map((n: { kind: string }) => n.kind);

describe('following', () => {
  it('follows and unfollows, and the other person is told', async () => {
    expect((await follow(app, asha, bala)).status).toBe(204);
    expect(await kinds(bala)).toEqual(['follow']);
    expect((await call(app, asha, 'GET', `/athletes/${bala.id}`)).body).toMatchObject({ isFollowing: true, followerCount: 1 });

    await call(app, asha, 'DELETE', `/athletes/${bala.id}/follow`);
    expect((await call(app, asha, 'GET', `/athletes/${bala.id}`)).body.isFollowing).toBe(false);
    // Unfollowing takes the notification back.
    expect(await kinds(bala)).toEqual([]);
  });

  it("can't follow yourself", async () => {
    expect((await follow(app, asha, asha)).status).toBe(400);
  });

  it('shows activities of people you follow in your feed, newest first', async () => {
    await follow(app, asha, bala);
    const older = await manualActivity(app, bala, { km: 5, hoursAgo: 5 });
    const newer = await manualActivity(app, bala, { km: 3, hoursAgo: 1 });
    const mine = await manualActivity(app, asha, { km: 2, hoursAgo: 3 });
    const feed = (await call(app, asha, 'GET', '/feed')).body.map((a: { id: string }) => a.id);
    expect(feed).toEqual([newer.id, mine.id, older.id]);
    // Someone who doesn't follow Bala doesn't get his activities in their feed.
    const other = await createUser(app, 'Other');
    expect((await call(app, other, 'GET', '/feed')).body).toEqual([]);
  });

  it('keeps "Only you" activities out of followers\' feeds and profile counts', async () => {
    await follow(app, asha, bala);
    const secret = await manualActivity(app, bala, { km: 9 });
    await call(app, bala, 'PATCH', `/activities/${secret.id}`, { visibility: 'only_me' });
    expect((await call(app, asha, 'GET', '/feed')).body).toEqual([]);
    expect((await call(app, asha, 'GET', `/athletes/${bala.id}`)).body.activityCount).toBe(0);
  });

  it('finds people by name', async () => {
    const res = await call(app, asha, 'GET', `/athletes/search?q=${encodeURIComponent('bal')}`);
    expect(res.body.map((p: { id: string }) => p.id)).toContain(bala.id);
  });
});

describe('kudos and comments', () => {
  it('gives kudos once, notifies the owner, and can be taken back', async () => {
    await follow(app, asha, bala);
    const run = await manualActivity(app, bala, { km: 5 });
    await call(app, asha, 'POST', `/activities/${run.id}/kudos`);
    await call(app, asha, 'POST', `/activities/${run.id}/kudos`);
    const seen = (await call(app, asha, 'GET', `/activities/${run.id}`)).body;
    expect(seen).toMatchObject({ kudosCount: 1, hasKudoed: true });
    expect(await kinds(bala)).toContain('kudos');

    await call(app, asha, 'DELETE', `/activities/${run.id}/kudos`);
    expect((await call(app, asha, 'GET', `/activities/${run.id}`)).body.kudosCount).toBe(0);
    expect(await kinds(bala)).not.toContain('kudos');
  });

  it("can't give kudos to yourself or to an activity you can't see", async () => {
    const run = await manualActivity(app, bala, { km: 5 });
    expect((await call(app, bala, 'POST', `/activities/${run.id}/kudos`)).status).toBe(400);
    expect((await call(app, asha, 'POST', `/activities/${run.id}/kudos`)).status).toBe(404);
  });

  it('comments, and the activity owner can delete any comment on it', async () => {
    await follow(app, asha, bala);
    const run = await manualActivity(app, bala, { km: 5 });
    const comment = await call(app, asha, 'POST', `/activities/${run.id}/comments`, { body: 'Great pace!' });
    expect(comment.status).toBe(201);
    expect(await kinds(bala)).toContain('comment');
    expect((await call(app, bala, 'GET', `/activities/${run.id}/comments`)).body[0].body).toBe('Great pace!');

    const stranger = await createUser(app, 'Stranger');
    expect((await call(app, stranger, 'DELETE', `/comments/${comment.body.id}`)).status).toBe(404);
    expect((await call(app, bala, 'DELETE', `/comments/${comment.body.id}`)).status).toBe(204);
    expect((await call(app, bala, 'GET', `/activities/${run.id}/comments`)).body).toEqual([]);
  });

  it('refuses empty comments', async () => {
    const run = await manualActivity(app, asha, { km: 1 });
    expect((await call(app, asha, 'POST', `/activities/${run.id}/comments`, { body: '   ' })).status).toBe(400);
  });

  it('counts unread notifications for the red dot, and opening them clears it', async () => {
    await follow(app, asha, bala);
    expect((await call(app, bala, 'GET', '/badges')).body.notifications).toBe(1);
    await call(app, bala, 'POST', '/notifications/read');
    expect((await call(app, bala, 'GET', '/badges')).body.notifications).toBe(0);
  });
});

describe('blocking and reporting', () => {
  it('blocking removes follows both ways and hides each person from the other', async () => {
    await follow(app, asha, bala);
    await follow(app, bala, asha);
    const run = await manualActivity(app, bala, { km: 5 });
    await call(app, bala, 'PATCH', `/activities/${run.id}`, { visibility: 'everyone' });

    expect((await call(app, bala, 'POST', `/athletes/${asha.id}/block`)).status).toBe(204);
    // Bala looks like he doesn't exist to Asha.
    expect((await call(app, asha, 'GET', `/athletes/${bala.id}`)).status).toBe(404);
    expect((await call(app, asha, 'GET', `/activities/${run.id}`)).status).toBe(404);
    expect((await follow(app, asha, bala)).status).toBe(404);
    expect((await call(app, asha, 'GET', `/athletes/search?q=bala`)).body.map((p: { id: string }) => p.id)).not.toContain(bala.id);
    // Nobody follows anybody any more.
    expect((await call(app, bala, 'GET', `/athletes/${asha.id}`)).body).toMatchObject({ isFollowing: false, followsYou: false, blockedByYou: true });
    expect((await call(app, bala, 'GET', '/me/blocked')).body.map((p: { id: string }) => p.id)).toEqual([asha.id]);

    await call(app, bala, 'DELETE', `/athletes/${asha.id}/block`);
    expect((await call(app, asha, 'GET', `/athletes/${bala.id}`)).status).toBe(200);
  });

  it('saves a report for review, but not one about yourself', async () => {
    expect((await call(app, asha, 'POST', '/reports', { targetUserId: bala.id, reason: 'spam' })).status).toBe(201);
    expect((await call(app, asha, 'POST', '/reports', { targetUserId: asha.id, reason: 'spam' })).status).toBe(400);
    expect((await call(app, asha, 'POST', '/reports', { targetUserId: bala.id, reason: 'made-up' })).status).toBe(400);
  });
});

describe('messages', () => {
  it('only lets people who follow each other (one way is enough) start a chat', async () => {
    expect((await call(app, asha, 'POST', '/conversations', { athleteId: bala.id })).status).toBe(403);
    await follow(app, bala, asha);
    const chat = await call(app, asha, 'POST', '/conversations', { athleteId: bala.id });
    expect(chat.status).toBe(201);
    // Opening it again reuses the same chat.
    expect((await call(app, bala, 'POST', '/conversations', { athleteId: asha.id })).body.id).toBe(chat.body.id);
  });

  it('sends messages, counts unread ones, and keeps strangers out', async () => {
    await follow(app, asha, bala);
    const chat = (await call(app, asha, 'POST', '/conversations', { athleteId: bala.id })).body;
    await call(app, asha, 'POST', `/conversations/${chat.id}/messages`, { body: 'Run tomorrow at 6?' });
    await call(app, asha, 'POST', `/conversations/${chat.id}/messages`, { body: 'Near the lake' });

    expect((await call(app, bala, 'GET', '/badges')).body.messages).toBe(2);
    const msgs = (await call(app, bala, 'GET', `/conversations/${chat.id}/messages`)).body;
    expect(msgs.map((m: { body: string }) => m.body)).toEqual(['Run tomorrow at 6?', 'Near the lake']);
    await call(app, bala, 'POST', `/conversations/${chat.id}/read`);
    expect((await call(app, bala, 'GET', '/badges')).body.messages).toBe(0);

    const stranger = await createUser(app, 'Snoop');
    expect((await call(app, stranger, 'GET', `/conversations/${chat.id}/messages`)).status).toBe(404);
    expect((await call(app, stranger, 'POST', `/conversations/${chat.id}/messages`, { body: 'hi' })).status).toBe(404);
  });

  it("can't message someone after a block", async () => {
    await follow(app, asha, bala);
    await call(app, bala, 'POST', `/athletes/${asha.id}/block`);
    expect((await call(app, asha, 'POST', '/conversations', { athleteId: bala.id })).status).toBe(403);
  });
});

describe('clubs', () => {
  it('creates a club, others join, and the weekly leaderboard ranks members by distance', async () => {
    const club = (await call(app, asha, 'POST', '/clubs', { name: 'Lake Runners', sport: 'run', location: 'Pune' })).body;
    expect(club).toMatchObject({ isOwner: true, isMember: true, memberCount: 1 });

    expect((await call(app, bala, 'POST', `/clubs/${club.id}/join`)).status).toBe(204);
    await manualActivity(app, asha, { km: 4, hoursAgo: 0.1 });
    await manualActivity(app, bala, { km: 10, hoursAgo: 0.1 });
    // A private run and a ride don't count on a running club's board.
    const secret = await manualActivity(app, asha, { km: 50, hoursAgo: 0.1 });
    await call(app, asha, 'PATCH', `/activities/${secret.id}`, { visibility: 'only_me' });
    await manualActivity(app, asha, { type: 'ride', km: 80, hoursAgo: 0.1 });

    const page = (await call(app, asha, 'GET', `/clubs/${club.id}`)).body;
    expect(page.memberCount).toBe(2);
    expect(page.leaderboard.map((l: { athlete: { name: string }; distanceMeters: number }) => [l.athlete.name, l.distanceMeters]))
      .toEqual([['Bala', 10000], ['Asha', 4000]]);
  });

  it("the creator can't leave their own club; members can", async () => {
    const club = (await call(app, asha, 'POST', '/clubs', { name: 'Hill Hikers', sport: 'hike' })).body;
    await call(app, bala, 'POST', `/clubs/${club.id}/join`);
    expect((await call(app, asha, 'DELETE', `/clubs/${club.id}/join`)).status).toBe(400);
    expect((await call(app, bala, 'DELETE', `/clubs/${club.id}/join`)).status).toBe(204);
    expect((await call(app, bala, 'GET', `/clubs/${club.id}`)).body.isMember).toBe(false);
  });
});
