import { useCallback, useState } from 'react'
import type { RouteRecord } from '../hooks/useCompliance'

type BankingTabProps = {
  routes: RouteRecord[]
  fetchComplianceBalanceSum: (shipId: string, year: number) => Promise<number>
  bankSurplus: (input: {
    ship_id: string
    year: number
    amount_gco2eq: number
  }) => Promise<unknown>
}

export default function BankingTab({
  routes,
  fetchComplianceBalanceSum,
  bankSurplus,
}: BankingTabProps) {
  const [shipId, setShipId] = useState('R002')
  const [yearStr, setYearStr] = useState('2024')
  const [cbSum, setCbSum] = useState<number | null>(null)
  const [cbLoading, setCbLoading] = useState(false)
  const [cbError, setCbError] = useState<string | null>(null)
  /** True only after a successful Load Balance fetch for the current form values. */
  const [isBankable, setIsBankable] = useState(false)
  const [bankPending, setBankPending] = useState(false)
  const [bankMessage, setBankMessage] = useState<string | null>(null)

  const parseYear = (): number | null => {
    const y = Number(yearStr.trim())
    if (!Number.isFinite(y) || !Number.isInteger(y)) return null
    return y
  }

  const routeForShipInput = useCallback(
    (sid: string) =>
      routes.find(
        (r) => r.route_id.toUpperCase() === sid.trim().toUpperCase(),
      ),
    [routes],
  )

  const loadBalance = useCallback(
    async (overrides?: { shipId?: string; year?: number }) => {
      const sid = (overrides?.shipId ?? shipId).trim()
      const year =
        overrides?.year !== undefined ? overrides.year : parseYear()

      setBankMessage(null)

      if (!sid) {
        setCbError('Ship ID is required')
        setCbSum(null)
        setIsBankable(false)
        return
      }
      if (year === null) {
        setCbError('Enter a valid reporting year')
        setCbSum(null)
        setIsBankable(false)
        return
      }

      setCbLoading(true)
      setCbError(null)
      try {
        const sum = await fetchComplianceBalanceSum(sid, year)
        setCbSum(sum)
        setIsBankable(sum > 0)
      } catch (e) {
        setCbError(e instanceof Error ? e.message : 'Could not load CB')
        setCbSum(null)
        setIsBankable(false)
      } finally {
        setCbLoading(false)
      }
    },
    [fetchComplianceBalanceSum, shipId, yearStr],
  )

  const canSubmitBank =
    isBankable && cbSum !== null && cbSum > 0 && !cbLoading && !bankPending

  const handleBankSurplus = async () => {
    const sid = shipId.trim()
    const year = parseYear()
    if (!canSubmitBank || cbSum === null || year === null || !sid) return

    setBankMessage(null)
    setBankPending(true)
    try {
      await bankSurplus({
        ship_id: sid,
        year,
        amount_gco2eq: cbSum,
      })
      setBankMessage('Surplus banked successfully.')
      await loadBalance()
    } catch (e) {
      setBankMessage(
        e instanceof Error ? e.message : 'Banking request failed',
      )
    } finally {
      setBankPending(false)
    }
  }

  const handleShipBlur = () => {
    const sid = shipId.trim()
    const hit = routeForShipInput(sid)
    if (hit) {
      setYearStr(String(hit.year))
      void loadBalance({ shipId: sid, year: hit.year })
      return
    }
    void loadBalance()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Bank surplus
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Use public route ids (R001, R002, …). Leaving the Ship field sets the
          year from the Routes catalog when it matches. CB comes from stored
          compliance rows or is computed from route GHG intensity and energy
          (fuel × 42 MJ/kg) vs baseline.
        </p>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
              Ship / route ID
            </span>
            <input
              value={shipId}
              onChange={(e) => {
                setShipId(e.target.value)
                setIsBankable(false)
                setCbSum(null)
                setCbError(null)
              }}
              onBlur={handleShipBlur}
              className="w-full min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white sm:w-56"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
              Year
            </span>
            <input
              value={yearStr}
              onChange={(e) => {
                setYearStr(e.target.value)
                setIsBankable(false)
                setCbSum(null)
                setCbError(null)
              }}
              onBlur={() => void loadBalance()}
              inputMode="numeric"
              className="w-full min-w-[120px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white sm:w-32"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadBalance()}
            disabled={cbLoading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {cbLoading ? 'Loading…' : 'Load balance'}
          </button>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Current compliance balance (CB)
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {cbLoading && 'Loading…'}
            {!cbLoading && cbError && '—'}
            {!cbLoading && !cbError && cbSum !== null && cbSum.toLocaleString()}
            {!cbLoading && !cbError && cbSum === null && '—'}
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              g CO₂eq
            </span>
          </p>
          {isBankable && !cbLoading && (
            <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              CB is positive — surplus can be banked.
            </p>
          )}
          {cbError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {cbError}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canSubmitBank}
            onClick={() => void handleBankSurplus()}
            className={
              canSubmitBank
                ? 'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md ring-2 ring-emerald-400/80 ring-offset-2 ring-offset-white hover:bg-emerald-400 dark:ring-emerald-300/60 dark:ring-offset-slate-900'
                : 'rounded-lg bg-emerald-600/50 px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-40'
            }
          >
            {bankPending ? 'Banking…' : 'Bank surplus'}
          </button>
          {!canSubmitBank && !cbLoading && cbSum !== null && cbSum <= 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Load balance: CB must be greater than zero to bank a surplus.
            </span>
          )}
        </div>

        {bankMessage && (
          <p
            className={`mt-3 text-sm ${bankMessage.includes('success') ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
            role="status"
          >
            {bankMessage}
          </p>
        )}
      </div>
    </div>
  )
}
