/** Matches backend ComplianceService: CB = (GHG_limit − GHG_actual) × (fuel_kg × LCV MJ/kg). */
export const LCV_MJ_PER_KG = 42

export function complianceBalanceFromRouteKpis(
  baselineGhgIntensity: number,
  route: { ghg_intensity: number; fuel_consumption: number },
): number {
  return (
    (baselineGhgIntensity - route.ghg_intensity) *
    route.fuel_consumption *
    LCV_MJ_PER_KG
  )
}
