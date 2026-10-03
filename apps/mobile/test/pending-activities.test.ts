import type { CreateActivityInput } from '@repo/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The phone's storage, kept in memory for the test.
const store = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));

// The server, faked: each test decides how uploads go.
const server = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message);
    }
  }
  return { ApiError, api: { createActivity: server.upload } };
});

const { addPending, clearPending, isRetryable, newClientId, onPendingUploaded, uploadPending } = await import('@/lib/pending-activities');
const { ApiError } = await import('@/lib/api');

const activity = (clientId: string): CreateActivityInput & { clientId: string } => ({
  type: 'run',
  title: `Run ${clientId}`,
  points: [
    { lat: 1, lng: 1, alt: null, t: 1 },
    { lat: 1.001, lng: 1, alt: null, t: 60_000 },
  ],
  clientId,
});
const waiting = (userId: string) => JSON.parse(store.get(`pending_activities_v1:${userId}`) ?? '[]').map((a: { clientId: string }) => a.clientId);

beforeEach(() => {
  store.clear();
  server.upload.mockReset();
});

describe('offline outbox', () => {
  it('uploads waiting activities oldest first and empties the outbox', async () => {
    await addPending('me', activity('a'));
    await addPending('me', activity('b'));
    server.upload.mockResolvedValue({});
    expect(await uploadPending('me')).toBe(2);
    expect(server.upload.mock.calls.map(([a]) => a.clientId)).toEqual(['a', 'b']);
    expect(waiting('me')).toEqual([]);
  });

  it('keeps everything when there is no signal, to try again later', async () => {
    await addPending('me', activity('a'));
    await addPending('me', activity('b'));
    server.upload.mockRejectedValue(new ApiError('offline', 0));
    expect(await uploadPending('me')).toBe(0);
    expect(waiting('me')).toEqual(['a', 'b']);
  });

  it('keeps activities when the server has a temporary problem or the login expired', async () => {
    await addPending('me', activity('a'));
    server.upload.mockRejectedValueOnce(new ApiError('down', 503));
    await uploadPending('me');
    server.upload.mockRejectedValueOnce(new ApiError('log in', 401));
    await uploadPending('me');
    expect(waiting('me')).toEqual(['a']);
  });

  it('drops an activity the server will never accept, and carries on with the rest', async () => {
    await addPending('me', activity('bad'));
    await addPending('me', activity('good'));
    server.upload.mockRejectedValueOnce(new ApiError('Not enough GPS points', 400)).mockResolvedValueOnce({});
    expect(await uploadPending('me')).toBe(1);
    expect(waiting('me')).toEqual([]);
  });

  it("never adds the same recording twice", async () => {
    await addPending('me', activity('a'));
    await addPending('me', activity('a'));
    expect(waiting('me')).toEqual(['a']);
  });

  it("keeps each account's outbox separate on a shared phone", async () => {
    await addPending('asha', activity('hers'));
    await addPending('bala', activity('his'));
    server.upload.mockResolvedValue({});
    await uploadPending('bala');
    expect(server.upload.mock.calls.map(([a]) => a.clientId)).toEqual(['his']);
    expect(waiting('asha')).toEqual(['hers']);
    await clearPending('asha');
    expect(waiting('asha')).toEqual([]);
  });

  it('runs only one upload at a time, even if asked twice', async () => {
    await addPending('me', activity('a'));
    server.upload.mockResolvedValue({});
    const [first, second] = await Promise.all([uploadPending('me'), uploadPending('me')]);
    expect(server.upload).toHaveBeenCalledTimes(1);
    expect([first, second]).toEqual([1, 1]);
  });

  it('tells the app when something was uploaded, so the feed can refresh', async () => {
    const listener = vi.fn();
    const stop = onPendingUploaded(listener);
    await addPending('me', activity('a'));
    server.upload.mockResolvedValue({});
    await uploadPending('me');
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('treats only connection and server errors as worth retrying', () => {
    expect(isRetryable(new ApiError('', 0))).toBe(true);
    expect(isRetryable(new ApiError('', 502))).toBe(true);
    expect(isRetryable(new ApiError('', 400))).toBe(false);
    expect(isRetryable(new Error('other'))).toBe(false);
  });

  it('makes a different tag for each recording', () => {
    const tags = new Set(Array.from({ length: 200 }, newClientId));
    expect(tags.size).toBe(200);
    expect([...tags].every((t) => t.length >= 8)).toBe(true);
  });
});
