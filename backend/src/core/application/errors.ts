export class RouteNotFoundError extends Error {
  constructor(routeId: string) {
    super(`Route not found: ${routeId}`)
    this.name = 'RouteNotFoundError'
  }
}

export class BaselineRouteNotFoundError extends Error {
  constructor() {
    super('No baseline route (is_baseline = true) is configured')
    this.name = 'BaselineRouteNotFoundError'
  }
}
