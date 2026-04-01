/**
 * Read model for FuelEU compliance calculation (driven port).
 */
export interface RouteForCompliance {
  route_id: string
  ghg_intensity: number
  fuel_consumption: number
}

export interface RouteComplianceReadPort {
  findByRouteId(routeId: string): Promise<RouteForCompliance | null>
  findBaseline(): Promise<RouteForCompliance | null>
}
