import { useCallback, useEffect, useMemo, useState } from 'react'

const API_BASE =
  import.meta.env.VITE_API_BASE ?? 'http://localhost:3000'

export type RouteRecord = {
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

export type ComparisonRow = {
  route_id: string
  ghg_intensity: number
  percentDiff: number
  compliant: boolean
}

export type ComparisonResponse = {
  baseline_route_id: string
  baseline_ghg_intensity: number
  comparisons: ComparisonRow[]
}

export type CompareTableRow = ComparisonRow & {
  vessel_type: string
  fuel_type: string
}

export type ShipComplianceRow = {
  id: string
  ship_id: string
  year: number
  cb_gco2eq: number | string
}

export type BankEntryRecord = {
  id: string
  ship_id: string
  year: number
  amount_gco2eq: number | string
}

export type PoolCreateResponse = {
  pool_id: string
  year: number
  allocations: {
    ship_id: string
    cb_before: number
    cb_after: number
  }[]
}

function buildCompareRows(
  comparison: ComparisonResponse | null,
  routes: RouteRecord[],
): CompareTableRow[] {
  if (!comparison) return []
  const metaById = new Map(
    routes.map((r) => [
      r.route_id,
      { vessel_type: r.vessel_type, fuel_type: r.fuel_type },
    ]),
  )
  return comparison.comparisons.map((c) => {
    const meta = metaById.get(c.route_id)
    return {
      ...c,
      vessel_type: meta?.vessel_type ?? '—',
      fuel_type: meta?.fuel_type ?? '—',
    }
  })
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    if (body?.error) return body.error
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`
}

export function useCompliance() {
  const [routes, setRoutes] = useState<RouteRecord[]>([])
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true
    if (showLoading) {
      setLoading(true)
    }
    setError(null)
    try {
      const [routesRes, comparisonRes] = await Promise.all([
        fetch(`${API_BASE}/api/routes`),
        fetch(`${API_BASE}/api/routes/comparison`),
      ])

      if (!routesRes.ok) {
        throw new Error(await parseErrorMessage(routesRes))
      }
      if (!comparisonRes.ok) {
        throw new Error(await parseErrorMessage(comparisonRes))
      }

      const routesJson = (await routesRes.json()) as RouteRecord[]
      const comparisonJson = (await comparisonRes.json()) as ComparisonResponse

      setRoutes(routesJson)
      setComparison(comparisonJson)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
      setRoutes([])
      setComparison(null)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [])

  const compareRows = useMemo(
    () => buildCompareRows(comparison, routes),
    [comparison, routes],
  )

  const summary = useMemo(() => {
    const total = compareRows.length
    const compliant = compareRows.filter((r) => r.compliant).length
    const fleetPct = total === 0 ? 0 : Math.round((compliant / total) * 100)
    return { total, fleetPct }
  }, [compareRows])

  const fetchComplianceBalanceSum = useCallback(
    async (shipId: string, year: number): Promise<number> => {
      const q = new URLSearchParams({
        ship_id: shipId,
        year: String(year),
      })
      const res = await fetch(`${API_BASE}/api/compliance/cb?${q}`)
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      const rows = (await res.json()) as ShipComplianceRow[]
      return rows.reduce((s, r) => s + Number(r.cb_gco2eq), 0)
    },
    [],
  )

  const setBaseline = useCallback(
    async (routeId: string) => {
      const res = await fetch(
        `${API_BASE}/api/routes/${encodeURIComponent(routeId)}/baseline`,
        { method: 'POST' },
      )
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      await refresh({ showLoading: false })
    },
    [refresh],
  )

  const bankSurplus = useCallback(
    async (input: {
      ship_id: string
      year: number
      amount_gco2eq: number
    }) => {
      const res = await fetch(`${API_BASE}/api/banking/bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ship_id: input.ship_id,
          year: input.year,
          amount_gco2eq: input.amount_gco2eq,
        }),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return (await res.json()) as BankEntryRecord
    },
    [],
  )

  const createPool = useCallback(
    async (input: {
      year: number
      members: { ship_id: string }[]
    }) => {
      const res = await fetch(`${API_BASE}/api/pools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return (await res.json()) as PoolCreateResponse
    },
    [],
  )

  useEffect(() => {
    void refresh({ showLoading: true })
  }, [refresh])

  return {
    routes,
    comparison,
    compareRows,
    summary,
    loading,
    error,
    refresh,
    fetchComplianceBalanceSum,
    setBaseline,
    bankSurplus,
    createPool,
  }
}
