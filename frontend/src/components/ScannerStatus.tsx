import { useState } from 'react'
import type { ScannerStatus as Status, ScanResult } from '../api/client'
import { triggerScan, stopScan } from '../api/client'

interface Props {
  status: Status | null
  onScanComplete?: (result: ScanResult) => void
}

export default function ScannerStatus({ status, onScanComplete }: Props) {
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)

  async function handleScan(force = false) {
    setScanning(true)
    try {
      const result = await triggerScan(force)
      setLastResult(result)
      onScanComplete?.(result)
    } catch (e) {
      console.error(e)
    } finally {
      setScanning(false)
    }
  }

  async function handleStop() {
    await stopScan()
  }

  const isRunning = status?.isRunning || scanning

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`} />
          <span className="font-semibold text-sm text-gray-800 dark:text-white">
            {isRunning ? 'Scanning…' : 'Scanner Idle'}
          </span>
        </div>
        <div className="flex gap-2">
          {isRunning ? (
            <button onClick={handleStop} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">Stop</button>
          ) : (
            <>
              <button onClick={() => handleScan(false)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Run Scan</button>
              <button onClick={() => handleScan(true)} className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200">Force</button>
            </>
          )}
        </div>
      </div>
      {status?.lastRun && (
        <p className="text-xs text-gray-500">Last run: {new Date(status.lastRun).toLocaleString()}</p>
      )}
      {lastResult && (
        <div className="text-xs text-gray-600 dark:text-gray-400 border-t pt-2 mt-1 dark:border-gray-700 space-y-1">
          <div>
            <span className="font-medium">Last result:</span>{' '}
            {lastResult.entriesOpened} entries · {lastResult.exitsExecuted} exits · {lastResult.unitsAdded} units added
            {lastResult.skipped.length > 0 && <span className="text-gray-400"> · {lastResult.skipped.length} skipped</span>}
            {lastResult.errors.length > 0 && <span className="text-red-500"> · {lastResult.errors.length} errors</span>}
          </div>
          {lastResult.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded p-2 space-y-0.5">
              {lastResult.errors.map((e, i) => (
                <div key={i} className="text-red-600 dark:text-red-400">{e}</div>
              ))}
            </div>
          )}
          {lastResult.skipped.length > 0 && (
            <div className="text-gray-400 dark:text-gray-500">
              Skipped: {lastResult.skipped.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
