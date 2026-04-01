/**
 * Compliance balance (CB) for a ship in a given year (g CO2eq).
 */
export interface ShipCompliance {
  id: string
  ship_id: string
  year: number
  cb_gco2eq: number
}
