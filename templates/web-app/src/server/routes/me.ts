import type { FastifyInstance } from 'fastify';
import type { MeDto } from '../../shared/contracts';
import { userOf } from '../auth';

export async function meRoutes(app: FastifyInstance) {
  app.get('/api/me', async (req): Promise<MeDto> => {
    const { id, name, roles } = userOf(req);
    return { id, name, roles };
  });
}
