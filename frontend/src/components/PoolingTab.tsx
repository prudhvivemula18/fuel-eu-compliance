import { useMemo, useState } from 'react'
import type { PoolCreateResponse, RouteRecord } from '../hooks/useCompliance'
import { complianceBalanceFromRouteKpis } from '../lib/poolingMath'

type PoolingTabProps = {
  routes: RouteRecord[]
  loading: boolean
  /** Baseline GHG intensity from /api/routes/comparison — required for live CB. */
  baselineGhgIntensity: number | null
  createPool: (input: {
    year: number
    members: { ship_id: string }[]
  }) => Promise<PoolCreateResponse>
}

export default function PoolingTab({
  routes,
  loading,
  baselineGhgIntensity,
  createPool,
}: PoolingTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [poolPending, setPoolPending] = useState(false)
  const [poolMessage, setPoolMessage] = useState<string | null>(null)
  const [lastPoolResult, setLastPoolResult] = useState<PoolCreateResponse | null>(
    null,
  )

  const toggle = (routeId: string) => {
    setLastPoolResult(null)
    setPoolMessage(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(routeId)) next.delete(routeId)
      else next.add(routeId)
      return next
    })
  }

  const selectedRoutes = routes.filter((r) => selected.has(r.route_id))
  const yearSet = new Set(selectedRoutes.map((r) => r.year))
  const poolYear =
    selectedRoutes.length === 0 || yearSet.size !== 1
      ? null
      : selectedRoutes[0].year

  const perRowCb = useMemo(() => {
    if (baselineGhgIntensity === null) return new Map<string, number>()
    const m = new Map<string, number>()
    for (const r of routes) {
      m.set(
        r.route_id,
        complianceBalanceFromRouteKpis(baselineGhgIntensity, r),
      )
    }
    return m
  }, [routes, baselineGhgIntensity])

  const livePoolTotal = useMemo(() => {
    if (baselineGhgIntensity === null || poolYear === null) return null
    if (yearSet.size !== 1) return null
    let sum = 0
    for (const r of selectedRoutes) {
      sum += perRowCb.get(r.route_id) ?? 0
    }
    return sum
  }, [
    baselineGhgIntensity,
    poolYear,
    selectedRoutes,
    perRowCb,
    yearSet.size,
  ])

  const poolCompliant =
    livePoolTotal !== null && Number.isFinite(livePoolTotal) && livePoolTotal >= 0

  const canCreate =
    selectedRoutes.length >= 2 &&
    poolYear !== null &&
    yearSet.size === 1 &&
    baselineGhgIntensity !== null &&
    poolCompliant &&
    !poolPending &&
    !loading

  const handleCreatePool = async () => {
    if (!canCreate || poolYear === null) return
    setPoolMessage(null)
    setPoolPending(true)
    try {
      const res = await createPool({
        year: poolYear,
        members: selectedRoutes.map((r) => ({ ship_id: r.route_id })),
      })
      setLastPoolResult(res)
      setPoolMessage(
        `Pool ${res.pool_id} created. Below are balances after redistribution.`,
      )
      setSelected(new Set())
    } catch (e) {
      setLastPoolResult(null)
      setPoolMessage(
        e instanceof Error ? e.message : 'Could not create pool',
      )
    } finally {
      setPoolPending(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Pooling
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select ships (route ids like R002, R003) with the same reporting year.
            Live total sums each route&apos;s compliance balance vs the baseline;
            create pool only when combined surplus covers deficit (total ≥ 0).
          </p>
        </div>
        <button
          type="button"
          disabled={!canCreate}
          onClick={() => void handleCreatePool()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {poolPending ? 'Creating…' : 'Create pool'}
        </button>
      </div>

      {baselineGhgIntensity === null && !loading && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Load comparison data (refresh or open Compare tab) to compute live
          pool totals.
        </div>
      )}

      {selectedRoutes.length > 0 &&
        baselineGhgIntensity !== null &&
        poolYear !== null &&
        yearSet.size === 1 && (
          <div
            className={`border-b px-4 py-3 dark:border-slate-800 ${
              poolCompliant
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                : 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Live pool total (g CO₂eq)
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {livePoolTotal !== null
                ? livePoolTotal.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })
                : '—'}
            </p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              {poolCompliant
                ? 'Combined balance is non-negative — surplus covers deficit; you can create the pool.'
                : 'Combined balance is negative — deficit exceeds surplus; create pool is disabled.'}
            </p>
          </div>
        )}

      {selectedRoutes.length >= 2 && yearSet.size > 1 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Selected routes use different reporting years. Choose routes that share
          the same year.
        </div>
      )}

      {poolMessage && (
        <div
          className={`border-b px-4 py-2 text-sm dark:border-slate-800 ${
            poolMessage.includes('created')
              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'
              : 'border-slate-200 text-slate-700 dark:text-slate-300'
          }`}
        >
          {poolMessage}
        </div>
      )}

      {lastPoolResult && lastPoolResult.allocations.length > 0 && (
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            After pooling (year {lastPoolResult.year})
          </h3>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Each member receives an equal share of the combined pool balance.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                  <th className="px-3 py-2">Ship</th>
                  <th className="px-3 py-2 text-right">Before (g CO₂eq)</th>
                  <th className="px-3 py-2 text-right">After (g CO₂eq)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {lastPoolResult.allocations.map((a) => (
                  <tr key={a.ship_id}>
                    <td className="px-3 py-2 font-mono text-xs">{a.ship_id}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.cb_before.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-emerald-800 dark:text-emerald-300">
                      {a.cb_after.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <th className="w-12 px-4 py-3" aria-label="Select" />
              <th className="px-4 py-3">Route ID</th>
              <th className="px-4 py-3">Vessel</th>
              <th className="px-4 py-3">Fuel</th>
              <th className="px-4 py-3 text-right">Year</th>
              <th className="px-4 py-3 text-right">Fuel (kg)</th>
              <th className="px-4 py-3 text-right">Est. CB (g CO₂eq)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              routes.map((r) => {
                const est =
                  baselineGhgIntensity !== null
                    ? perRowCb.get(r.route_id)
                    : undefined
                const isSel = selected.has(r.route_id)
                return (
                  <tr
                    key={r.id}
                    className={
                      isSel
                        ? 'bg-slate-50/90 dark:bg-slate-800/50'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggle(r.route_id)}
                        className="size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-950"
                        aria-label={`Select ${r.route_id}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {r.route_id}
                    </td>
                    <td className="px-4 py-3">{r.vessel_type}</td>
                    <td className="px-4 py-3">{r.fuel_type}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.year}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.fuel_consumption}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800 dark:text-slate-200">
                      {est === undefined
                        ? '—'
                        : est.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                    </td>
                  </tr>
                )
              })}
            {!loading && routes.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  No routes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
