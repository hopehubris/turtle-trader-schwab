import { useState } from 'react'
import type { Trade } from '../api/client'

interface Props {
  trades: Trade[]
  onChartOpen?: (symbol: string) => void
}

export default function TradeHistoryTable({ trades, onChartOpen }: Props) {
  const [sortKey, setSortKey] = useState<'entryDate' | 'pnl' | 'symbol'>('entryDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterSide, setFilterSide] = useState<'all' | 'long' | 'short'>('all')
  const [filterSys, setFilterSys] = useState<'all' | '1' | '2'>('all')

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = trades
    .filter((t) => filterSide === 'all' || t.side === filterSide)
    .filter((t) => filterSys === 'all' || String(t.system) === filterSys)
    .sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      if (sortKey === 'entryDate') { va = a.entryDate; vb = b.entryDate }
      else if (sortKey === 'pnl') { va = a.pnl ?? 0; vb = b.pnl ?? 0 }
      else if (sortKey === 'symbol') { va = a.symbol; vb = b.symbol }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const fmt = (n: number | null | undefined) =>
    n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  const SortBtn = ({ k, label }: { k: typeof sortKey; label: string }) => (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-blue-600">
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </button>
  )

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
            <tr className="border-b dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
              <th className="pb-2 pr-3 text-left"><SortBtn k="symbol" label="Symbol" /></th>
              <th className="pb-2 pr-3 text-left">Side</th>
              <th className="pb-2 pr-3 text-left">Sys</th>
              <th className="pb-2 pr-3 text-left">Units</th>
              <th className="pb-2 pr-3 text-left">Avg Entry</th>
              <th className="pb-2 pr-3 text-left">Exit</th>
              <th className="pb-2 pr-3 text-left"><SortBtn k="pnl" label="P&L" /></th>
              <th className="pb-2 pr-3 text-left">P&L %</th>
              <th className="pb-2 pr-3 text-left"><SortBtn k="entryDate" label="Entry" /></th>
              <th className="pb-2 pr-3 text-left">Exit Date</th>
              <th className="pb-2 text-left">Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const pnlColor = (t.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'
              return (
                <tr key={t.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-1.5 pr-3 font-semibold dark:text-gray-200">
                    <button onClick={() => onChartOpen?.(t.symbol)} className="hover:text-blue-600 hover:underline">
                      {t.symbol}
                    </button>
                  </td>
                  <td className="py-1.5 pr-3">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${t.side === 'long' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {t.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-gray-500">Sys{t.system}</td>
                  <td className="py-1.5 pr-3 text-gray-600">{t.unitCount}</td>
                  <td className="py-1.5 pr-3 font-mono dark:text-gray-200">${t.avgEntryPrice.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 font-mono dark:text-gray-200">{t.exitPrice != null ? `$${t.exitPrice.toFixed(2)}` : t.status === 'open' ? <span className="text-blue-500 text-xs">OPEN</span> : '—'}</td>
                  <td className={`py-1.5 pr-3 font-mono font-semibold ${pnlColor}`}>{fmt(t.pnl)}</td>
                  <td className={`py-1.5 pr-3 font-mono text-xs ${pnlColor}`}>{t.pnlPct != null ? `${t.pnlPct.toFixed(1)}%` : '—'}</td>
                  <td className="py-1.5 pr-3 text-gray-500 text-xs">{t.entryDate}</td>
                  <td className="py-1.5 pr-3 text-gray-500 text-xs">{t.exitDate ?? '—'}</td>
                  <td className="py-1.5 text-gray-400 text-xs">{t.exitReason ?? '—'}</td>
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
