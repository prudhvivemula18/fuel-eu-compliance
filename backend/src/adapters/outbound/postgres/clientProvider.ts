import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../../infrastructure/db/client.js';

/**
 * Outbound PostgreSQL adapter: Prisma access for repository implementations
 * that satisfy core/application/ports. Connection lifecycle lives in infrastructure/db.
 */
export function getPostgresPrismaClient(): PrismaClient {
  return getPrismaClient();
}
