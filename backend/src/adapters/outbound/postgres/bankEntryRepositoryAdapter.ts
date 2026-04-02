import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type {
  BankEntryRecord,
  BankEntryRepositoryPort,
} from '../../../core/application/ports/bankEntryRepositoryPort.js';

function mapRow(row: {
  id: string
  ship_id: string
  year: number
  amount_gco2eq: { toNumber(): number }
}): BankEntryRecord {
  return {
    id: row.id,
    ship_id: row.ship_id,
    year: row.year,
    amount_gco2eq: row.amount_gco2eq.toNumber(),
  };
}

export class BankEntryRepositoryPrismaAdapter implements BankEntryRepositoryPort {
  constructor(private readonly db: PrismaClient) {}

  async findAll(filter?: {
    ship_id?: string
    year?: number
  }): Promise<BankEntryRecord[]> {
    const rows = await this.db.bankEntry.findMany({
      where: {
        ...(filter?.ship_id !== undefined
          ? {
              ship_id: {
                equals: filter.ship_id,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(filter?.year !== undefined ? { year: filter.year } : {}),
      },
      orderBy: [{ ship_id: 'asc' }, { year: 'asc' }, { id: 'asc' }],
    });
    return rows.map(mapRow);
  }

  async create(input: {
    ship_id: string
    year: number
    amount_gco2eq: number
  }): Promise<BankEntryRecord> {
    const row = await this.db.bankEntry.create({
      data: {
        ship_id: input.ship_id,
        year: input.year,
        amount_gco2eq: new Prisma.Decimal(input.amount_gco2eq),
      },
    });
    return mapRow(row);
  }

  async sumAmountForShipYear(ship_id: string, year: number): Promise<number> {
    const agg = await this.db.bankEntry.aggregate({
      where: {
        ship_id: { equals: ship_id, mode: 'insensitive' },
        year,
      },
      _sum: { amount_gco2eq: true },
    });
    return agg._sum.amount_gco2eq?.toNumber() ?? 0;
  }
}
