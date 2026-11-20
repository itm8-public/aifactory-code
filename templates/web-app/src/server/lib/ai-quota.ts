import { and, count, eq, gt } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { aiUsage } from '../db/schema';

/**
 * Counts one AI request for the user and says whether it is within the hourly limit. The count
 * lives in PostgreSQL, so the limit holds across replicas.
 */
export async function takeAiQuota(app: FastifyInstance, userId: string): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [used] = await app.db
    .select({ n: count() })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gt(aiUsage.at, hourAgo)));
  if ((used?.n ?? 0) >= app.config.AI_REQUESTS_PER_USER_PER_HOUR) return false;
  await app.db.insert(aiUsage).values({ userId });
  return true;
}
