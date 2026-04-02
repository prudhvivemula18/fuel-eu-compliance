export interface ShipComplianceRecord {
  id: string
  ship_id: string
  year: number
  cb_gco2eq: number
}

export interface ShipComplianceRepositoryPort {
  findAll(filter?: { ship_id?: string; year?: number }): Promise<ShipComplianceRecord[]>
}
