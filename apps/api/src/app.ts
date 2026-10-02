import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { config } from './config';
import { activityRoutes } from './routes/activities';
import { authRoutes } from './routes/auth';
import { challengeRoutes } from './routes/challenges';
import { clubRoutes } from './routes/clubs';
import { heatmapRoutes, routeRoutes } from './routes/maps';
import { messageRoutes } from './routes/messages';
import { socialRoutes } from './routes/social';
import { statsRoutes } from './routes/stats';

// Tell TypeScript what we put inside login tokens.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    // `scope: 'tiles'` marks a short-lived key that can only load heatmap tiles.
    payload: { sub: string; scope?: 'tiles' };
    user: { sub: string; scope?: 'tiles' };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Allow the website (running on another port) to call this API.
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: '30d' } });

  // Add `onRequest: [app.authenticate]` to a route to require login.
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
      // A heatmap-tiles key must not work as a full login.
      if (req.user.scope) throw new Error('limited token');
    } catch {
      reply.code(401).send({ error: 'Please log in' });
    }
  });

  // Turns validation errors into a clear 400 response instead of a crash.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: err.issues[0]?.message ?? 'Invalid input', issues: err.issues });
    }
    app.log.error(err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.code(status).send({ error: status === 500 ? 'Something went wrong' : (err as Error).message });
  });

  app.get('/health', async () => ({ ok: true }));
  await app.register(authRoutes);
  await app.register(activityRoutes);
  await app.register(statsRoutes);
  await app.register(challengeRoutes);
  await app.register(routeRoutes);
  await app.register(heatmapRoutes);
  await app.register(socialRoutes);
  await app.register(messageRoutes);
  await app.register(clubRoutes);

  return app;
}
