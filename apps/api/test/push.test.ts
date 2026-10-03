import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { pool } from '../src/db';
import { call, createUser, follow, manualActivity, startApp, type TestUser } from './helpers';

// Expo's push service, faked: records what would have been sent, and can report a phone as gone.
interface Sent { to: string; title: string; body: string; data: { url: string } }
let sent: Sent[] = [];
let goneTokens = new Set<string>();
beforeEach(() => {
  sent = [];
  goneTokens = new Set();
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    if (!String(url).startsWith('https://exp.host/')) throw new Error('Network is switched off in tests');
    const messages = JSON.parse(init.body) as Sent[];
    sent.push(...messages);
    const data = messages.map((m) => (goneTokens.has(m.to)
      ? { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }
      : { status: 'ok', id: 'ticket' }));
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
});

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

let n = 0;
const phone = () => `ExponentPushToken[test-phone-${Date.now()}-${n++}]`;
const register = (user: TestUser, token: string, platform = 'android') => call(app, user, 'PUT', '/me/push-token', { token, platform });
// Pushes go out in the background, so wait for them to arrive.
const waitForPush = (count = 1) => vi.waitFor(() => expect(sent.length).toBeGreaterThanOrEqual(count), { timeout: 5000 });

describe('registering a phone', () => {
  it('accepts an Expo push token and rejects anything else', async () => {
    expect((await register(bala, phone())).status).toBe(204);
    expect((await register(bala, 'not-a-token')).status).toBe(400);
    expect((await register(bala, phone(), 'windows')).status).toBe(400);
    expect((await call(app, null, 'PUT', '/me/push-token', { token: phone(), platform: 'android' })).status).toBe(401);
  });

  it('a phone belongs to whoever logged in on it last', async () => {
    const token = phone();
    await register(asha, token);
    await register(bala, token);
    const { rows } = await pool.query('SELECT user_id FROM push_tokens WHERE token = $1', [token]);
    expect(rows).toEqual([{ user_id: bala.id }]);
  });
});

describe('what gets pushed', () => {
  it('a new follower', async () => {
    const token = phone();
    await register(bala, token);
    await follow(app, asha, bala);
    await waitForPush();
    expect(sent[0]).toMatchObject({ to: token, title: 'New follower', body: 'Asha started following you', data: { url: `/athlete/${asha.id}` } });
  });

  it('kudos and comments, opening the activity', async () => {
    await register(bala, phone());
    await follow(app, asha, bala);
    await waitForPush();
    sent = [];
    const run = await manualActivity(app, bala, { km: 5 });
    await call(app, asha, 'POST', `/activities/${run.id}/kudos`);
    await call(app, asha, 'POST', `/activities/${run.id}/comments`, { body: 'Great pace!' });
    await waitForPush(2);
    expect(sent.map((m) => [m.title, m.body, m.data.url])).toEqual([
      ['Kudos!', `Asha gave you kudos on ${run.title}`, `/activity/${run.id}`],
      ['Asha commented', 'Great pace!', `/activity/${run.id}?show=comments`],
    ]);
  });

  it('a challenge invite', async () => {
    await register(bala, phone());
    await follow(app, asha, bala);
    await waitForPush();
    sent = [];
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
    const { body } = await call(app, asha, 'POST', '/custom-challenges?tz=UTC', {
      title: 'Weekend 20K', sport: 'run', metric: 'distance', goal: 20_000, startDate: today, endDate: today, inviteIds: [bala.id],
    });
    await waitForPush();
    expect(sent[0]).toMatchObject({ title: 'Challenge invite', body: 'Asha invited you to Weekend 20K', data: { url: `/challenge/${body.id}` } });
  });

  it('a chat message, with the sender as the title', async () => {
    await register(bala, phone());
    await follow(app, bala, asha);
    const chat = (await call(app, asha, 'POST', '/conversations', { athleteId: bala.id })).body;
    await call(app, asha, 'POST', `/conversations/${chat.id}/messages`, { body: 'Run tomorrow at 6?' });
    await waitForPush();
    expect(sent[0]).toMatchObject({ title: 'Asha', body: 'Run tomorrow at 6?' });
    expect(sent[0].data.url).toBe(`/messages/${chat.id}?name=Asha&otherId=${asha.id}`);
  });

  it('every phone of the person, and nobody else', async () => {
    const [p1, p2] = [phone(), phone()];
    await register(bala, p1);
    await register(bala, p2, 'ios');
    await register(asha, phone());
    await follow(app, asha, bala);
    await waitForPush(2);
    expect(sent.map((m) => m.to).sort()).toEqual([p1, p2].sort());
  });
});

describe('when not to push', () => {
  it('nothing after logging out on that phone', async () => {
    const token = phone();
    await register(bala, token);
    expect((await call(app, bala, 'DELETE', '/me/push-token', { token })).status).toBe(204);
    await follow(app, asha, bala);
    await new Promise((r) => setTimeout(r, 300));
    expect(sent).toEqual([]);
  });

  it('nothing between people who blocked each other', async () => {
    await register(bala, phone());
    await follow(app, bala, asha);
    const chat = (await call(app, asha, 'POST', '/conversations', { athleteId: bala.id })).body;
    await call(app, bala, 'POST', `/athletes/${asha.id}/block`);
    // An old chat still exists, but a message from the blocked person isn't pushed.
    await call(app, asha, 'POST', `/conversations/${chat.id}/messages`, { body: 'hello?' });
    await new Promise((r) => setTimeout(r, 300));
    expect(sent).toEqual([]);
  });

  it('stops sending to a phone that uninstalled the app', async () => {
    const token = phone();
    goneTokens.add(token);
    await register(bala, token);
    await follow(app, asha, bala);
    await waitForPush();
    await vi.waitFor(async () => {
      const { rowCount } = await pool.query('SELECT 1 FROM push_tokens WHERE token = $1', [token]);
      expect(rowCount).toBe(0);
    });
  });

  it("a push failure doesn't break the action that caused it", async () => {
    await register(bala, phone());
    vi.stubGlobal('fetch', async () => {
      throw new Error('push service down');
    });
    expect((await follow(app, asha, bala)).status).toBe(204);
    expect((await call(app, bala, 'GET', '/notifications')).body.map((x: { kind: string }) => x.kind)).toEqual(['follow']);
  });
});
