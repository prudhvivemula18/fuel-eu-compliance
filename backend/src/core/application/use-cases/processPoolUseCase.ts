import { ValidationError } from '../errors.js';
import type { ComplianceService } from '../ComplianceService.js';
import type { PoolCreationPort } from '../ports/poolCreationPort.js';
import type { RouteRepositoryPort } from '../ports/routeRepositoryPort.js';

export type PoolMemberInput = { ship_id: string };

export type ProcessPoolResult = {
  pool_id: string
  year: number
  allocations: { ship_id: string; cb_before: number; cb_after: number }[]
};

export class ProcessPoolUseCase {
  constructor(
    private readonly pools: PoolCreationPort,
    private readonly routes: RouteRepositoryPort,
    private readonly compliance: ComplianceService,
  ) {}

  async execute(input: {
    year: number
    members: PoolMemberInput[]
  }): Promise<ProcessPoolResult> {
    if (!Number.isFinite(input.year)) {
      throw new ValidationError('year must be a number');
    }
    if (!Array.isArray(input.members) || input.members.length === 0) {
      throw new ValidationError('members must be a non-empty array');
    }

    for (const m of input.members) {
      if (!m.ship_id?.trim()) {
        throw new ValidationError('Each member must include ship_id');
      }
    }

    const baseline = await this.routes.findBaseline();
    if (!baseline) {
      throw new ValidationError('No baseline route (is_baseline = true) is configured');
    }

    const allocations: { ship_id: string; cb_before: number; cb_after: number }[] =
      [];

    for (const m of input.members) {
      const rid = m.ship_id.trim();
      const route = await this.routes.findByRouteId(rid);
      if (!route) {
        throw new ValidationError(
          `Route ${rid.toUpperCase()} not found (use public ids like R001, R002).`,
        );
      }
      if (route.year !== input.year) {
        throw new ValidationError(
          `Route ${route.route_id} is for year ${route.year}; pool year is ${input.year}.`,
        );
      }

      const cb_before = this.compliance.complianceBalanceFromRouteKpis(
        route,
        baseline,
      );

      allocations.push({
        ship_id: route.route_id,
        cb_before,
        cb_after: 0,
      });
    }

    const total = allocations.reduce((s, a) => s + a.cb_before, 0);
    if (total < 0) {
      throw new ValidationError(
        'Combined pool balance is negative; pooling is only allowed when total surplus covers deficit (sum ≥ 0).',
      );
    }
    const share =
      allocations.length > 0 ? total / allocations.length : 0;

    const finalAllocations = allocations.map((a) => ({
      ...a,
      cb_after: share,
    }));

    const { pool_id } = await this.pools.createPoolWithAllocations(
      input.year,
      finalAllocations,
    );

    return { pool_id, year: input.year, allocations: finalAllocations };
  }
}
