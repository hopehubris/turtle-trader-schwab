import { useState, useCallback } from 'react'
import { fetchAllTrades, fetchStats } from '../api/client'
import type { Trade, TradeStats } from '../api/client'
import TradeHistoryTable from '../components/TradeHistoryTable'
import TradeChartModal from '../components/TradeChartModal'
import { usePolling } from '../hooks/usePolling'

export default function Trades() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [stats, setStats] = useState<TradeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartSymbol, setChartSymbol] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [t, s] = await Promise.all([
      fetchAllTrades().catch(() => []),
      fetchStats().catch(() => null),
    ])
    setTrades(t)
    setStats(s)
    setLoading(false)
  }, [])

  usePolling(refresh, 60000)

  const fmt = (n: number | undefined) =>
    n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trade History</h1>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Trades', value: String(stats.totalTrades) },
            { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? 'text-green-600' : 'text-red-500' },
            { label: 'Total P&L', value: fmt(stats.totalPnl), color: stats.totalPnl >= 0 ? 'text-green-600' : 'text-red-500' },
            { label: 'Profit Factor', value: isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞', color: stats.profitFactor >= 1 ? 'text-green-600' : 'text-red-500' },
          ].map((c) => (
            <div key={c.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color ?? 'text-gray-900 dark:text-white'}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Avg Win', value: fmt(stats?.avgWin), color: 'text-green-600' },
          { label: 'Avg Loss', value: fmt(stats?.avgLoss), color: 'text-red-500' },
          { label: 'Avg Hold Days', value: stats?.avgHoldDays != null ? `${stats.avgHoldDays.toFixed(1)}d` : '—' },
        ].map((c) => (
          <div key={c.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.color ?? 'text-gray-900 dark:text-white'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        {loading ? (
          <div className="animate-pulse h-48 bg-gray-100 dark:bg-gray-700 rounded" />
        ) : (
          <TradeHistoryTable trades={trades} onChartOpen={setChartSymbol} />
        )}
      </div>

      {chartSymbol && (
        <TradeChartModal symbol={chartSymbol} onClose={() => setChartSymbol(null)} />
      )}
    </div>
  )
}
