import type { AccountInfo, TradeStats } from '../api/client'

interface Props {
  account: AccountInfo | null
  stats: TradeStats | null
  unrealizedPnl?: number
  loading?: boolean
}

export default function AccountCard({ account, stats, unrealizedPnl = 0, loading }: Props) {
  const fmt = (n: number | undefined) =>
    n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 animate-pulse h-20" />
        ))}
      </div>
    )
  }

  const cards = [
    { label: 'Portfolio Equity', value: fmt(account?.equity), sub: `Buying power: ${fmt(account?.buyingPower)}` },
    { label: 'Cash', value: fmt(account?.cash), sub: `Daytrades: ${account?.daytradeCount ?? 0}` },
    { label: 'Total P&L', value: fmt((stats?.totalPnl ?? 0) + unrealizedPnl), sub: `Realized: ${fmt(stats?.totalPnl)} · Unreal: ${fmt(unrealizedPnl)}`, color: ((stats?.totalPnl ?? 0) + unrealizedPnl) >= 0 ? 'text-green-600' : 'text-red-500' },
    { label: 'Open Positions', value: String(stats?.openTrades ?? 0), sub: `Closed: ${stats?.closedTrades ?? 0} trades` },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{c.label}</p>
          <p className={`text-2xl font-bold mt-1 ${c.color ?? 'text-gray-900 dark:text-white'}`}>{c.value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}
