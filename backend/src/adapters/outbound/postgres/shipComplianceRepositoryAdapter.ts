import type { PrismaClient } from '@prisma/client';
import type {
  ShipComplianceRecord,
  ShipComplianceRepositoryPort,
} from '../../../core/application/ports/shipComplianceRepositoryPort.js';

function mapRow(row: {
  id: string
  ship_id: string
  year: number
  cb_gco2eq: { toNumber(): number }
}): ShipComplianceRecord {
  return {
    id: row.id,
    ship_id: row.ship_id,
    year: row.year,
    cb_gco2eq: row.cb_gco2eq.toNumber(),
  };
}

export class ShipComplianceRepositoryPrismaAdapter
  implements ShipComplianceRepositoryPort
{
  constructor(private readonly db: PrismaClient) {}

  async findAll(filter?: {
    ship_id?: string
    year?: number
  }): Promise<ShipComplianceRecord[]> {
    const rows = await this.db.shipCompliance.findMany({
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
      orderBy: [{ ship_id: 'asc' }, { year: 'asc' }],
    });
    return rows.map(mapRow);
  }
}
