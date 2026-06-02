/**
 * Turtle trading signal evaluation.
 * Implements System 1 (short-term) and System 2 (long-term) breakout detection.
 * Pure signal logic — no DB writes, no broker calls.
 */
import { Bar, calcATR, calcDonchianUpperClose, calcDonchianLowerClose, calcUnitSize, isLongBreakout, isShortBreakout } from './indicatorService';

export interface TurtleConfig {
  sys1EntryPeriod: number;
  sys1ExitPeriod: number;
  sys2EntryPeriod: number;
  sys2ExitPeriod: number;
  atrPeriod: number;
  riskPctPerUnit: number;
  maxUnits: number;
  stopMultiplier: number;
  allowShort: boolean;
  enabledSystems: number[];
}

export interface EntrySignal {
  symbol: string;
  scanDate: string;
  system: 1 | 2;
  direction: 'long' | 'short';
  close: number;
  atrN: number;
  dcEntryUpper: number;
  dcEntryLower: number;
  unitSize: number; // shares for 1 unit
  stopLoss: number;
  canEnter: boolean;
}

export interface ExitSignal {
  symbol: string;
  system: 1 | 2;
  direction: 'long' | 'short';
  shouldExit: boolean;
  reason: string | null;
  close: number;
  dcExitLower: number;
  dcExitUpper: number;
}

export interface UnitAddSignal {
  shouldAdd: boolean;
  reason: string | null;
  unitNumber: number;
  newStopLoss: number;
  unitSize: number;
}

export function parseTurtleConfig(config: Record<string, string>): TurtleConfig {
  const systems = (config['ENABLED_SYSTEMS'] ?? '1,2')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => n === 1 || n === 2) as number[];

  return {
    sys1EntryPeriod: parseInt(config['SYS1_ENTRY_PERIOD'] ?? '20', 10),
    sys1ExitPeriod: parseInt(config['SYS1_EXIT_PERIOD'] ?? '10', 10),
    sys2EntryPeriod: parseInt(config['SYS2_ENTRY_PERIOD'] ?? '55', 10),
    sys2ExitPeriod: parseInt(config['SYS2_EXIT_PERIOD'] ?? '20', 10),
    atrPeriod: parseInt(config['ATR_PERIOD'] ?? '14', 10),
    riskPctPerUnit: parseFloat(config['RISK_PCT_PER_UNIT'] ?? '1'),
    maxUnits: parseInt(config['MAX_UNITS'] ?? '4', 10),
    stopMultiplier: parseFloat(config['STOP_LOSS_MULTIPLIER'] ?? '2'),
    allowShort: config['ALLOW_SHORT'] === 'true',
    enabledSystems: systems.length > 0 ? systems : [1, 2],
  };
}

/**
 * Evaluate entry signals for a symbol across enabled systems.
 */
export function evaluateEntries(
  symbol: string,
  bars: Bar[],
  cfg: TurtleConfig,
  accountEquity: number,
  date?: string
): EntrySignal[] {
  const signals: EntrySignal[] = [];
  const scanDate = date ?? new Date().toISOString().split('T')[0]!;

  if (bars.length < Math.max(cfg.sys2EntryPeriod, cfg.atrPeriod) + 5) {
    return signals;
  }

  const closes = bars.map((b) => b.c);
  const atrArr = calcATR(bars, cfg.atrPeriod);
  const atrN = atrArr[atrArr.length - 1] ?? NaN;
  const close = closes[closes.length - 1]!;

  if (isNaN(atrN) || atrN <= 0) return signals;

  for (const system of cfg.enabledSystems) {
    const entryPeriod = system === 1 ? cfg.sys1EntryPeriod : cfg.sys2EntryPeriod;

    // Check LONG entry
    const dcUpperArr = calcDonchianUpperClose(closes, entryPeriod);
    const dcLowerArr = calcDonchianLowerClose(closes, entryPeriod);
    const dcEntryUpper = dcUpperArr[dcUpperArr.length - 1] ?? NaN;
    const dcEntryLower = dcLowerArr[dcLowerArr.length - 1] ?? NaN;

    if (!isNaN(dcEntryUpper) && !isNaN(dcEntryLower)) {
      const longBreak = isLongBreakout(closes, entryPeriod);
      if (longBreak) {
        const unitSize = calcUnitSize(accountEquity, cfg.riskPctPerUnit, atrN, cfg.stopMultiplier);
        const stopLoss = close - cfg.stopMultiplier * atrN;
        signals.push({
          symbol,
          scanDate,
          system: system as 1 | 2,
          direction: 'long',
          close,
          atrN,
          dcEntryUpper,
          dcEntryLower,
          unitSize,
          stopLoss,
          canEnter: unitSize >= 1,
        });
      }

      // Check SHORT entry
      if (cfg.allowShort) {
        const shortBreak = isShortBreakout(closes, entryPeriod);
        if (shortBreak) {
          const unitSize = calcUnitSize(accountEquity, cfg.riskPctPerUnit, atrN, cfg.stopMultiplier);
          const stopLoss = close + cfg.stopMultiplier * atrN;
          signals.push({
            symbol,
            scanDate,
            system: system as 1 | 2,
            direction: 'short',
            close,
            atrN,
            dcEntryUpper,
            dcEntryLower,
            unitSize,
            stopLoss,
            canEnter: unitSize >= 1,
          });
        }
      }
    }
  }

  return signals;
}

/**
 * Evaluate exit signal for an open trade.
 */
export function evaluateExit(
  symbol: string,
  bars: Bar[],
  cfg: TurtleConfig,
  system: 1 | 2,
  direction: 'long' | 'short',
  currentStop: number
): ExitSignal {
  const exitPeriod = system === 1 ? cfg.sys1ExitPeriod : cfg.sys2ExitPeriod;
  const closes = bars.map((b) => b.c);
  const close = closes[closes.length - 1]!;

  // Exclude today's close so a new N-day closing low/high can be detected.
  // Including today would make close < dcExitLower always false (a value can't
  // be less than the minimum of a set it belongs to).
  const prevCloses = closes.slice(0, -1);
  const dcExitLowerArr = calcDonchianLowerClose(prevCloses, exitPeriod);
  const dcExitUpperArr = calcDonchianUpperClose(prevCloses, exitPeriod);
  const dcExitLower = dcExitLowerArr[dcExitLowerArr.length - 1] ?? NaN;
  const dcExitUpper = dcExitUpperArr[dcExitUpperArr.length - 1] ?? NaN;

  // Stop loss hit?
  if (direction === 'long' && close <= currentStop) {
    return { symbol, system, direction, shouldExit: true, reason: 'stop_loss', close, dcExitLower, dcExitUpper };
  }
  if (direction === 'short' && close >= currentStop) {
    return { symbol, system, direction, shouldExit: true, reason: 'stop_loss', close, dcExitLower, dcExitUpper };
  }

  // Donchian exit?
  if (direction === 'long' && !isNaN(dcExitLower) && close < dcExitLower) {
    return { symbol, system, direction, shouldExit: true, reason: 'donchian_exit', close, dcExitLower, dcExitUpper };
  }
  if (direction === 'short' && !isNaN(dcExitUpper) && close > dcExitUpper) {
    return { symbol, system, direction, shouldExit: true, reason: 'donchian_exit', close, dcExitLower, dcExitUpper };
  }

  return { symbol, system, direction, shouldExit: false, reason: null, close, dcExitLower, dcExitUpper };
}

/**
 * Evaluate whether a new unit should be added to an existing trade.
 * Unit N is added when price moves 0.5*(N-1)*atrN above unit 1 entry (long).
 */
export function evaluateUnitAdd(
  bars: Bar[],
  cfg: TurtleConfig,
  direction: 'long' | 'short',
  unit1EntryPrice: number,
  unit1AtrN: number,
  currentUnitCount: number,
  accountEquity: number
): UnitAddSignal {
  const close = bars[bars.length - 1]!.c;
  const maxUnits = cfg.maxUnits;

  if (currentUnitCount >= maxUnits) {
    return { shouldAdd: false, reason: 'max_units_reached', unitNumber: currentUnitCount, newStopLoss: 0, unitSize: 0 };
  }

  const nextUnit = currentUnitCount + 1;
  // Price threshold for next unit: unit1Entry + 0.5*(nextUnit-1)*N (long)
  const threshold = direction === 'long'
    ? unit1EntryPrice + 0.5 * (nextUnit - 1) * unit1AtrN
    : unit1EntryPrice - 0.5 * (nextUnit - 1) * unit1AtrN;

  const conditionMet = direction === 'long' ? close >= threshold : close <= threshold;

  if (!conditionMet) {
    return { shouldAdd: false, reason: null, unitNumber: currentUnitCount, newStopLoss: 0, unitSize: 0 };
  }

  const atrArr = calcATR(bars, cfg.atrPeriod);
  const currentAtrN = atrArr[atrArr.length - 1] ?? unit1AtrN;
  const unitSize = calcUnitSize(accountEquity, cfg.riskPctPerUnit, currentAtrN, cfg.stopMultiplier);
  const newStopLoss = direction === 'long'
    ? close - cfg.stopMultiplier * currentAtrN
    : close + cfg.stopMultiplier * currentAtrN;

  return {
    shouldAdd: true,
    reason: `unit_${nextUnit}_add`,
    unitNumber: nextUnit,
    newStopLoss,
    unitSize,
  };
}
