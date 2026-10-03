import { beforeEach, describe, expect, it, vi } from 'vitest';

// Everything push touches on the phone, faked so each test can set the scene.
const env = vi.hoisted(() => ({
  os: 'android' as 'android' | 'ios' | 'web',
  isDevice: true,
  execution: 'standalone',
  permission: 'granted' as 'granted' | 'denied',
  askAnswer: 'granted' as 'granted' | 'denied',
  store: new Map<string, string>(),
  saved: [] as [string, string][],
  removed: [] as string[],
  asked: 0,
}));

vi.mock('react-native', () => ({ Platform: { get OS() { return env.os; } } }));
vi.mock('expo-device', () => ({ get isDevice() { return env.isDevice; } }));
vi.mock('expo-constants', () => ({
  ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone' },
  default: {
    get executionEnvironment() { return env.execution; },
    expoConfig: { extra: { eas: { projectId: 'project-123' } } },
  },
}));
vi.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  DEFAULT_ACTION_IDENTIFIER: 'default',
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(async () => null),
  getPermissionsAsync: async () => ({ status: env.permission }),
  requestPermissionsAsync: async () => {
    env.asked++;
    return { status: env.askAnswer };
  },
  getExpoPushTokenAsync: async ({ projectId }: { projectId: string }) => ({ data: `ExponentPushToken[for-${projectId}]` }),
  useLastNotificationResponse: () => null,
}));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('@/lib/storage', () => ({
  storage: {
    get: async (k: string) => env.store.get(k) ?? null,
    set: async (k: string, v: string) => void env.store.set(k, v),
    remove: async (k: string) => void env.store.delete(k),
  },
}));
vi.mock('@/lib/api', () => ({
  api: {
    savePushToken: async (token: string, platform: string) => void env.saved.push([token, platform]),
    removePushToken: async (token: string) => void env.removed.push(token),
  },
}));

const { registerForPush, unregisterPush } = await import('@/lib/push');

beforeEach(() => {
  Object.assign(env, { os: 'android', isDevice: true, execution: 'standalone', permission: 'granted', askAnswer: 'granted', asked: 0 });
  env.store.clear();
  env.saved = [];
  env.removed = [];
});

describe('signing up the phone for push', () => {
  it('sends this phone\'s push address to the server in the real app', async () => {
    await registerForPush();
    expect(env.saved).toEqual([['ExponentPushToken[for-project-123]', 'android']]);
    expect(env.store.get('push_token')).toBe('ExponentPushToken[for-project-123]');
  });

  it('asks for permission only if it was not given yet, and respects a no', async () => {
    env.permission = 'denied';
    env.askAnswer = 'denied';
    await registerForPush();
    expect(env.asked).toBe(1);
    expect(env.saved).toEqual([]);
  });

  it('does nothing in Expo Go, on a simulator, or on the web', async () => {
    for (const scene of [{ execution: 'storeClient' }, { isDevice: false }, { os: 'web' as const }]) {
      Object.assign(env, { os: 'android', isDevice: true, execution: 'standalone' }, scene);
      await registerForPush();
    }
    expect(env.saved).toEqual([]);
    expect(env.asked).toBe(0);
  });
});

describe('logging out', () => {
  it('tells the server to stop pushing to this phone', async () => {
    await registerForPush();
    await unregisterPush();
    expect(env.removed).toEqual(['ExponentPushToken[for-project-123]']);
    expect(env.store.has('push_token')).toBe(false);
  });

  it('is harmless when the phone never signed up', async () => {
    await unregisterPush();
    expect(env.removed).toEqual([]);
  });
});
