export interface PoolMemberAllocation {
  ship_id: string
  cb_before: number
  cb_after: number
}

export interface PoolCreationPort {
  createPoolWithAllocations(
    year: number,
    allocations: PoolMemberAllocation[],
  ): Promise<{ pool_id: string }>
}
