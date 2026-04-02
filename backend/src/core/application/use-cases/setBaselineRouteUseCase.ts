import type { RouteRepositoryPort } from '../ports/routeRepositoryPort.js';

export class SetBaselineRouteUseCase {
  constructor(private readonly routes: RouteRepositoryPort) {}

  execute(routeId: string): Promise<void> {
    return this.routes.setBaselineRouteId(routeId);
  }
}
