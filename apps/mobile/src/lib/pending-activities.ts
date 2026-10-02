import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CreateActivityInput } from '@repo/shared';

import { api, ApiError } from './api';

// An outbox for recorded activities that couldn't be uploaded (no signal at the end of a run,
// or the server was down). They wait safely on the phone and upload by themselves later,
// so a recording is never lost. Each one carries a clientId, so if an upload did reach the
// server but the reply got lost, sending it again won't create a duplicate.

const KEY = 'pending_activities_v1';

export type PendingActivity = CreateActivityInput & { clientId: string };

// A unique-enough tag for one recording on this phone.
export function newClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// Worth keeping and retrying: the server was unreachable (0) or had a temporary problem (5xx).
export function isRetryable(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status >= 500);
}

async function read(): Promise<PendingActivity[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as PendingActivity[]) : [];
}

async function write(list: PendingActivity[]): Promise<void> {
  if (list.length) await AsyncStorage.setItem(KEY, JSON.stringify(list));
  else await AsyncStorage.removeItem(KEY);
}

export async function addPending(activity: PendingActivity): Promise<void> {
  const list = await read();
  if (!list.some((a) => a.clientId === activity.clientId)) list.push(activity);
  await write(list);
}

const listeners = new Set<() => void>();

// Called after at least one waiting activity was uploaded (e.g. to refresh the feed).
export function onPendingUploaded(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let running: Promise<number> | null = null;

// Tries to upload everything in the outbox, oldest first. Stops at the first connection
// problem and tries again next time. Returns how many were uploaded.
export function uploadPending(): Promise<number> {
  running ??= (async () => {
    let uploaded = 0;
    try {
      for (const activity of await read()) {
        try {
          await api.createActivity(activity);
          uploaded++;
        } catch (err) {
          // Offline, server trouble, or logged out: keep everything and try again later.
          if (isRetryable(err) || (err instanceof ApiError && err.status === 401)) break;
          // Anything else (e.g. too few GPS points) will never succeed, so stop retrying it.
        }
        await write((await read()).filter((a) => a.clientId !== activity.clientId));
      }
    } finally {
      running = null;
    }
    if (uploaded) listeners.forEach((l) => l());
    return uploaded;
  })();
  return running;
}
