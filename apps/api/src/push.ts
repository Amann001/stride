import type { NotificationKind } from '@repo/shared';

import { noBlockBetween } from './activity-sql';
import { pool } from './db';

// Push notifications to phones, through Expo's free push service. The app registers its
// phone (see /me/push-token); here we look up a person's phones and send to all of them.
// Sending never holds up the request that caused it, and a failure is only logged: the
// notification is still in the app's list either way.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  // Where the app opens when the notification is tapped, e.g. "/activity/<id>".
  url: string;
}

interface Ticket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

const short = (text: string, max = 120) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// Sends `message` to every phone of `userId`, unless they and `actorId` have blocked each other.
export async function pushTo(userId: string, actorId: string, message: PushMessage): Promise<void> {
  const { rows } = await pool.query<{ token: string }>(
    `SELECT t.token FROM push_tokens t WHERE t.user_id = $1 AND ${noBlockBetween('$1', '$2')}`,
    [userId, actorId],
  );
  if (!rows.length) return;
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      rows.map((r) => ({
        to: r.token,
        title: message.title,
        body: short(message.body),
        data: { url: message.url },
        sound: 'default',
        channelId: 'default',
        priority: 'high',
      })),
    ),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Expo push answered ${res.status}`);
  const tickets = ((await res.json()) as { data?: Ticket[] }).data ?? [];
  // A phone that uninstalled the app or turned notifications off: stop sending to it.
  const gone = rows.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered').map((r) => r.token);
  if (gone.length) await pool.query('DELETE FROM push_tokens WHERE token = ANY($1)', [gone]);
}

// The same as pushTo, in the background: errors are logged, never thrown.
export function pushInBackground(userId: string, actorId: string, message: PushMessage | Promise<PushMessage | null>) {
  Promise.resolve(message)
    .then((m) => (m ? pushTo(userId, actorId, m) : undefined))
    .catch((err) => console.warn('Push notification not sent:', (err as Error).message));
}

// The push for an in-app notification: "Asha gave you kudos on Morning Run".
export async function messageFor(
  actorId: string,
  kind: NotificationKind,
  ids: { activityId?: string | null; commentId?: string | null; challengeId?: string | null },
): Promise<PushMessage | null> {
  const { rows } = await pool.query<{ actor: string; activity: string | null; comment: string | null; challenge: string | null }>(
    `SELECT (SELECT name FROM users WHERE id = $1) AS actor,
       (SELECT title FROM activities WHERE id = $2) AS activity,
       (SELECT body FROM comments WHERE id = $3) AS comment,
       (SELECT title FROM custom_challenges WHERE id = $4) AS challenge`,
    [actorId, ids.activityId ?? null, ids.commentId ?? null, ids.challengeId ?? null],
  );
  const r = rows[0];
  if (!r?.actor) return null;
  switch (kind) {
    case 'follow':
      return { title: 'New follower', body: `${r.actor} started following you`, url: `/athlete/${actorId}` };
    case 'kudos':
      return { title: 'Kudos!', body: `${r.actor} gave you kudos on ${r.activity ?? 'your activity'}`, url: `/activity/${ids.activityId}` };
    case 'comment':
      return { title: `${r.actor} commented`, body: r.comment ?? `On ${r.activity ?? 'your activity'}`, url: `/activity/${ids.activityId}?show=comments` };
    case 'challenge_invite':
      return { title: 'Challenge invite', body: `${r.actor} invited you to ${r.challenge ?? 'a challenge'}`, url: `/challenge/${ids.challengeId}` };
  }
}
