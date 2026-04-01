/**
 * Ship membership in a pool with compliance balance before/after (g CO2eq).
 */
export interface PoolMember {
  pool_id: string
  ship_id: string
  cb_before: number
  cb_after: number
}
