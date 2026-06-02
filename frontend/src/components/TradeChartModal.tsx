import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, LineStyle, CandlestickSeries, LineSeries } from 'lightweight-charts'
import type { ChartData } from '../api/client'
import { fetchChartData } from '../api/client'

interface Props {
  symbol: string
  onClose: () => void
}

export default function TradeChartModal({ symbol, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSystem, setActiveSystem] = useState<'sys1' | 'sys2'>('sys1')

  useEffect(() => {
    fetchChartData(symbol, 200)
      .then(setChartData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [symbol])

  useEffect(() => {
    if (!chartData || !containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#334155' },
      timeScale: { borderColor: '#334155', timeVisible: true },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    const candleData = chartData.bars.map((b) => ({
      time: b.t.slice(0, 10) as `${number}-${number}-${number}`,
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
    }))
    candleSeries.setData(candleData)

    const toLineData = (arr: (number | null)[]) =>
      chartData.bars
        .map((b, i) => ({ time: b.t.slice(0, 10) as `${number}-${number}-${number}`, value: arr[i] ?? NaN }))
        .filter((d) => !isNaN(d.value))

    const sys = activeSystem
    const upper = sys === 'sys1' ? chartData.indicators.sys1Upper : chartData.indicators.sys2Upper
    const lower = sys === 'sys1' ? chartData.indicators.sys1Lower : chartData.indicators.sys2Lower
    const exitLower = sys === 'sys1' ? chartData.indicators.sys1ExitLower : chartData.indicators.sys2ExitLower

    const entryUpperLine = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Entry Upper' })
    entryUpperLine.setData(toLineData(upper))

    const entryLowerLine = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Entry Lower' })
    entryLowerLine.setData(toLineData(lower))

    const exitLine = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'Exit Lower' })
    exitLine.setData(toLineData(exitLower))

    chart.timeScale().fitContent()

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [chartData, activeSystem])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const cfg = chartData?.config

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#0f172a', borderRadius: '12px', width: '100%', maxWidth: '900px', overflow: 'hidden', border: '1px solid #1e293b' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9' }}>{symbol}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['sys1', 'sys2'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveSystem(s)}
                  style={{
                    padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: activeSystem === s ? '#3b82f6' : '#1e293b',
                    color: activeSystem === s ? '#fff' : '#94a3b8',
                  }}
                >
                  {s === 'sys1' ? `System 1 (${cfg?.sys1Entry ?? 20}d)` : `System 2 (${cfg?.sys2Entry ?? 55}d)`}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#1e293b', border: 'none', color: '#94a3b8', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>

        {/* Legend */}
        <div style={{ padding: '8px 20px', display: 'flex', gap: '16px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '2px', background: '#3b82f6', borderTop: '2px dashed #3b82f6' }} />
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Entry Channel</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '2px', background: '#f59e0b', borderTop: '2px dotted #f59e0b' }} />
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Exit Level</span>
          </div>
          {cfg && (
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              ATR period: {cfg.atrPeriod}d · Exit: {activeSystem === 'sys1' ? cfg.sys1Exit : cfg.sys2Exit}d
            </span>
          )}
        </div>

        {/* Chart */}
        <div style={{ padding: '0' }}>
          {loading && (
            <div style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Loading chart data…
            </div>
          )}
          {error && (
            <div style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '13px' }}>
              Error: {error}
            </div>
          )}
          {!loading && !error && <div ref={containerRef} style={{ width: '100%' }} />}
        </div>
      </div>
    </div>
  )
}
