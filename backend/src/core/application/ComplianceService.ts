import { BaselineRouteNotFoundError, RouteNotFoundError } from './errors.js';
import type { RouteComplianceReadPort } from './ports/routeComplianceReadPort.js';

/** Standard LCV for marine fuels (MJ/kg) — placeholder until fuel-specific LCVs are modeled. */
const LCV_MJ_PER_KG = 42;

export type RouteComplianceResult = {
  route_id: string
  compliance_balance: number
  status: 'Compliant' | 'Non-Compliant'
};

export class ComplianceService {
  constructor(private readonly routes: RouteComplianceReadPort) {}

  /**
   * Compliance Balance = (GHG_limit - GHG_actual) × Energy_total
   * - GHG_actual: ghg_intensity of the target route
   * - GHG_limit: ghg_intensity of the baseline route (is_baseline = true)
   * - Energy_total: fuel_consumption × LCV (MJ)
   */
  async calculateRouteCompliance(routeId: string): Promise<RouteComplianceResult> {
    const [target, baseline] = await Promise.all([
      this.routes.findByRouteId(routeId),
      this.routes.findBaseline(),
    ]);

    if (!target) {
      throw new RouteNotFoundError(routeId);
    }
    if (!baseline) {
      throw new BaselineRouteNotFoundError();
    }

    const GHG_limit = baseline.ghg_intensity;
    const GHG_actual = target.ghg_intensity;
    const Energy_total = target.fuel_consumption * LCV_MJ_PER_KG;
    const compliance_balance = (GHG_limit - GHG_actual) * Energy_total;

    return {
      route_id: target.route_id,
      compliance_balance,
      status: compliance_balance >= 0 ? 'Compliant' : 'Non-Compliant',
    };
  }
}
