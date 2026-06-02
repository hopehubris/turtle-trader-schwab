import { useState, useEffect } from 'react'
import { fetchConfig, updateConfig } from '../api/client'
import type { Config } from '../api/client'

type FieldDef = {
  key: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select'
  options?: string[]
  hint?: string
}

const FIELD_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Watchlist',
    fields: [
      { key: 'WATCHLIST', label: 'Watchlist (comma-separated tickers)', type: 'text', hint: 'e.g. AAPL,MSFT,TSLA' },
    ],
  },
  {
    title: 'System 1 (Short-term)',
    fields: [
      { key: 'SYS1_ENTRY_PERIOD', label: 'Entry Period (days)', type: 'number', hint: 'Default: 20' },
      { key: 'SYS1_EXIT_PERIOD', label: 'Exit Period (days)', type: 'number', hint: 'Default: 10' },
      { key: 'SYS1_FILTER_ENABLED', label: 'Skip after winner', type: 'boolean', hint: 'Skip System 1 entry if last trade was a winner' },
    ],
  },
  {
    title: 'System 2 (Long-term)',
    fields: [
      { key: 'SYS2_ENTRY_PERIOD', label: 'Entry Period (days)', type: 'number', hint: 'Default: 55' },
      { key: 'SYS2_EXIT_PERIOD', label: 'Exit Period (days)', type: 'number', hint: 'Default: 20' },
    ],
  },
  {
    title: 'Position Sizing & Risk',
    fields: [
      { key: 'ATR_PERIOD', label: 'ATR Period (N)', type: 'number', hint: 'Default: 14' },
      { key: 'RISK_PCT_PER_UNIT', label: 'Risk % per Unit', type: 'number', hint: '% of equity risked per unit. Default: 1' },
      { key: 'MAX_UNITS', label: 'Max Units per Position', type: 'number', hint: 'Default: 4' },
      { key: 'STOP_LOSS_MULTIPLIER', label: 'Stop Loss Multiplier (N)', type: 'number', hint: 'Default: 2 (stop = 2N from entry)' },
      { key: 'MAX_OPEN_POSITIONS', label: 'Max Open Positions', type: 'number', hint: 'Default: 10' },
      { key: 'MIN_EQUITY', label: 'Min Equity ($)', type: 'number', hint: 'Halt trading below this equity' },
      { key: 'DAILY_LOSS_LIMIT_PCT', label: 'Daily Loss Limit (%)', type: 'number', hint: '% of equity. Default: 2' },
      { key: 'COOLDOWN_DAYS', label: 'Cooldown Days', type: 'number', hint: 'Days before re-entry after exit' },
    ],
  },
  {
    title: 'Trading Settings',
    fields: [
      { key: 'ENABLED_SYSTEMS', label: 'Enabled Systems', type: 'select', options: ['1', '2', '1,2'], hint: 'Which systems to run' },
      { key: 'ALLOW_SHORT', label: 'Allow Short Positions', type: 'boolean' },
      { key: 'DRY_RUN', label: 'Dry Run (simulate only)', type: 'boolean' },
      { key: 'BROKER', label: 'Broker', type: 'select', options: ['schwab', 'fidelity', 'manual'] },
      { key: 'TRADING_MODE', label: 'Trading Mode', type: 'select', options: ['paper', 'live'] },
    ],
  },
  {
    title: 'Scanner',
    fields: [
      { key: 'SCAN_CRON', label: 'Scan Schedule (cron)', type: 'text', hint: 'Default: 0 16 * * 1-5 (4pm weekdays)' },
      { key: 'BARS_NEEDED', label: 'Historical Bars', type: 'number', hint: 'Bars to fetch per symbol. Default: 300' },
    ],
  },
]

export default function Settings() {
  const [config, setConfig] = useState<Config>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchConfig().then((c) => { setConfig(c); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  function handleChange(key: string, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="animate-pulse h-48 bg-gray-100 rounded-lg" />

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {FIELD_GROUPS.map((group) => (
        <div key={group.title} className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b pb-2 dark:border-gray-700">
            {group.title}
          </h2>
          {group.fields.map((f) => {
            const val = config[f.key] ?? ''
            return (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                {f.hint && <p className="text-xs text-gray-400 mb-1">{f.hint}</p>}
                {f.type === 'boolean' ? (
                  <select
                    value={val}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    className="text-sm px-3 py-1.5 border rounded-lg w-40 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                ) : f.type === 'select' ? (
                  <select
                    value={val}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    className="text-sm px-3 py-1.5 border rounded-lg w-48 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type === 'number' ? 'text' : 'text'}
                    value={val}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    className="text-sm px-3 py-1.5 border rounded-lg w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
