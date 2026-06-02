import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export interface AccountInfo {
  equity: number
  buyingPower: number
  cash: number
  daytradeCount: number
  pendingManualOrders: PendingManualOrder[]
}

export interface PendingManualOrder {
  id: string
  symbol: string
  side: string
  qty: number
  status: string
  instructions: string
  createdAt: string
}

export interface TradeUnit {
  id: number
  tradeId: number
  unitNumber: number
  entryDate: string
  entryPrice: number
  shares: number
  atrAtEntry: number
  stopLoss: number
  status: string
}

export interface Trade {
  id: number
  symbol: string
  side: 'long' | 'short'
  system: 1 | 2
  status: string
  broker: string
  entryDate: string
  exitDate?: string
  exitReason?: string
  exitPrice?: number
  unitCount: number
  currentStop?: number
  totalShares: number
  avgEntryPrice: number
  dollarAmount: number
  pnl?: number
  pnlPct?: number
  notes?: string
  units: TradeUnit[]
  currentPrice?: number | null
  unrealizedPnl?: number | null
  currentN?: number | null
}

export interface Signal {
  id: number
  symbol: string
  scanDate: string
  system: number
  direction: string
  close?: number
  dcEntryUpper?: number
  dcEntryLower?: number
  dcExitLower?: number
  dcExitUpper?: number
  atrValue?: number
  entryBreakout: boolean
  exitBreakout: boolean
  unitAddSignal: boolean
  stopTriggered: boolean
  actionTaken: string
  createdAt: string
}

export interface Config {
  [key: string]: string
}

export interface TradeStats {
  totalTrades: number
  openTrades: number
  closedTrades: number
  winRate: number
  totalPnl: number
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
  avgHoldDays: number
  profitFactor: number
}

export interface DailyPnL {
  date: string
  dailyPnl: number
  cumulativePnl: number
  equity: number
}

export interface ScannerStatus {
  isRunning: boolean
  lastRun: string | null
  nextRun: string
}

export interface ScanProgress {
  phase: 'idle' | 'exits' | 'units' | 'entries' | 'done'
  currentSymbol: string | null
  symbolsDone: number
  symbolsTotal: number
  stopped: boolean
  stoppedReason: string | null
}

export interface ScanResult {
  date: string
  tradingDay: boolean
  symbolsScanned: number
  entriesOpened: number
  unitsAdded: number
  exitsExecuted: number
  skipped: string[]
  errors: string[]
}

export interface Bar {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface ChartData {
  symbol: string
  bars: Bar[]
  indicators: {
    atr: (number | null)[]
    sys1Upper: (number | null)[]
    sys1Lower: (number | null)[]
    sys1ExitLower: (number | null)[]
    sys2Upper: (number | null)[]
    sys2Lower: (number | null)[]
    sys2ExitLower: (number | null)[]
  }
  config: {
    sys1Entry: number
    sys1Exit: number
    sys2Entry: number
    sys2Exit: number
    atrPeriod: number
  }
}

export interface SyncResult {
  entriesSynced: { symbol: string; oldPrice: number; newPrice: number }[]
  entriesCount: number
  exitsReconciled: { symbol: string; exitPrice: number }[]
  exitsCount: number
  schwabPositions: number
  dbOpenTrades: number
}

// Account
export async function fetchAccount(): Promise<AccountInfo> {
  return (await api.get<AccountInfo>('/account')).data
}

// Trades
export async function fetchOpenTrades(): Promise<Trade[]> {
  return (await api.get<Trade[]>('/trades/open')).data
}

export async function fetchAllTrades(): Promise<Trade[]> {
  return (await api.get<Trade[]>('/trades')).data
}

export async function fetchTrade(id: number): Promise<Trade> {
  return (await api.get<Trade>(`/trades/${id}`)).data
}

export async function closeTrade(id: number): Promise<void> {
  await api.delete(`/trades/${id}`)
}

export async function markTradeClosed(id: number, exitPrice?: number): Promise<void> {
  await api.post(`/trades/${id}/mark-closed`, exitPrice != null ? { exitPrice } : {})
}

export async function syncTradePrices(): Promise<{ synced: { symbol: string; oldPrice: number; newPrice: number }[]; count: number }> {
  return (await api.post('/trades/sync-prices')).data
}

export async function syncWithSchwab(): Promise<SyncResult> {
  return (await api.post('/trades/sync')).data
}

export async function importFidelityCSV(csv: string): Promise<{ parsed: unknown[]; count: number }> {
  return (await api.post('/trades/import-csv', { csv })).data
}

// Signals
export async function fetchSignals(params?: { date?: string; limit?: number; system?: number; direction?: string }): Promise<Signal[]> {
  return (await api.get<Signal[]>('/signals', { params })).data
}

export async function triggerScan(force = false): Promise<ScanResult> {
  return (await api.post<ScanResult>('/signals/scan', { force })).data
}

export async function fetchScannerStatus(): Promise<ScannerStatus> {
  return (await api.get<ScannerStatus>('/signals/scan/status')).data
}

export async function fetchScanProgress(): Promise<ScanProgress> {
  return (await api.get<ScanProgress>('/signals/scan/progress')).data
}

export async function stopScan(): Promise<void> {
  await api.post('/signals/scan/stop')
}

// Charts
export async function fetchChartData(symbol: string, limit = 200): Promise<ChartData> {
  return (await api.get<ChartData>(`/charts/${symbol}`, { params: { limit } })).data
}

// Config
export async function fetchConfig(): Promise<Config> {
  return (await api.get<Config>('/config')).data
}

export async function updateConfig(data: Partial<Config>): Promise<Config> {
  return (await api.put<Config>('/config', data)).data
}

// Stats
export async function fetchStats(): Promise<TradeStats> {
  return (await api.get<TradeStats>('/stats')).data
}

export async function fetchDailyPnL(days = 30): Promise<DailyPnL[]> {
  return (await api.get<DailyPnL[]>('/stats/daily-pnl', { params: { days } })).data
}
