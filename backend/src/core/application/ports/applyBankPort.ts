export interface ApplyBankResult {
  applied_amount_gco2eq: number
  cb_gco2eq_after: number
}

/**
 * Atomically applies all bank credits for a ship/year into compliance balance
 * and clears those bank entries.
 */
export interface ApplyBankPort {
  applyToShipYear(ship_id: string, year: number): Promise<ApplyBankResult>
}
