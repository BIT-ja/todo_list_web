import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { initDatabase } from './db/init.js';
import { authRoutes } from './routes/auth.js';
import { todoRoutes } from './routes/todo.js';
import { healthRoutes } from './routes/health.js';
import { error } from './utils/response.js';

const JWT_SECRET = process.env.JWT_SECRET || 'todo-app-secret-change-in-production';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  await app.register(jwt, { secret: JWT_SECRET });

  app.decorateRequest('userId', 0);

  app.addHook('onRequest', async (request, reply) => {
    if (
      request.url === '/api/health' ||
      request.url === '/api/auth/register' ||
      request.url === '/api/auth/login'
    ) {
      return;
    }

    if (!request.url.startsWith('/api/')) {
      return;
    }

    try {
      const payload = await request.jwtVerify<{ userId: number }>();
      request.userId = payload.userId;
    } catch {
      reply.status(401).send(error('未登录或 token 已过期', 401));
    }
  });

  app.setErrorHandler((err: FastifyError, _request, reply) => {
    app.log.error(err);
    const code = err.statusCode || 500;
    const message = code === 500 ? '服务器内部错误' : err.message;
    reply.status(code).send(error(message, code));
  });

  initDatabase();

  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(todoRoutes, { prefix: '/api/todos' });
  app.register(healthRoutes, { prefix: '/api' });

  return app;
}
