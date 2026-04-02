import { RouteNotFoundError } from '../errors.js';
import type { ComplianceService } from '../ComplianceService.js';
import type {
  ShipComplianceRecord,
  ShipComplianceRepositoryPort,
} from '../ports/shipComplianceRepositoryPort.js';

export class GetComplianceBalanceUseCase {
  constructor(
    private readonly shipCompliance: ShipComplianceRepositoryPort,
    private readonly compliance: ComplianceService,
  ) {}

  async execute(filter?: {
    ship_id?: string
    year?: number
  }): Promise<ShipComplianceRecord[]> {
    if (!filter?.ship_id) {
      return this.shipCompliance.findAll(filter);
    }

    const stored = await this.shipCompliance.findAll(filter);
    if (stored.length > 0) {
      return stored;
    }

    if (filter.year === undefined) {
      return [];
    }

    try {
      const balance = await this.compliance.calculateComplianceBalanceForRouteYear(
        filter.ship_id,
        filter.year,
      );
      const sid = filter.ship_id.trim().toUpperCase();
      return [
        {
          id: `computed:${sid}:${filter.year}`,
          ship_id: sid,
          year: filter.year,
          cb_gco2eq: balance,
        },
      ];
    } catch (e) {
      if (e instanceof RouteNotFoundError) {
        return [];
      }
      throw e;
    }
  }
}
