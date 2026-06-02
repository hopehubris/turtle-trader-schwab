import { useState, useCallback } from 'react'
import { fetchAccount, fetchOpenTrades, fetchSignals, fetchStats, fetchDailyPnL, fetchScannerStatus, fetchScanProgress, fetchConfig, syncWithSchwab } from '../api/client'
import type { AccountInfo, Trade, Signal, TradeStats, DailyPnL, ScannerStatus, ScanProgress, SyncResult } from '../api/client'
import AccountCard from '../components/AccountCard'
import OpenTradesTable from '../components/OpenTradesTable'
import SignalTable from '../components/SignalTable'
import DailyPnLChart from '../components/DailyPnLChart'
import ScannerStatusComponent from '../components/ScannerStatus'
import ScanProgressComponent from '../components/ScanProgress'
import TradeChartModal from '../components/TradeChartModal'
import { usePolling } from '../hooks/usePolling'

export default function Dashboard() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [stats, setStats] = useState<TradeStats | null>(null)
  const [dailyPnl, setDailyPnl] = useState<DailyPnL[]>([])
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus | null>(null)
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartSymbol, setChartSymbol] = useState<string | null>(null)
  const [isDryRun, setIsDryRun] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [a, t, s, st, dp, ss, sp, cfg] = await Promise.all([
        fetchAccount().catch(() => null),
        fetchOpenTrades().catch(() => []),
        fetchSignals({ limit: 500 }).catch(() => []),
        fetchStats().catch(() => null),
        fetchDailyPnL(30).catch(() => []),
        fetchScannerStatus().catch(() => null),
        fetchScanProgress().catch(() => null),
        fetchConfig().catch(() => ({}) as Record<string, string>),
      ])
      setAccount(a)
      setTrades(t)
      setSignals(s)
      setStats(st)
      setDailyPnl(dp)
      setScannerStatus(ss)
      setScanProgress(sp)
      setIsDryRun(cfg['DRY_RUN'] === 'true')
    } finally {
      setLoading(false)
    }
  }, [])

  usePolling(refresh, 30000)

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      const result = await syncWithSchwab()
      setSyncResult(result)
      await refresh()
    } catch (e) {
      console.error(e)
      setSyncError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const latestCreatedAt = signals.length > 0 ? new Date(signals[0].createdAt).getTime() : null
  const latestSignals = latestCreatedAt
    ? signals.filter(s => latestCreatedAt - new Date(s.createdAt).getTime() < 15 * 60 * 1000)
    : signals
  const latestScanDate = latestSignals.length > 0 ? latestSignals[0].scanDate : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <span className="text-xs text-gray-400">Auto-refreshes every 30s</span>
      </div>

      {isDryRun && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-yellow-600 dark:text-yellow-400 font-bold text-sm">DRY RUN MODE</span>
          <span className="text-yellow-700 dark:text-yellow-300 text-sm">Orders are simulated — no real trades will be placed on Schwab. Disable in Settings.</span>
        </div>
      )}

      <AccountCard account={account} stats={stats} unrealizedPnl={trades.reduce((sum, t) => sum + (t.unrealizedPnl ?? 0), 0)} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ScannerStatusComponent status={scannerStatus} onScanComplete={refresh} />
          {scanProgress && <div className="mt-3"><ScanProgressComponent progress={scanProgress} /></div>}
        </div>
        <div />
      </div>

      {/* Daily P&L Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Daily P&L (30 days)</h2>
        <DailyPnLChart data={dailyPnl} />
      </div>

      {/* Open Trades */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Open Trades ({trades.length})
          </h2>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync with Schwab'}
          </button>
        </div>
        {syncError && (
          <div className="mb-3 text-xs rounded px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
            Sync failed: {syncError}
          </div>
        )}
        {syncResult && !syncError && (
          <div className="mb-3 text-xs rounded px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 space-y-0.5">
            <div>Schwab positions: {syncResult.schwabPositions} &nbsp;|&nbsp; DB open trades: {syncResult.dbOpenTrades}</div>
            {syncResult.entriesCount === 0
              ? <div>Entry prices: all up to date</div>
              : <div>Entry prices updated: {syncResult.entriesSynced.map(s => `${s.symbol} $${s.oldPrice.toFixed(2)} → $${s.newPrice.toFixed(2)}`).join(', ')}</div>
            }
            {syncResult.exitsCount === 0
              ? <div>Exits: no missing positions found</div>
              : <div>Reconciled exits: {syncResult.exitsReconciled.map(e => e.symbol).join(', ')}</div>
            }
          </div>
        )}
        <OpenTradesTable
          trades={trades}
          onClose={refresh}
          onChartOpen={setChartSymbol}
        />
      </div>

      {/* Latest Run Signals */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Latest Run Signals
            {latestScanDate && <span className="ml-2 text-xs font-normal text-gray-400">({latestScanDate})</span>}
          </h2>
          <span className="text-xs text-gray-400">{latestSignals.length} symbols</span>
        </div>
        <SignalTable signals={latestSignals} />
      </div>

      {chartSymbol && (
        <TradeChartModal symbol={chartSymbol} onClose={() => setChartSymbol(null)} />
      )}
    </div>
  )
}
