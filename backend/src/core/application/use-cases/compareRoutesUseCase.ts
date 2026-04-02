import { BaselineRouteNotFoundError, ValidationError } from '../errors.js';
import type { RouteRepositoryPort } from '../ports/routeRepositoryPort.js';

export type RouteComparisonRow = {
  route_id: string
  ghg_intensity: number
  percentDiff: number
  compliant: boolean
};

export type CompareRoutesResult = {
  baseline_route_id: string
  baseline_ghg_intensity: number
  comparisons: RouteComparisonRow[]
};

export class CompareRoutesUseCase {
  constructor(private readonly routes: RouteRepositoryPort) {}

  async execute(): Promise<CompareRoutesResult> {
    const [all, baseline] = await Promise.all([
      this.routes.findAll(),
      this.routes.findBaseline(),
    ]);

    if (!baseline) {
      throw new BaselineRouteNotFoundError();
    }

    const baselineIntensity = baseline.ghg_intensity;
    if (baselineIntensity === 0) {
      throw new ValidationError('Baseline GHG intensity must be non-zero');
    }

    const comparisons: RouteComparisonRow[] = all.map((route) => {
      const comparison = route.ghg_intensity;
      const percentDiff =
        (comparison / baselineIntensity - 1) * 100;
      const compliant = percentDiff <= 0;

      return {
        route_id: route.route_id,
        ghg_intensity: comparison,
        percentDiff,
        compliant,
      };
    });

    return {
      baseline_route_id: baseline.route_id,
      baseline_ghg_intensity: baselineIntensity,
      comparisons,
    };
  }
}
