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

  app.post('/wechat-login', async (request, reply) => {
    const { code } = request.body as { code?: string };

    const result = await authService.wechatLogin(code || '');
    if (result.error) {
      return reply.status(400).send(error(result.error));
    }
    if (!result.registered || !result.user) {
      return reply.send(success({ registered: false }, '微信账号未绑定'));
    }

    const token = app.jwt.sign({ userId: result.user.id, username: result.user.username });
    return reply.send(success({ registered: true, user: result.user, token }, '登录成功'));
  });

  app.post('/wechat-register', async (request, reply) => {
    const { username, inviteCode, code } = request.body as {
      username?: string;
      inviteCode?: string;
      code?: string;
    };

    const result = await authService.registerByWechat(username || '', inviteCode || '', code || '');
    if (result.error) {
      return reply.status(400).send(error(result.error));
    }

    const token = app.jwt.sign({ userId: result.user!.id, username: result.user!.username });
    return reply.status(201).send(success({ user: result.user, token }, '注册成功'));
  });

  app.post('/wechat-bind', async (request, reply) => {
    const { username, password, code } = request.body as {
      username?: string;
      password?: string;
      code?: string;
    };

    const result = await authService.bindWechat(username || '', password || '', code || '');
    if (result.error) {
      return reply.status(400).send(error(result.error));
    }

    const token = app.jwt.sign({ userId: result.user!.id, username: result.user!.username });
    return reply.send(success({ user: result.user, token }, '绑定成功'));
  });

  app.get('/me', async (request, reply) => {
    const user = authService.getUserById(request.userId);
    if (!user) {
      return reply.status(404).send(error('用户不存在'));
    }
    return reply.send(success(user));
  });
}
