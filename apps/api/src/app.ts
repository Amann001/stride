import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { errorReportSchema } from '@repo/shared';

import { config } from './config';
import { pool } from './db';
import { LIMITS } from './rate-limits';
import { activityRoutes } from './routes/activities';
import { authRoutes } from './routes/auth';
import { challengeRoutes } from './routes/challenges';
import { customChallengeRoutes } from './routes/custom-challenges';
import { clubRoutes } from './routes/clubs';
import { legalRoutes } from './routes/legal';
import { heatmapRoutes, routeRoutes } from './routes/maps';
import { messageRoutes } from './routes/messages';
import { socialRoutes } from './routes/social';
import { statsRoutes } from './routes/stats';

// Tell TypeScript what we put inside login tokens.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    // `scope: 'tiles'` marks a short-lived key that can only load heatmap tiles.
    // `tv` is the account's token version (see users.token_version): a password change bumps
    // it, so logins made before the change stop working on every phone.
    payload: { sub: string; scope?: 'tiles'; tv?: number };
    user: { sub: string; scope?: 'tiles'; tv?: number };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildApp() {
  // trustProxy: in the cloud, Render's load balancer sits in front of us, so the visitor's real
  // address arrives in X-Forwarded-For. Needed for per-person rate limits.
  const app = Fastify({
    trustProxy: true,
    // No request logs while the automated tests run (Vitest sets VITEST).
    logger: process.env.VITEST ? false : {
      // Request logs never include the heatmap access key that map tiles carry in their URL.
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url.replace(/([?&]token=)[^&]*/g, '$1[hidden]'),
          remoteAddress: req.ip,
        }),
      },
    },
  });

  // Allow the website (running on another port) to call this API.
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: '30d' } });
  // Limits are switched on per route (login, sign-up, account deletion), not everywhere.
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too many attempts. Please wait a few minutes and try again.',
    }),
  });

  // Add `onRequest: [app.authenticate]` to a route to require login.
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
      // A heatmap-tiles key must not work as a full login.
      if (req.user.scope) throw new Error('limited token');
      // A deleted account's login stops working straight away, not when it expires, and so
      // does a login from before a password change.
      const { rows } = await pool.query<{ token_version: number }>('SELECT token_version FROM users WHERE id = $1', [req.user.sub]);
      if (!rows[0]) throw new Error('account deleted');
      if ((req.user.tv ?? 0) !== rows[0].token_version) throw new Error('logged out by a password change');
    } catch {
      reply.code(401).send({ error: 'Please log in' });
    }
  });

  // Turns validation errors into a clear 400 response instead of a crash.
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: err.issues[0]?.message ?? 'Invalid input', issues: err.issues });
    }
    app.log.error(err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    // Unexpected server errors are saved so they can be found and fixed (no request bodies).
    if (status >= 500) {
      const e = err as Error;
      pool
        .query("INSERT INTO error_reports (source, message, stack, context) VALUES ('server', $1, $2, $3)", [
          (e.message ?? String(err)).slice(0, 2000),
          e.stack?.slice(0, 8000) ?? null,
          { method: req.method, route: req.routeOptions?.url ?? null },
        ])
        .catch(() => {});
    }
    return reply.code(status).send({ error: status === 500 ? 'Something went wrong' : (err as Error).message });
  });

  // Unknown addresses: answer 404 without Fastify's default message, which writes the full
  // URL (including any ?token=) into the logs.
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'Not found' }));

  app.get('/health', async () => ({ ok: true }));

  // Crash and error reports from the app (logged in or not). Anonymous: no account or location.
  app.post('/diagnostics/errors', { config: { rateLimit: LIMITS.errorReport } }, async (req, reply) => {
    const input = errorReportSchema.parse(req.body);
    await pool.query("INSERT INTO error_reports (source, message, stack, context) VALUES ('app', $1, $2, $3)", [
      input.message,
      input.stack ?? null,
      input.context ?? {},
    ]);
    return reply.code(204).send();
  });

  await app.register(legalRoutes);
  await app.register(authRoutes);
  await app.register(activityRoutes);
  await app.register(statsRoutes);
  await app.register(challengeRoutes);
  await app.register(customChallengeRoutes);
  await app.register(routeRoutes);
  await app.register(heatmapRoutes);
  await app.register(socialRoutes);
  await app.register(messageRoutes);
  await app.register(clubRoutes);

  return app;
}
