import { useState, useCallback } from 'react'
import { fetchSignals } from '../api/client'
import type { Signal } from '../api/client'
import SignalTable from '../components/SignalTable'
import { usePolling } from '../hooks/usePolling'

export default function Signals() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSys, setFilterSys] = useState('')
  const [filterDir, setFilterDir] = useState('')
  const [filterDate, setFilterDate] = useState('')

  const refresh = useCallback(async () => {
    const s = await fetchSignals({
      limit: 200,
      ...(filterSys ? { system: parseInt(filterSys) } : {}),
      ...(filterDir ? { direction: filterDir } : {}),
      ...(filterDate ? { date: filterDate } : {}),
    }).catch(() => [])
    setSignals(s)
    setLoading(false)
  }, [filterSys, filterDir, filterDate])

  usePolling(refresh, 30000)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Signals</h1>
        <span className="text-xs text-gray-400">{signals.length} signals</span>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={filterSys} onChange={(e) => setFilterSys(e.target.value)}
          className="text-sm px-3 py-1.5 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white">
          <option value="">All Systems</option>
          <option value="1">System 1</option>
          <option value="2">System 2</option>
        </select>
        <select value={filterDir} onChange={(e) => setFilterDir(e.target.value)}
          className="text-sm px-3 py-1.5 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white">
          <option value="">All Directions</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="text-sm px-3 py-1.5 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
        {(filterSys || filterDir || filterDate) && (
          <button
            onClick={() => { setFilterSys(''); setFilterDir(''); setFilterDate('') }}
            className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        {loading ? (
          <div className="animate-pulse h-48 bg-gray-100 dark:bg-gray-700 rounded" />
        ) : (
          <SignalTable signals={signals} />
        )}
      </div>
    </div>
  )
}
