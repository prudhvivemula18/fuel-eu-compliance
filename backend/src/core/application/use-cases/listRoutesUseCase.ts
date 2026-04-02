import type {
  RouteEntity,
  RouteRepositoryPort,
} from '../ports/routeRepositoryPort.js';

export class ListRoutesUseCase {
  constructor(private readonly routes: RouteRepositoryPort) {}

  execute(): Promise<RouteEntity[]> {
    return this.routes.findAll();
  }
}
