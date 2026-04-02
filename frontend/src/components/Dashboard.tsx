import { useCallback, useState } from 'react'
import BankingTab from './BankingTab'
import PoolingTab from './PoolingTab'
import {
  useCompliance,
  type CompareTableRow,
  type RouteRecord,
} from '../hooks/useCompliance'

type TabId = 'routes' | 'compare' | 'banking' | 'pooling'

const TABS: { id: TabId; label: string }[] = [
  { id: 'routes', label: 'Routes' },
  { id: 'compare', label: 'Compare' },
  { id: 'banking', label: 'Banking' },
  { id: 'pooling', label: 'Pooling' },
]

export default function Dashboard() {
  const {
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
  } = useCompliance()

  const [activeTab, setActiveTab] = useState<TabId>('compare')

  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-8 text-left text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              FuelEU Maritime
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Interactive compliance dashboard
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh({ showLoading: true })}
            disabled={loading}
            className="self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Refresh data
          </button>
        </header>

        <nav
          className="mb-6 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800"
          aria-label="Dashboard sections"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border border-b-0 border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
                  : 'border border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {error && (
          <div
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}

        {activeTab === 'routes' && (
          <RoutesPanel routes={routes} loading={loading} />
        )}
        {activeTab === 'compare' && (
          <ComparePanel
            rows={compareRows}
            summary={summary}
            loading={loading}
            onSetBaseline={setBaseline}
          />
        )}
        {activeTab === 'banking' && (
          <BankingTab
            routes={routes}
            fetchComplianceBalanceSum={fetchComplianceBalanceSum}
            bankSurplus={bankSurplus}
          />
        )}
        {activeTab === 'pooling' && (
          <PoolingTab
            routes={routes}
            loading={loading}
            baselineGhgIntensity={comparison?.baseline_ghg_intensity ?? null}
            createPool={createPool}
          />
        )}
      </div>
    </div>
  )
}

function RoutesPanel({
  routes,
  loading,
}: {
  routes: RouteRecord[]
  loading: boolean
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          All routes
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <th className="px-4 py-3">Route ID</th>
              <th className="px-4 py-3">Vessel</th>
              <th className="px-4 py-3">Fuel</th>
              <th className="px-4 py-3 text-right">Year</th>
              <th className="px-4 py-3 text-right">GHG</th>
              <th className="px-4 py-3 text-right">Fuel (kg)</th>
              <th className="px-4 py-3 text-right">Distance</th>
              <th className="px-4 py-3 text-right">Emissions</th>
              <th className="px-4 py-3">Baseline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              routes.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium">
                    {r.route_id}
                  </td>
                  <td className="px-4 py-3">{r.vessel_type}</td>
                  <td className="px-4 py-3">{r.fuel_type}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.year}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(r.ghg_intensity).toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.fuel_consumption}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.distance}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.total_emissions}
                  </td>
                  <td className="px-4 py-3">
                    {r.is_baseline ? (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                        Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                </tr>
              ))}
            {!loading && routes.length === 0 && (
              <tr>
                <td
                  colSpan={9}
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

function ComparePanel({
  rows,
  summary,
  loading,
  onSetBaseline,
}: {
  rows: CompareTableRow[]
  summary: { total: number; fleetPct: number }
  loading: boolean
  onSetBaseline: (routeId: string) => Promise<void>
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleBaseline = useCallback(
    async (routeId: string) => {
      setActionError(null)
      setPendingId(routeId)
      try {
        await onSetBaseline(routeId)
      } catch (e) {
        setActionError(
          e instanceof Error ? e.message : 'Could not update baseline',
        )
      } finally {
        setPendingId(null)
      }
    },
    [onSetBaseline],
  )

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Total vessels
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {loading ? '—' : summary.total}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Fleet compliance %
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {loading ? '—' : `${summary.fleetPct}%`}
          </p>
        </div>
      </div>

      {actionError && (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
          role="status"
        >
          {actionError}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Comparison vs baseline
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-4 py-3">Route ID</th>
                <th className="px-4 py-3">Vessel</th>
                <th className="px-4 py-3">Fuel</th>
                <th className="px-4 py-3 text-right">GHG intensity</th>
                <th className="px-4 py-3 text-right">Percent diff</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
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
                rows.map((row) => (
                  <tr
                    key={row.route_id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {row.route_id}
                    </td>
                    <td className="px-4 py-3">{row.vessel_type}</td>
                    <td className="px-4 py-3">{row.fuel_type}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.ghg_intensity.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.percentDiff.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3">
                      {row.compliant ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-500/30">
                          Compliant
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-600/20 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-500/30">
                          Non-Compliant
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={pendingId === row.route_id}
                        onClick={() => void handleBaseline(row.route_id)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                      >
                        {pendingId === row.route_id ? 'Saving…' : 'Set baseline'}
                      </button>
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No comparison data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
