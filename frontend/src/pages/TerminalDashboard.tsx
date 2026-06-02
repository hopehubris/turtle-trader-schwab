import { useState, useCallback } from 'react'
import {
  fetchAccount, fetchOpenTrades, fetchSignals, fetchStats, fetchDailyPnL,
  fetchScannerStatus, fetchScanProgress, fetchConfig, syncWithSchwab,
  triggerScan, stopScan, closeTrade,
} from '../api/client'
import type { AccountInfo, Trade, Signal, TradeStats, DailyPnL, ScannerStatus, ScanProgress } from '../api/client'
import TradeChartModal from '../components/TradeChartModal'
import { usePolling } from '../hooks/usePolling'

const T = {
  bg: '#070c14', surface: '#0d1a27', surface2: '#111f30', border: '#1a2f47',
  accent: '#579bd8', accentDim: 'rgba(87,155,216,0.1)',
  text: '#e2e8f0', muted: '#6b8fa8', dim: '#3d5a72',
  up: '#10b981', down: '#ef4444', warn: '#f59e0b', blue: '#7bb8e8',
}

const pulseStyle = `
  @keyframes tpulse {
    0% { box-shadow: 0 0 0 0 rgba(87,155,216,0.4); }
    70% { box-shadow: 0 0 0 6px rgba(87,155,216,0); }
    100% { box-shadow: 0 0 0 0 rgba(87,155,216,0); }
  }
`

const mono = "'JetBrains Mono', monospace"
const sora = "'Sora', sans-serif"

function fmtDollar(n: number | null | undefined) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const s = abs >= 1000000
    ? `$${(abs / 1000000).toFixed(2)}M`
    : abs >= 1000
    ? `$${(abs / 1000).toFixed(1)}K`
    : `$${abs.toFixed(2)}`
  return n < 0 ? `-${s}` : s
}

function fmtDate(d: string) {
  return d ? d.slice(0, 10) : '—'
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: T.muted, fontFamily: mono, letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? T.text, fontFamily: sora }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 3, fontFamily: mono }}>{sub}</div>}
    </div>
  )
}

function PhaseBadge({ phase }: { phase: ScanProgress['phase'] }) {
  const map: Record<string, { label: string; color: string }> = {
    idle: { label: 'IDLE', color: T.muted },
    exits: { label: 'EXITS', color: T.warn },
    units: { label: 'UNITS', color: T.blue },
    entries: { label: 'ENTRIES', color: T.accent },
    done: { label: 'DONE', color: T.up },
  }
  const { label, color } = map[phase] ?? { label: phase.toUpperCase(), color: T.muted }
  return (
    <span style={{ fontSize: 10, fontFamily: mono, color, background: color + '18', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.08em' }}>
      {label}
    </span>
  )
}

function ScannerBar({
  scannerStatus, scanProgress, onTrigger, onStop, scanning,
}: {
  scannerStatus: ScannerStatus | null
  scanProgress: ScanProgress | null
  onTrigger: () => void
  onStop: () => void
  scanning: boolean
}) {
  const isRunning = scannerStatus?.isRunning || (scanProgress?.phase && scanProgress.phase !== 'idle' && scanProgress.phase !== 'done')
  const pct = scanProgress && scanProgress.symbolsTotal > 0
    ? Math.round((scanProgress.symbolsDone / scanProgress.symbolsTotal) * 100)
    : 0

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
          background: isRunning ? T.accent : T.dim,
          animation: isRunning ? 'tpulse 1.5s infinite' : 'none',
        }} />
        <span style={{ fontSize: 11, fontFamily: mono, color: isRunning ? T.accent : T.muted, letterSpacing: '0.05em' }}>
          SCANNER {isRunning ? 'RUNNING' : 'IDLE'}
        </span>
      </div>

      {scanProgress && scanProgress.phase !== 'idle' && (
        <>
          <PhaseBadge phase={scanProgress.phase} />
          {scanProgress.currentSymbol && (
            <span style={{ fontSize: 11, fontFamily: mono, color: T.muted }}>
              {scanProgress.currentSymbol}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 80 }}>
            <div style={{ height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: T.accent, borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: mono, marginTop: 2 }}>
              {scanProgress.symbolsDone}/{scanProgress.symbolsTotal} symbols
            </div>
          </div>
        </>
      )}

      {scannerStatus?.lastRun && (
        <span style={{ fontSize: 10, color: T.dim, fontFamily: mono }}>
          Last: {new Date(scannerStatus.lastRun).toLocaleTimeString()}
        </span>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {isRunning ? (
          <button
            onClick={onStop}
            style={{
              padding: '5px 14px', borderRadius: 5, border: `1px solid ${T.down}`,
              background: 'transparent', color: T.down, cursor: 'pointer',
              fontSize: 11, fontFamily: mono, letterSpacing: '0.05em',
            }}
          >
            STOP
          </button>
        ) : (
          <button
            onClick={onTrigger}
            disabled={scanning}
            style={{
              padding: '5px 14px', borderRadius: 5, border: `1px solid ${T.accent}`,
              background: T.accentDim, color: T.accent, cursor: scanning ? 'not-allowed' : 'pointer',
              fontSize: 11, fontFamily: mono, letterSpacing: '0.05em', opacity: scanning ? 0.5 : 1,
            }}
          >
            {scanning ? 'SCANNING…' : 'RUN SCAN'}
          </button>
        )}
      </div>
    </div>
  )
}

function PnLSparkline({ data }: { data: DailyPnL[] }) {
  if (!data.length) return <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: 11, fontFamily: mono }}>No data</div>

  const values = data.map(d => d.cumulativePnl)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 400
  const H = 60
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * W
    const y = H - ((v - min) / range) * (H - 4) - 2
    return `${x},${y}`
  })
  const lastVal = values[values.length - 1]
  const color = lastVal >= 0 ? T.up : T.down
  const pathD = `M ${pts.join(' L ')}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 60 }} preserveAspectRatio="none">
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} />
      <path d={`${pathD} L ${W},${H} L 0,${H} Z`} fill={color} fillOpacity={0.08} />
    </svg>
  )
}

function SideBadge({ side }: { side: string }) {
  const isLong = side === 'long'
  return (
    <span style={{
      fontSize: 9, fontFamily: mono, fontWeight: 700, letterSpacing: '0.08em',
      padding: '2px 7px', borderRadius: 3,
      color: isLong ? T.up : T.down,
      background: isLong ? T.up + '1a' : T.down + '1a',
      border: `1px solid ${isLong ? T.up + '33' : T.down + '33'}`,
    }}>
      {side.toUpperCase()}
    </span>
  )
}

function SysBadge({ sys }: { sys: number }) {
  return (
    <span style={{
      fontSize: 9, fontFamily: mono, fontWeight: 700, letterSpacing: '0.08em',
      padding: '2px 6px', borderRadius: 3,
      color: sys === 1 ? T.blue : T.warn,
      background: sys === 1 ? T.blue + '1a' : T.warn + '1a',
    }}>
      S{sys}
    </span>
  )
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    ENTERED: { color: T.up, bg: T.up + '1a' },
    PASS: { color: T.accent, bg: T.accentDim },
    'NO SIGNAL': { color: T.muted, bg: T.border },
    STOP_TRIGGERED: { color: T.down, bg: T.down + '1a' },
    UNIT_ADDED: { color: T.blue, bg: T.blue + '1a' },
    EXITED: { color: T.warn, bg: T.warn + '1a' },
  }
  const style = map[action] ?? { color: T.muted, bg: T.border }
  return (
    <span style={{
      fontSize: 9, fontFamily: mono, fontWeight: 700, letterSpacing: '0.08em',
      padding: '2px 7px', borderRadius: 3,
      color: style.color, background: style.bg,
    }}>
      {action}
    </span>
  )
}

function PnLBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.abs(value) / max * 100) : 0
  const color = value >= 0 ? T.up : T.down
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 60, height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: mono, color, minWidth: 70 }}>
        {value >= 0 ? '+' : ''}{fmtDollar(value)}
      </span>
    </div>
  )
}

function TradeRow({ trade, maxPnl, onClose, onChart, closing }: {
  trade: Trade; maxPnl: number; onClose: (id: number) => void; onChart: (sym: string) => void; closing: boolean
}) {
  const pnl = trade.unrealizedPnl ?? 0

  return (
    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
      <td style={{ padding: '8px 10px' }}>
        <button
          onClick={() => onChart(trade.symbol)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontFamily: mono, fontSize: 12, fontWeight: 600 }}
        >
          {trade.symbol}
        </button>
      </td>
      <td style={{ padding: '8px 6px' }}><SideBadge side={trade.side} /></td>
      <td style={{ padding: '8px 6px' }}><SysBadge sys={trade.system} /></td>
      <td style={{ padding: '8px 6px', fontFamily: mono, fontSize: 11, color: T.muted }}>
        {trade.unitCount}/{trade.system === 1 ? 4 : 2}
      </td>
      <td style={{ padding: '8px 6px', fontFamily: mono, fontSize: 11, color: T.text }}>
        ${trade.avgEntryPrice?.toFixed(2) ?? '—'}
      </td>
      <td style={{ padding: '8px 6px', fontFamily: mono, fontSize: 11, color: T.warn }}>
        {trade.currentStop ? `$${trade.currentStop.toFixed(2)}` : '—'}
      </td>
      <td style={{ padding: '8px 6px', fontFamily: mono, fontSize: 11, color: T.text }}>
        {trade.currentPrice ? `$${trade.currentPrice.toFixed(2)}` : '—'}
      </td>
      <td style={{ padding: '8px 6px' }}>
        <PnLBar value={pnl} max={maxPnl} />
      </td>
      <td style={{ padding: '8px 6px', fontFamily: mono, fontSize: 11, color: T.muted }}>
        {trade.totalShares}
      </td>
      <td style={{ padding: '8px 6px', fontFamily: mono, fontSize: 10, color: T.dim }}>
        {fmtDate(trade.entryDate)}
      </td>
      <td style={{ padding: '8px 6px' }}>
        <button
          onClick={() => onClose(trade.id)}
          disabled={closing}
          style={{
            padding: '3px 10px', borderRadius: 4, border: `1px solid ${T.down}40`,
            background: 'transparent', color: T.down, cursor: closing ? 'not-allowed' : 'pointer',
            fontSize: 10, fontFamily: mono, opacity: closing ? 0.5 : 1,
          }}
        >
          CLOSE
        </button>
      </td>
    </tr>
  )
}

function TradeCard({ trade, onClose, onChart, closing }: {
  trade: Trade; onClose: (id: number) => void; onChart: (sym: string) => void; closing: boolean
}) {
  const pnl = trade.unrealizedPnl ?? 0
  const pnlColor = pnl >= 0 ? T.up : T.down

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button
          onClick={() => onChart(trade.symbol)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontFamily: mono, fontSize: 14, fontWeight: 700, padding: 0 }}
        >
          {trade.symbol}
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          <SideBadge side={trade.side} />
          <SysBadge sys={trade.system} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: T.dim, fontFamily: mono, letterSpacing: '0.08em', marginBottom: 2 }}>ENTRY</div>
          <div style={{ fontSize: 12, fontFamily: mono, color: T.text }}>${trade.avgEntryPrice?.toFixed(2) ?? '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: T.dim, fontFamily: mono, letterSpacing: '0.08em', marginBottom: 2 }}>STOP</div>
          <div style={{ fontSize: 12, fontFamily: mono, color: T.warn }}>{trade.currentStop ? `$${trade.currentStop.toFixed(2)}` : '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: T.dim, fontFamily: mono, letterSpacing: '0.08em', marginBottom: 2 }}>CURRENT</div>
          <div style={{ fontSize: 12, fontFamily: mono, color: T.text }}>{trade.currentPrice ? `$${trade.currentPrice.toFixed(2)}` : '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: T.dim, fontFamily: mono, letterSpacing: '0.08em', marginBottom: 2 }}>UNREAL P&L</div>
          <div style={{ fontSize: 12, fontFamily: mono, color: pnlColor }}>{pnl >= 0 ? '+' : ''}{fmtDollar(pnl)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: T.dim, fontFamily: mono, letterSpacing: '0.08em', marginBottom: 2 }}>UNITS</div>
          <div style={{ fontSize: 12, fontFamily: mono, color: T.muted }}>{trade.unitCount}/{trade.system === 1 ? 4 : 2}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: T.dim, fontFamily: mono, letterSpacing: '0.08em', marginBottom: 2 }}>SHARES</div>
          <div style={{ fontSize: 12, fontFamily: mono, color: T.muted }}>{trade.totalShares}</div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <button
          onClick={() => onClose(trade.id)}
          disabled={closing}
          style={{
            padding: '4px 12px', borderRadius: 4, border: `1px solid ${T.down}40`,
            background: 'transparent', color: T.down, cursor: closing ? 'not-allowed' : 'pointer',
            fontSize: 10, fontFamily: mono, opacity: closing ? 0.5 : 1,
          }}
        >
          CLOSE
        </button>
      </div>
    </div>
  )
}

function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', bottom: 80, right: 20, zIndex: 9999,
        background: T.surface, border: `1px solid ${type === 'success' ? T.up : T.down}`,
        borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <span style={{ fontSize: 11, fontFamily: mono, color: type === 'success' ? T.up : T.down }}>{message}</span>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 14, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}

export default function TerminalDashboard() {
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
  const [scanning, setScanning] = useState(false)
  const [closingId, setClosingId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

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
    try {
      const result = await syncWithSchwab()
      const parts: string[] = []
      if (result.exitsCount > 0) parts.push(`${result.exitsCount} exit${result.exitsCount > 1 ? 's' : ''} reconciled`)
      if (result.entriesCount > 0) parts.push(`${result.entriesCount} entr${result.entriesCount > 1 ? 'ies' : 'y'} updated`)
      if (parts.length === 0) parts.push('All positions up to date')
      showToast(parts.join(' · '), 'success')
      await refresh()
    } catch {
      showToast('Sync with Schwab failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  async function handleTriggerScan() {
    setScanning(true)
    try {
      await triggerScan()
      showToast('Scan triggered', 'success')
      await refresh()
    } catch {
      showToast('Failed to trigger scan', 'error')
    } finally {
      setScanning(false)
    }
  }

  async function handleStopScan() {
    try {
      await stopScan()
      showToast('Scan stopped', 'success')
      await refresh()
    } catch {
      showToast('Failed to stop scan', 'error')
    }
  }

  async function handleCloseTrade(id: number) {
    setClosingId(id)
    try {
      await closeTrade(id)
      showToast('Trade closed', 'success')
      await refresh()
    } catch {
      showToast('Failed to close trade', 'error')
    } finally {
      setClosingId(null)
    }
  }

  const totalUnrealizedPnl = trades.reduce((sum, t) => sum + (t.unrealizedPnl ?? 0), 0)
  const maxPnl = trades.length > 0 ? Math.max(...trades.map(t => Math.abs(t.unrealizedPnl ?? 0))) : 1

  const latestCreatedAt = signals.length > 0 ? new Date(signals[0].createdAt).getTime() : null
  const latestSignals = latestCreatedAt
    ? signals.filter(s => latestCreatedAt - new Date(s.createdAt).getTime() < 15 * 60 * 1000)
    : signals
  const latestScanDate = latestSignals.length > 0 ? latestSignals[0].scanDate : null

  const thStyle: React.CSSProperties = {
    padding: '6px 10px', fontSize: 9, fontFamily: mono, color: T.muted,
    letterSpacing: '0.1em', textAlign: 'left', borderBottom: `1px solid ${T.border}`,
    fontWeight: 400, whiteSpace: 'nowrap',
  }

  return (
    <>
      <style>{pulseStyle}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: sora }}>Dashboard</div>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: mono, marginTop: 2 }}>
              AUTO-REFRESH · 30s
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isDryRun && (
              <span style={{ fontSize: 10, fontFamily: mono, color: T.warn, background: T.warn + '1a', border: `1px solid ${T.warn}40`, padding: '4px 10px', borderRadius: 4, letterSpacing: '0.08em' }}>
                DRY RUN
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                padding: '6px 14px', borderRadius: 5, border: `1px solid ${T.border}`,
                background: T.surface, color: T.muted, cursor: syncing ? 'not-allowed' : 'pointer',
                fontSize: 10, fontFamily: mono, letterSpacing: '0.05em', opacity: syncing ? 0.5 : 1,
              }}
            >
              {syncing ? 'SYNCING…' : 'SYNC SCHWAB'}
            </button>
          </div>
        </div>

        {/* Account Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}
          className="grid-cols-2 md:grid-cols-4">
          <StatCard
            label="EQUITY"
            value={loading ? '…' : fmtDollar(account?.equity)}
            sub={account ? `Cash: ${fmtDollar(account.cash)}` : undefined}
          />
          <StatCard
            label="BUYING POWER"
            value={loading ? '…' : fmtDollar(account?.buyingPower)}
            sub={account?.pendingManualOrders?.length ? `${account.pendingManualOrders.length} pending orders` : undefined}
            color={account?.pendingManualOrders?.length ? T.warn : undefined}
          />
          <StatCard
            label="UNREALIZED P&L"
            value={loading ? '…' : (totalUnrealizedPnl >= 0 ? '+' : '') + fmtDollar(totalUnrealizedPnl)}
            sub={`${trades.length} open trade${trades.length !== 1 ? 's' : ''}`}
            color={totalUnrealizedPnl >= 0 ? T.up : T.down}
          />
          <StatCard
            label="WIN RATE"
            value={loading || !stats ? '…' : `${(stats.winRate * 100).toFixed(1)}%`}
            sub={stats ? `${stats.closedTrades} closed trades` : undefined}
            color={stats && stats.winRate >= 0.5 ? T.up : T.down}
          />
        </div>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'TOTAL TRADES', value: String(stats.totalTrades) },
              { label: 'TOTAL P&L', value: (stats.totalPnl >= 0 ? '+' : '') + fmtDollar(stats.totalPnl), color: stats.totalPnl >= 0 ? T.up : T.down },
              { label: 'PROFIT FACTOR', value: stats.profitFactor ? stats.profitFactor.toFixed(2) : '—', color: stats.profitFactor >= 1 ? T.up : T.down },
              { label: 'AVG HOLD', value: stats.avgHoldDays ? `${stats.avgHoldDays.toFixed(1)}d` : '—' },
              { label: 'AVG WIN', value: fmtDollar(stats.avgWin), color: T.up },
              { label: 'AVG LOSS', value: fmtDollar(stats.avgLoss), color: T.down },
            ].map(item => (
              <div key={item.label} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 14px' }}>
                <div style={{ fontSize: 9, color: T.dim, fontFamily: mono, letterSpacing: '0.1em', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: item.color ?? T.text, fontFamily: mono }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Scanner Bar */}
        <div style={{ marginBottom: 16 }}>
          <ScannerBar
            scannerStatus={scannerStatus}
            scanProgress={scanProgress}
            onTrigger={handleTriggerScan}
            onStop={handleStopScan}
            scanning={scanning}
          />
        </div>

        {/* P&L Sparkline */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: mono, letterSpacing: '0.1em' }}>CUMULATIVE P&L — 30 DAYS</div>
            {dailyPnl.length > 0 && (
              <div style={{ fontSize: 12, fontFamily: mono, color: (dailyPnl[dailyPnl.length - 1]?.cumulativePnl ?? 0) >= 0 ? T.up : T.down, fontWeight: 600 }}>
                {(dailyPnl[dailyPnl.length - 1]?.cumulativePnl ?? 0) >= 0 ? '+' : ''}{fmtDollar(dailyPnl[dailyPnl.length - 1]?.cumulativePnl)}
              </div>
            )}
          </div>
          <PnLSparkline data={dailyPnl} />
        </div>

        {/* Open Trades — Desktop table */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontFamily: mono, color: T.accent, letterSpacing: '0.08em' }}>
              OPEN TRADES <span style={{ color: T.muted, marginLeft: 6 }}>{trades.length}</span>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: T.muted, fontFamily: mono, fontSize: 11 }}>Loading…</div>
            ) : trades.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: T.dim, fontFamily: mono, fontSize: 11 }}>No open trades</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.surface2 }}>
                    {['SYMBOL', 'SIDE', 'SYS', 'UNITS', 'ENTRY', 'STOP', 'CURRENT', 'P&L', 'SHARES', 'DATE', ''].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map(trade => (
                    <TradeRow
                      key={trade.id}
                      trade={trade}
                      maxPnl={maxPnl}
                      onClose={handleCloseTrade}
                      onChart={setChartSymbol}
                      closing={closingId === trade.id}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: T.muted, fontFamily: mono, fontSize: 11 }}>Loading…</div>
            ) : trades.length === 0 ? (
              <div style={{ textAlign: 'center', color: T.dim, fontFamily: mono, fontSize: 11 }}>No open trades</div>
            ) : (
              trades.map(trade => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  onClose={handleCloseTrade}
                  onChart={setChartSymbol}
                  closing={closingId === trade.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Pending Manual Orders */}
        {account?.pendingManualOrders && account.pendingManualOrders.length > 0 && (
          <div style={{ background: T.warn + '10', border: `1px solid ${T.warn}33`, borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: mono, color: T.warn, letterSpacing: '0.1em', marginBottom: 8 }}>
              PENDING MANUAL ORDERS ({account.pendingManualOrders.length})
            </div>
            {account.pendingManualOrders.map(o => (
              <div key={o.id} style={{ fontSize: 11, fontFamily: mono, color: T.text, marginBottom: 4 }}>
                <span style={{ color: T.warn }}>{o.symbol}</span>
                <span style={{ color: T.muted, marginLeft: 8 }}>{o.side} {o.qty} shares</span>
                <span style={{ color: T.dim, marginLeft: 8 }}>{o.instructions}</span>
              </div>
            ))}
          </div>
        )}

        {/* Latest Signals */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontFamily: mono, color: T.accent, letterSpacing: '0.08em' }}>
              LATEST SIGNALS
              {latestScanDate && <span style={{ color: T.dim, marginLeft: 8, fontWeight: 400 }}>{latestScanDate}</span>}
            </div>
            <span style={{ fontSize: 10, color: T.muted, fontFamily: mono }}>{latestSignals.length} symbols</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: T.muted, fontFamily: mono, fontSize: 11 }}>Loading…</div>
            ) : latestSignals.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: T.dim, fontFamily: mono, fontSize: 11 }}>No signals</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.surface2 }}>
                    {['SYMBOL', 'DATE', 'SYS', 'DIRECTION', 'ACTION', 'CLOSE', 'ATR', 'ENTRY?'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {latestSignals.map(sig => (
                    <tr key={sig.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '7px 10px', fontFamily: mono, fontSize: 12, color: T.text, fontWeight: 600 }}>{sig.symbol}</td>
                      <td style={{ padding: '7px 6px', fontFamily: mono, fontSize: 10, color: T.dim }}>{fmtDate(sig.scanDate)}</td>
                      <td style={{ padding: '7px 6px' }}><SysBadge sys={sig.system} /></td>
                      <td style={{ padding: '7px 6px', fontFamily: mono, fontSize: 11, color: sig.direction === 'long' ? T.up : T.down }}>
                        {sig.direction?.toUpperCase() ?? '—'}
                      </td>
                      <td style={{ padding: '7px 6px' }}><ActionBadge action={sig.actionTaken ?? 'NO SIGNAL'} /></td>
                      <td style={{ padding: '7px 6px', fontFamily: mono, fontSize: 11, color: T.text }}>
                        {sig.close ? `$${sig.close.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '7px 6px', fontFamily: mono, fontSize: 11, color: T.muted }}>
                        {sig.atrValue ? sig.atrValue.toFixed(2) : '—'}
                      </td>
                      <td style={{ padding: '7px 6px' }}>
                        {sig.entryBreakout ? (
                          <span style={{ color: T.accent, fontFamily: mono, fontSize: 11 }}>↑ YES</span>
                        ) : (
                          <span style={{ color: T.dim, fontFamily: mono, fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {chartSymbol && (
        <TradeChartModal symbol={chartSymbol} onClose={() => setChartSymbol(null)} />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </>
  )
}
