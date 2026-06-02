/**
 * Pure indicator calculation functions — no side effects, fully testable.
 */

export interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/**
 * ATR using Wilder's smoothing.
 * True range = max(High-Low, |High-PrevClose|, |Low-PrevClose|)
 * Returns array same length as bars; first `period` values are NaN.
 */
export function calcATR(bars: Bar[], period: number): number[] {
  const len = bars.length;
  const result: number[] = new Array(len).fill(NaN);
  if (len < period + 1) return result;

  const trs: number[] = [];
  for (let i = 1; i < len; i++) {
    const hl = bars[i]!.h - bars[i]!.l;
    const hpc = Math.abs(bars[i]!.h - bars[i - 1]!.c);
    const lpc = Math.abs(bars[i]!.l - bars[i - 1]!.c);
    trs.push(Math.max(hl, hpc, lpc));
  }

  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period] = atr;

  for (let i = period + 1; i < len; i++) {
    atr = (atr * (period - 1) + trs[i - 1]!) / period;
    result[i] = atr;
  }

  return result;
}

/**
 * Donchian Upper — highest HIGH over last `period` bars (inclusive).
 * Uses highs for upper band (proper Donchian).
 */
export function calcDonchianUpper(bars: Bar[], period: number): number[] {
  const result: number[] = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let max = -Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (bars[j]!.h > max) max = bars[j]!.h;
    }
    result[i] = max;
  }
  return result;
}

/**
 * Donchian Lower — lowest LOW over last `period` bars (inclusive).
 */
export function calcDonchianLower(bars: Bar[], period: number): number[] {
  const result: number[] = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let min = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (bars[j]!.l < min) min = bars[j]!.l;
    }
    result[i] = min;
  }
  return result;
}

/**
 * Donchian Upper using closes only (for close-based breakout checks).
 */
export function calcDonchianUpperClose(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let max = -Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (closes[j]! > max) max = closes[j]!;
    }
    result[i] = max;
  }
  return result;
}

/**
 * Donchian Lower using closes only.
 */
export function calcDonchianLowerClose(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let min = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (closes[j]! < min) min = closes[j]!;
    }
    result[i] = min;
  }
  return result;
}

/**
 * Compute unit size (number of shares) for a given N and account equity.
 * unit_size = (equity * riskPct / 100) / (stopMultiplier * N)
 * Ensures the dollar loss if the stop is hit equals exactly riskPct% of equity.
 */
export function calcUnitSize(
  equity: number,
  riskPctPerUnit: number,
  atrN: number,
  stopMultiplier: number
): number {
  if (atrN <= 0 || stopMultiplier <= 0) return 0;
  const dollarRisk = equity * (riskPctPerUnit / 100);
  return Math.floor(dollarRisk / (stopMultiplier * atrN));
}

/**
 * Long stop loss = entry - multiplier * N
 * Short stop loss = entry + multiplier * N
 */
export function calcStopLoss(
  entryPrice: number,
  atrN: number,
  side: 'long' | 'short',
  multiplier = 2
): number {
  return side === 'long'
    ? entryPrice - multiplier * atrN
    : entryPrice + multiplier * atrN;
}

/**
 * Returns true if price crossed the Donchian upper for a long entry.
 * Breakout = close > highest close of previous `period` bars (not counting today).
 */
export function isLongBreakout(closes: number[], period: number): boolean {
  const len = closes.length;
  if (len < period + 1) return false;
  const today = closes[len - 1]!;
  // Compute max of previous `period` closes (excluding today)
  let max = -Infinity;
  for (let i = len - 1 - period; i < len - 1; i++) {
    if (closes[i]! > max) max = closes[i]!;
  }
  return today > max;
}

/**
 * Returns true if price crossed the Donchian lower for a short entry.
 */
export function isShortBreakout(closes: number[], period: number): boolean {
  const len = closes.length;
  if (len < period + 1) return false;
  const today = closes[len - 1]!;
  let min = Infinity;
  for (let i = len - 1 - period; i < len - 1; i++) {
    if (closes[i]! < min) min = closes[i]!;
  }
  return today < min;
}
