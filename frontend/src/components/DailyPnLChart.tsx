import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Line, ComposedChart } from 'recharts'
import type { DailyPnL } from '../api/client'

interface Props {
  data: DailyPnL[]
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className={p.value >= 0 ? 'text-green-600' : 'text-red-500'}>
          {p.name}: {p.value >= 0 ? '+' : ''}{p.value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </p>
      ))}
    </div>
  )
}

export default function DailyPnLChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-gray-400">No P&L data yet</div>
  }

  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    'Daily P&L': Math.round(d.dailyPnl),
    'Cumulative': Math.round(d.cumulativePnl),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#9ca3af" />
        <Bar
          dataKey="Daily P&L"
          fill="#579bd8"
          radius={[2, 2, 0, 0]}
          // Color negative bars red
          // recharts doesn't natively support per-bar colors easily, using fill as default
        />
        <Line type="monotone" dataKey="Cumulative" stroke="#8b5cf6" dot={false} strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
