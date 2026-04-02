export interface RouteEntity {
  id: string
  route_id: string
  vessel_type: string
  fuel_type: string
  year: number
  ghg_intensity: number
  fuel_consumption: number
  distance: number
  total_emissions: number
  is_baseline: boolean
}

export interface RouteRepositoryPort {
  findAll(): Promise<RouteEntity[]>
  /** Match public route id (e.g. R002), case-insensitive — not the internal UUID. */
  findByRouteId(routeId: string): Promise<RouteEntity | null>
  findByRouteIdAndYear(
    routeId: string,
    year: number,
  ): Promise<RouteEntity | null>
  findBaseline(): Promise<RouteEntity | null>
  setBaselineRouteId(routeId: string): Promise<void>
}
