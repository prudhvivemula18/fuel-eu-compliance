export interface BankEntryRecord {
  id: string
  ship_id: string
  year: number
  amount_gco2eq: number
}

export interface BankEntryRepositoryPort {
  findAll(filter?: { ship_id?: string; year?: number }): Promise<BankEntryRecord[]>
  create(input: {
    ship_id: string
    year: number
    amount_gco2eq: number
  }): Promise<BankEntryRecord>
  sumAmountForShipYear(ship_id: string, year: number): Promise<number>
}
