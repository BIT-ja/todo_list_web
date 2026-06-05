import type { FastifyInstance } from 'fastify';
import { success } from '../utils/response.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    return reply.send(success({ status: 'up' }));
  });
}
