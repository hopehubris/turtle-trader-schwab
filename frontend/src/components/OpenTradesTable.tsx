import { useState } from 'react'
import type { Trade } from '../api/client'
import { closeTrade, markTradeClosed } from '../api/client'

interface Props {
  trades: Trade[]
  onClose?: () => void
  onChartOpen?: (symbol: string) => void
}

type SortKey = 'symbol' | 'avgEntryPrice' | 'currentStop' | 'unrealizedPnl' | 'entryDate' | 'totalShares'

export default function OpenTradesTable({ trades, onClose, onChartOpen }: Props) {
  const [closing, setClosing] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [markingClosed, setMarkingClosed] = useState<number | null>(null)
  const [markConfirmId, setMarkConfirmId] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('entryDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterSide, setFilterSide] = useState<'all' | 'long' | 'short'>('all')
  const [filterSys, setFilterSys] = useState<'all' | '1' | '2'>('all')

  const fmt = (n: number | null | undefined, decimals = 2) =>
    n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const fmtUsd = (n: number | null | undefined) =>
    n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-blue-600 whitespace-nowrap">
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}
    </button>
  )

  const filtered = trades
    .filter((t) => filterSide === 'all' || t.side === filterSide)
    .filter((t) => filterSys === 'all' || String(t.system) === filterSys)
    .sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      if (sortKey === 'symbol') { va = a.symbol; vb = b.symbol }
      else if (sortKey === 'avgEntryPrice') { va = a.avgEntryPrice; vb = b.avgEntryPrice }
      else if (sortKey === 'currentStop') { va = a.currentStop ?? 0; vb = b.currentStop ?? 0 }
      else if (sortKey === 'unrealizedPnl') { va = a.unrealizedPnl ?? 0; vb = b.unrealizedPnl ?? 0 }
      else if (sortKey === 'entryDate') { va = a.entryDate; vb = b.entryDate }
      else if (sortKey === 'totalShares') { va = a.totalShares; vb = b.totalShares }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  async function handleClose(id: number) {
    setClosing(id)
    try {
      await closeTrade(id)
      onClose?.()
    } catch (e) {
      console.error(e)
    } finally {
      setClosing(null)
      setConfirmId(null)
    }
  }

  async function handleMarkClosed(id: number) {
    setMarkingClosed(id)
    try {
      await markTradeClosed(id)
      onClose?.()
    } catch (e) {
      console.error(e)
    } finally {
      setMarkingClosed(null)
      setMarkConfirmId(null)
    }
  }

  if (trades.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No open trades.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        <select value={filterSide} onChange={(e) => setFilterSide(e.target.value as typeof filterSide)}
          className="text-xs px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white">
          <option value="all">All sides</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <select value={filterSys} onChange={(e) => setFilterSys(e.target.value as typeof filterSys)}
          className="text-xs px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white">
          <option value="all">All systems</option>
          <option value="1">System 1</option>
          <option value="2">System 2</option>
        </select>
        <span className="text-xs text-gray-500 self-center">{filtered.length} trades</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
              <th className="pb-2 pr-4"><SortBtn k="symbol" label="Symbol" /></th>
              <th className="pb-2 pr-4">Side</th>
              <th className="pb-2 pr-4">Sys</th>
              <th className="pb-2 pr-4">Units</th>
              <th className="pb-2 pr-4"><SortBtn k="avgEntryPrice" label="Entry" /></th>
              <th className="pb-2 pr-4"><SortBtn k="currentStop" label="Stop" /></th>
              <th className="pb-2 pr-4">Current</th>
              <th className="pb-2 pr-4"><SortBtn k="unrealizedPnl" label="Unreal. P&L" /></th>
              <th className="pb-2 pr-4"><SortBtn k="totalShares" label="Shares" /></th>
              <th className="pb-2 pr-4"><SortBtn k="entryDate" label="Entry Date" /></th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const pnlColor = (t.unrealizedPnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'
              return (
                <tr key={t.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-2 pr-4 font-semibold text-gray-900 dark:text-white">
                    <button onClick={() => onChartOpen?.(t.symbol)} className="hover:text-blue-600 hover:underline">
                      {t.symbol}
                    </button>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${t.side === 'long' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {t.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">Sys{t.system}</td>
                  <td className="py-2 pr-4">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                      {t.unitCount}/{4}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono dark:text-gray-200">${fmt(t.avgEntryPrice)}</td>
                  <td className="py-2 pr-4 font-mono text-orange-600">${fmt(t.currentStop)}</td>
                  <td className="py-2 pr-4 font-mono dark:text-gray-200">{t.currentPrice != null ? `$${fmt(t.currentPrice)}` : '—'}</td>
                  <td className={`py-2 pr-4 font-mono font-semibold ${pnlColor}`}>
                    {fmtUsd(t.unrealizedPnl)}
                  </td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{fmt(t.totalShares, 0)}</td>
                  <td className="py-2 pr-4 text-gray-500">{t.entryDate}</td>
                  <td className="py-2">
                    {confirmId === t.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleClose(t.id)}
                          disabled={closing === t.id}
                          className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {closing === t.id ? '…' : 'Confirm'}
                        </button>
                        <button onClick={() => setConfirmId(null)} className="px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                      </div>
                    ) : markConfirmId === t.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleMarkClosed(t.id)}
                          disabled={markingClosed === t.id}
                          className="px-2 py-0.5 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                        >
                          {markingClosed === t.id ? '…' : 'Confirm'}
                        </button>
                        <button onClick={() => setMarkConfirmId(null)} className="px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={() => setConfirmId(t.id)} className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300">Close</button>
                        <button onClick={() => setMarkConfirmId(t.id)} className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300" title="Mark closed in DB without sending broker order">Mark Closed</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">No trades match filters.</p>}
      </div>
    </div>
  )
}
