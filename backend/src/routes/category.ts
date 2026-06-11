import type { FastifyInstance } from 'fastify';
import * as authService from '../services/auth.js';
import * as categoryService from '../services/category.js';
import { success, error } from '../utils/response.js';

function assertAdmin(userId: number) {
  return authService.isAdminUser(userId);
}

export async function categoryRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const result = categoryService.list(request.userId);
    if (result.error) return reply.status(400).send(error(result.error));
    return reply.send(success(result.categories));
  });

  app.post('/', async (request, reply) => {
    if (!assertAdmin(request.userId)) {
      return reply.status(403).send(error('只有管理员可以管理分类', 403));
    }

    const result = categoryService.create(request.userId, request.body as any);
    if (result.error) return reply.status(400).send(error(result.error));
    return reply.status(201).send(success(result.category, '创建成功'));
  });

  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    if (!assertAdmin(request.userId)) {
      return reply.status(403).send(error('只有管理员可以管理分类', 403));
    }

    const { id } = request.params;
    const result = categoryService.update(request.userId, Number(id), request.body as any);
    if (result.error) return reply.status(400).send(error(result.error));
    return reply.send(success(result.category, '保存成功'));
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    if (!assertAdmin(request.userId)) {
      return reply.status(403).send(error('只有管理员可以管理分类', 403));
    }

    const { id } = request.params;
    const result = categoryService.remove(request.userId, Number(id));
    if (result.error) return reply.status(400).send(error(result.error));
    return reply.send(success(null, '删除成功'));
  });
}
