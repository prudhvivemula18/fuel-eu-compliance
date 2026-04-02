import type { PrismaClient } from '@prisma/client';
import { RouteNotFoundError } from '../../../core/application/errors.js';
import type {
  RouteEntity,
  RouteRepositoryPort,
} from '../../../core/application/ports/routeRepositoryPort.js';

function mapRoute(row: {
  id: string
  route_id: string
  vessel_type: string
  fuel_type: string
  year: number
  ghg_intensity: { toNumber(): number }
  fuel_consumption: number
  distance: number
  total_emissions: number
  is_baseline: boolean
}): RouteEntity {
  return {
    id: row.id,
    route_id: row.route_id,
    vessel_type: row.vessel_type,
    fuel_type: row.fuel_type,
    year: row.year,
    ghg_intensity: row.ghg_intensity.toNumber(),
    fuel_consumption: row.fuel_consumption,
    distance: row.distance,
    total_emissions: row.total_emissions,
    is_baseline: row.is_baseline,
  };
}

const routeIdEquals = (routeId: string) => ({
  equals: routeId,
  mode: 'insensitive' as const,
});

export class RouteRepositoryPrismaAdapter implements RouteRepositoryPort {
  constructor(private readonly db: PrismaClient) {}

  async findAll(): Promise<RouteEntity[]> {
    const rows = await this.db.route.findMany({ orderBy: { route_id: 'asc' } });
    return rows.map(mapRoute);
  }

  async findByRouteId(routeId: string): Promise<RouteEntity | null> {
    const row = await this.db.route.findFirst({
      where: { route_id: routeIdEquals(routeId) },
    });
    return row ? mapRoute(row) : null;
  }

  async findByRouteIdAndYear(
    routeId: string,
    year: number,
  ): Promise<RouteEntity | null> {
    const row = await this.db.route.findFirst({
      where: {
        route_id: routeIdEquals(routeId),
        year,
      },
    });
    return row ? mapRoute(row) : null;
  }

  async findBaseline(): Promise<RouteEntity | null> {
    const row = await this.db.route.findFirst({ where: { is_baseline: true } });
    return row ? mapRoute(row) : null;
  }

  async setBaselineRouteId(routeId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const match = await tx.route.findFirst({
        where: { route_id: routeIdEquals(routeId) },
      });
      if (!match) {
        throw new RouteNotFoundError(routeId);
      }
      await tx.route.updateMany({ data: { is_baseline: false } });
      await tx.route.update({
        where: { id: match.id },
        data: { is_baseline: true },
      });
    });
  }
}
