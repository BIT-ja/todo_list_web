import type { FastifyInstance } from 'fastify';
import * as todoService from '../services/todo.js';
import { success, error } from '../utils/response.js';
import type { ListQuery, CreateTodoInput, UpdateTodoInput, CreateCommentInput } from '../types/index.js';

export async function todoRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const { status, keyword, page, pageSize } = request.query as any;
    const query: ListQuery = {
      status: status || undefined,
      keyword: keyword || undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    };
    const result = todoService.list(request.userId, query);
    return reply.send(success(result));
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = todoService.getById(request.userId, Number(id));
    if (result.error) {
      return reply.status(404).send(error(result.error));
    }
    return reply.send(success(result.todo));
  });

  app.post('/', async (request, reply) => {
    const input = request.body as CreateTodoInput;
    const result = todoService.create(request.userId, input);
    if (result.error) {
      return reply.status(400).send(error(result.error));
    }
    return reply.status(201).send(success(result.todo));
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = request.body as UpdateTodoInput;
    const result = todoService.update(request.userId, Number(id), input);
    if (result.error) {
      return reply.status(400).send(error(result.error));
    }
    return reply.send(success(result.todo));
  });

  app.post<{ Params: { id: string } }>('/:id/complete', async (request, reply) => {
    const { id } = request.params;
    const result = todoService.complete(request.userId, Number(id));
    if (result.error) {
      return reply.status(400).send(error(result.error));
    }
    return reply.send(success(result.todo));
  });

  app.post<{ Params: { id: string } }>('/:id/uncomplete', async (request, reply) => {
    const { id } = request.params;
    const result = todoService.uncomplete(request.userId, Number(id));
    if (result.error) {
      return reply.status(400).send(error(result.error));
    }
    return reply.send(success(result.todo));
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const result = todoService.remove(request.userId, Number(id));
    if (result.error) {
      return reply.status(400).send(error(result.error));
    }
    return reply.send(success(null, '删除成功'));
  });

  // Pin / Unpin
  app.post<{ Params: { id: string } }>('/:id/pin', async (request, reply) => {
    const { id } = request.params;
    const result = todoService.pin(request.userId, Number(id));
    if (result.error) return reply.status(400).send(error(result.error));
    return reply.send(success(result.todo));
  });

  app.post<{ Params: { id: string } }>('/:id/unpin', async (request, reply) => {
    const { id } = request.params;
    const result = todoService.unpin(request.userId, Number(id));
    if (result.error) return reply.status(400).send(error(result.error));
    return reply.send(success(result.todo));
  });

  // Urgent / Unurgent
  app.post<{ Params: { id: string } }>('/:id/urgent', async (request, reply) => {
    const { id } = request.params;
    const result = todoService.urgent(request.userId, Number(id));
    if (result.error) return reply.status(400).send(error(result.error));
    return reply.send(success(result.todo));
  });

  app.post<{ Params: { id: string } }>('/:id/unurgent', async (request, reply) => {
    const { id } = request.params;
    const result = todoService.unurgent(request.userId, Number(id));
    if (result.error) return reply.status(400).send(error(result.error));
    return reply.send(success(result.todo));
  });

  // Comments
  app.get<{ Params: { id: string } }>('/:id/comments', async (request, reply) => {
    const { id } = request.params;
    const result = todoService.listComments(request.userId, Number(id));
    if (result.error) return reply.status(400).send(error(result.error));
    return reply.send(success(result.comments));
  });

  app.post<{ Params: { id: string } }>('/:id/comments', async (request, reply) => {
    const { id } = request.params;
    const input = request.body as CreateCommentInput;
    const result = todoService.addComment(request.userId, Number(id), input);
    if (result.error) return reply.status(400).send(error(result.error));
    return reply.status(201).send(success(result.comment));
  });

  app.delete<{ Params: { id: string; commentId: string } }>('/:id/comments/:commentId', async (request, reply) => {
    const { commentId } = request.params;
    const result = todoService.deleteComment(request.userId, Number(commentId));
    if (result.error) return reply.status(400).send(error(result.error));
    return reply.send(success(null, '删除成功'));
  });
}
