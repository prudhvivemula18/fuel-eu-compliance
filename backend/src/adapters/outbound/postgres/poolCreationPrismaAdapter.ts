import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type {
  PoolCreationPort,
  PoolMemberAllocation,
} from '../../../core/application/ports/poolCreationPort.js';

export class PoolCreationPrismaAdapter implements PoolCreationPort {
  constructor(private readonly db: PrismaClient) {}

  async createPoolWithAllocations(
    year: number,
    allocations: PoolMemberAllocation[],
  ): Promise<{ pool_id: string }> {
    const pool = await this.db.pool.create({
      data: {
        year,
        members: {
          create: allocations.map((a) => ({
            ship_id: a.ship_id,
            cb_before: new Prisma.Decimal(a.cb_before),
            cb_after: new Prisma.Decimal(a.cb_after),
          })),
        },
      },
    });
    return { pool_id: pool.id };
  }
}
