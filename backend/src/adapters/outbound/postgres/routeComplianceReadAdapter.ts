import type { PrismaClient } from '@prisma/client';
import type {
  RouteComplianceReadPort,
  RouteForCompliance,
} from '../../../core/application/ports/routeComplianceReadPort.js';

function mapRow(row: {
  route_id: string
  ghg_intensity: { toNumber(): number }
  fuel_consumption: number
}): RouteForCompliance {
  return {
    route_id: row.route_id,
    ghg_intensity: row.ghg_intensity.toNumber(),
    fuel_consumption: row.fuel_consumption,
  };
}

export class RouteComplianceReadPrismaAdapter implements RouteComplianceReadPort {
  constructor(private readonly db: PrismaClient) {}

  async findByRouteId(routeId: string): Promise<RouteForCompliance | null> {
    const row = await this.db.route.findUnique({
      where: { route_id: routeId },
      select: {
        route_id: true,
        ghg_intensity: true,
        fuel_consumption: true,
      },
    });
    return row ? mapRow(row) : null;
  }

  async findBaseline(): Promise<RouteForCompliance | null> {
    const row = await this.db.route.findFirst({
      where: { is_baseline: true },
      select: {
        route_id: true,
        ghg_intensity: true,
        fuel_consumption: true,
      },
    });
    return row ? mapRow(row) : null;
  }
}
