import { useState } from 'react'
import type { Signal } from '../api/client'

interface Props {
  signals: Signal[]
}

const fmt = (n: number) => `$${n.toFixed(2)}`

type SortKey = 'symbol' | 'close' | 'atrValue' | 'dcEntryUpper' | 'dcEntryLower' | 'createdAt'

function CriteriaBadge({
  pass, label, actual, required, op,
}: {
  pass: boolean
  label: string
  actual?: number | null
  required?: number | null
  op?: '>=' | '<='
}) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap'
  const green = 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400'
  const red   = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'

  if (pass) {
    const val = actual != null ? ` ${fmt(actual)}` : ''
    return <span className={`${base} ${green}`}>✓ {label}{val}</span>
  }

  if (actual != null && required != null && op) {
    return (
      <span className={`${base} ${red}`} title={`Need ${op} ${fmt(required)}`}>
        ✗ {label} {fmt(actual)} <span className="opacity-60">{op} {fmt(required)}</span>
      </span>
    )
  }

  return <span className={`${base} ${red}`}>✗ {label}</span>
}

function ActionBadge({ action }: { action: string }) {
  if (action.startsWith('exited')) {
    return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">{action.replace(/_/g, ' ')}</span>
  }
  const map: Record<string, string> = {
    entered:                   'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400',
    unit_added:                'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    stop_exit:                 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    no_signal:                 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    no_signal_size:            'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    no_funds:                  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    skipped_cooldown:          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
    skipped_max_positions:     'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    skipped_max_units:         'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    skipped_existing_position: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  }
  const labels: Record<string, string> = {
    entered: 'Entered', unit_added: 'Unit Added', stop_exit: 'Stop Exit',
    no_signal: 'No Signal', no_signal_size: 'Size Too Small', no_funds: 'Insufficient Funds',
    skipped_cooldown: 'Cooldown',
    skipped_max_positions: 'Max Pos', skipped_max_units: 'Max Units',
    skipped_existing_position: 'In Position',
  }
  const cls = map[action] ?? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
  const label = labels[action] ?? action.replace(/_/g, ' ')
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{label}</span>
}

export default function SignalTable({ signals }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterDir, setFilterDir] = useState<'all' | 'long' | 'short'>('all')
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterSys, setFilterSys] = useState<'all' | '1' | '2'>('all')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-blue-600 whitespace-nowrap">
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}
    </button>
  )

  const filtered = signals
    .filter((s) => filterDir === 'all' || s.direction === filterDir)
    .filter((s) => filterAction === 'all' || s.actionTaken === filterAction)
    .filter((s) => filterSys === 'all' || String(s.system) === filterSys)
    .sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      if (sortKey === 'symbol') { va = a.symbol; vb = b.symbol }
      else if (sortKey === 'close') { va = a.close ?? 0; vb = b.close ?? 0 }
      else if (sortKey === 'atrValue') { va = a.atrValue ?? 0; vb = b.atrValue ?? 0 }
      else if (sortKey === 'dcEntryUpper') { va = a.dcEntryUpper ?? 0; vb = b.dcEntryUpper ?? 0 }
      else if (sortKey === 'dcEntryLower') { va = a.dcEntryLower ?? 0; vb = b.dcEntryLower ?? 0 }
      else if (sortKey === 'createdAt') { va = a.createdAt; vb = b.createdAt }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const actionOptions = Array.from(new Set(signals.map((s) => s.actionTaken))).sort()

  if (signals.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No signals yet.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        <select value={filterDir} onChange={(e) => setFilterDir(e.target.value as typeof filterDir)}
          className="text-xs px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white">
          <option value="all">All directions</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <select value={filterSys} onChange={(e) => setFilterSys(e.target.value as typeof filterSys)}
          className="text-xs px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white">
          <option value="all">All systems</option>
          <option value="1">System 1</option>
          <option value="2">System 2</option>
        </select>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
          className="text-xs px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white">
          <option value="all">All actions</option>
          {actionOptions.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
        <span className="text-xs text-gray-500 self-center">{filtered.length} signals</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
              <th className="pb-2 pr-4"><SortBtn k="symbol" label="Symbol" /></th>
              <th className="pb-2 pr-4"><SortBtn k="createdAt" label="Time" /></th>
              <th className="pb-2 pr-4">Sys</th>
              <th className="pb-2 pr-4">Dir</th>
              <th className="pb-2 pr-4"><SortBtn k="close" label="Close" /></th>
              <th className="pb-2 pr-4"><SortBtn k="atrValue" label="N (ATR)" /></th>
              <th className="pb-2 pr-4"><SortBtn k="dcEntryUpper" label="DC Upper" /></th>
              <th className="pb-2 pr-4"><SortBtn k="dcEntryLower" label="DC Lower" /></th>
              <th className="pb-2 pr-4">Criteria</th>
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const time = s.createdAt
                ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : s.scanDate

              const isShort = s.direction === 'short'
              const entryRequired = isShort ? s.dcEntryLower : s.dcEntryUpper
              const entryOp = isShort ? '<=' : '>='
              const exitRequired = isShort ? s.dcExitUpper : s.dcExitLower
              const exitOp = isShort ? '>=' : '<='

              return (
                <tr key={s.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-2 pr-4 font-semibold text-gray-900 dark:text-white">{s.symbol}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{time}</td>
                  <td className="py-2 pr-4 text-gray-500 dark:text-gray-400 text-xs">Sys{s.system}</td>
                  <td className="py-2 pr-4">
                    {s.direction ? (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                        s.direction === 'long' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {s.direction.toUpperCase()}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs dark:text-gray-200">{s.close != null ? fmt(s.close) : '—'}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-purple-600 dark:text-purple-400">{s.atrValue != null ? s.atrValue.toFixed(2) : '—'}</td>
                  <td className="py-2 pr-4 font-mono text-xs dark:text-gray-200">{s.dcEntryUpper != null ? fmt(s.dcEntryUpper) : '—'}</td>
                  <td className="py-2 pr-4 font-mono text-xs dark:text-gray-200">{s.dcEntryLower != null ? fmt(s.dcEntryLower) : '—'}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1">
                      <CriteriaBadge
                        pass={s.entryBreakout}
                        label="Entry"
                        actual={s.close}
                        required={entryRequired}
                        op={entryOp as '>=' | '<='}
                      />
                      <CriteriaBadge
                        pass={s.exitBreakout}
                        label="Exit"
                        actual={s.close}
                        required={exitRequired}
                        op={exitOp as '>=' | '<='}
                      />
                      <CriteriaBadge pass={s.unitAddSignal} label="Add" />
                      <CriteriaBadge pass={s.stopTriggered} label="Stop" />
                    </div>
                  </td>
                  <td className="py-2">
                    <ActionBadge action={s.actionTaken} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">No signals match filters.</p>}
      </div>
    </div>
  )
}
