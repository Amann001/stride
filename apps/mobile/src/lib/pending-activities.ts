import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CreateActivityInput } from '@repo/shared';

import { api, ApiError } from './api';

// An outbox for recorded activities that couldn't be uploaded (no signal at the end of a run,
// or the server was down). They wait safely on the phone and upload by themselves later,
// so a recording is never lost. Each one carries a clientId, so if an upload did reach the
// server but the reply got lost, sending it again won't create a duplicate.
//
// There's one outbox per account, so if someone else logs in on the same phone, your
// waiting activities are never uploaded to their account.

const keyFor = (userId: string) => `pending_activities_v1:${userId}`;

export type PendingActivity = CreateActivityInput & { clientId: string };

// A unique-enough tag for one recording on this phone.
export function newClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// Worth keeping and retrying: the server was unreachable (0) or had a temporary problem (5xx).
export function isRetryable(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status >= 500);
}

async function read(userId: string): Promise<PendingActivity[]> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  return raw ? (JSON.parse(raw) as PendingActivity[]) : [];
}

async function write(userId: string, list: PendingActivity[]): Promise<void> {
  if (list.length) await AsyncStorage.setItem(keyFor(userId), JSON.stringify(list));
  else await AsyncStorage.removeItem(keyFor(userId));
}

export async function addPending(userId: string, activity: PendingActivity): Promise<void> {
  const list = await read(userId);
  if (!list.some((a) => a.clientId === activity.clientId)) list.push(activity);
  await write(userId, list);
}

// Throws away an account's waiting activities (used when the account is deleted).
export async function clearPending(userId: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(userId));
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

// Tries to upload the logged-in account's outbox, oldest first. Stops at the first
// connection problem and tries again next time. Returns how many were uploaded.
export function uploadPending(userId: string): Promise<number> {
  running ??= (async () => {
    let uploaded = 0;
    try {
      for (const activity of await read(userId)) {
        try {
          await api.createActivity(activity);
          uploaded++;
        } catch (err) {
          // Offline, server trouble, or logged out: keep everything and try again later.
          if (isRetryable(err) || (err instanceof ApiError && err.status === 401)) break;
          // Anything else (e.g. too few GPS points) will never succeed, so stop retrying it.
        }
        await write(userId, (await read(userId)).filter((a) => a.clientId !== activity.clientId));
      }
    } finally {
      running = null;
    }
    if (uploaded) listeners.forEach((l) => l());
    return uploaded;
  })();
  return running;
}
