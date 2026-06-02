import type { ScanProgress as Progress } from '../api/client'

interface Props {
  progress: Progress | null
}

export default function ScanProgress({ progress }: Props) {
  if (!progress || progress.phase === 'idle' || progress.phase === 'done') return null

  const pct = progress.symbolsTotal > 0
    ? Math.round((progress.symbolsDone / progress.symbolsTotal) * 100)
    : 0

  const phaseLabel: Record<string, string> = {
    exits: 'Checking exits',
    units: 'Checking unit additions',
    entries: 'Checking entries',
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
          {phaseLabel[progress.phase] ?? progress.phase}
          {progress.currentSymbol && ` — ${progress.currentSymbol}`}
        </span>
        <span className="text-xs text-blue-600 dark:text-blue-400">{pct}%</span>
      </div>
      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
        {progress.symbolsDone} / {progress.symbolsTotal} symbols
      </p>
    </div>
  )
}
