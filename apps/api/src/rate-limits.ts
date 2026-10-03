import type { FastifyRequest } from 'fastify';

// Rate limits, set per route with `config: { rateLimit: ... }` (see app.ts).
// - By visitor (IP address) for things done while logged out: login, sign-up, password reset.
// - By account for things logged-in people do, so a spammer can't flood comments or
//   messages, while normal use never comes close to the limits.

type Window = '1 minute' | '15 minutes' | '1 hour' | '1 day';

export const perIp = (max: number, timeWindow: Window) => ({ max, timeWindow });

// The account id from the login token (without fully checking it: the route's own
// authentication does that); falls back to the IP address.
function accountKey(req: FastifyRequest): string {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = req.server.jwt.decode<{ sub?: string }>(header.slice(7));
      if (payload?.sub) return `user:${payload.sub}`;
    } catch {
      // Not a readable token: limit by address instead.
    }
  }
  return `ip:${req.ip}`;
}

export const perAccount = (max: number, timeWindow: Window) => ({ max, timeWindow, keyGenerator: accountKey });

export const LIMITS = {
  login: perIp(10, '15 minutes'),
  signup: perIp(5, '1 hour'),
  passwordReset: perIp(5, '1 hour'),
  passwordResetCode: perIp(10, '15 minutes'),
  emailChange: perAccount(5, '1 hour'),
  emailChangeCode: perAccount(10, '15 minutes'),
  comment: perAccount(20, '1 minute'),
  message: perAccount(30, '1 minute'),
  newConversation: perAccount(15, '1 hour'),
  follow: perAccount(60, '1 minute'),
  followAll: perAccount(10, '1 hour'),
  kudos: perAccount(120, '1 minute'),
  report: perAccount(15, '1 hour'),
  newClub: perAccount(5, '1 hour'),
  newChallenge: perAccount(10, '1 hour'),
  challengeInvite: perAccount(30, '1 hour'),
  activity: perAccount(60, '1 hour'),
  routePlanning: perAccount(60, '1 minute'),
  errorReport: perIp(30, '1 minute'),
};
