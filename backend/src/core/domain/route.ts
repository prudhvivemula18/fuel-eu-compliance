/**
 * Voyage / route KPI record for FuelEU intensity and emissions accounting.
 */
export interface Route {
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
