import type { FastifyInstance } from 'fastify';
import * as authService from '../services/auth.js';
import { success, error } from '../utils/response.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const { username, password, inviteCode } = request.body as {
      username?: string;
      password?: string;
      inviteCode?: string;
    };

    const result = authService.register(username || '', password || '', inviteCode || '');
    if (result.error) {
      return reply.status(400).send(error(result.error));
    }

    const token = app.jwt.sign({ userId: result.user!.id, username: result.user!.username });
    return reply.status(201).send(success({ user: result.user, token }, '注册成功'));
  });

  app.post('/login', async (request, reply) => {
    const { username, password } = request.body as { username?: string; password?: string };

    const result = authService.login(username || '', password || '');
    if (result.error) {
      return reply.status(401).send(error(result.error, 401));
    }

    const token = app.jwt.sign({ userId: result.user!.id, username: result.user!.username });
    return reply.send(success({ user: result.user, token }, '登录成功'));
  });

  app.get('/me', async (request, reply) => {
    const user = authService.getUserById(request.userId);
    if (!user) {
      return reply.status(404).send(error('用户不存在'));
    }
    return reply.send(success(user));
  });
}
