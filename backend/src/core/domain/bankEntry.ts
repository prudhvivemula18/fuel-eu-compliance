/**
 * GHG bank entry for a ship in a given year (g CO2eq).
 */
export interface BankEntry {
  id: string
  ship_id: string
  year: number
  amount_gco2eq: number
}
