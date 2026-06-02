/**
 * Turtle Trading daily scanner.
 * Phase 1: Exit checks for all open trades (stop loss + Donchian exit)
 * Phase 2: Unit addition checks for open trades
 * Phase 3: Entry checks for watchlist symbols not yet in a position
 */
import { isTradingDay, todayStr } from '../utils/marketCalendar';
import { getConfig, setConfig } from './configService';
import { getAccount, getBars, closeFullPosition, placeBuyOrder, placeSellOrder } from './brokerService';
import { getBarsForSymbol } from './marketDataService';
import {
  parseTurtleConfig,
  evaluateEntries,
  evaluateExit,
  evaluateUnitAdd,
} from './turtleSignalService';
import { calcATR, calcDonchianUpperClose, calcDonchianLowerClose } from './indicatorService';
import {
  getOpenTrades,
  openTrade,
  addUnit,
  closeTrade,
  isInCooldown,
  hasOpenPosition,
} from './tradeService';
import { recordDailySnapshot } from './statsService';
import prisma from '../db/prisma';
import logger from '../utils/logger';

export interface ScanResult {
  date: string;
  tradingDay: boolean;
  symbolsScanned: number;
  entriesOpened: number;
  unitsAdded: number;
  exitsExecuted: number;
  skipped: string[];
  errors: string[];
}

export interface ScanProgress {
  phase: 'idle' | 'exits' | 'units' | 'entries' | 'done';
  currentSymbol: string | null;
  symbolsDone: number;
  symbolsTotal: number;
  stopped: boolean;
  stoppedReason: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let isRunning = false;
let lastRun: string | null = null;
let shouldStop = false;

const scanProgress: ScanProgress = {
  phase: 'idle',
  currentSymbol: null,
  symbolsDone: 0,
  symbolsTotal: 0,
  stopped: false,
  stoppedReason: null,
};

export function getScanProgress(): ScanProgress {
  return { ...scanProgress };
}

export function stopScan(): void {
  if (isRunning) {
    shouldStop = true;
    logger.info({ msg: 'Scan stop requested' });
  }
}

export async function initLastRun(): Promise<void> {
  try {
    const config = await getConfig();
    const stored = config['LAST_SCAN_RUN'];
    if (stored) lastRun = stored;
  } catch {
    // ignore
  }
}

export async function catchUpIfNeeded(): Promise<void> {
  if (!lastRun) {
    logger.info({ msg: 'No previous scan on record — running catch-up scan on startup' });
    await runDailyScan();
    return;
  }
  const cursor = new Date(lastRun);
  cursor.setDate(cursor.getDate() + 1);
  const now = new Date();
  let tradingDaysMissed = 0;
  while (cursor <= now) {
    if (isTradingDay(new Date(cursor))) tradingDaysMissed++;
    cursor.setDate(cursor.getDate() + 1);
  }
  if (tradingDaysMissed >= 1) {
    logger.info({ msg: 'Startup catch-up scan triggered', lastRun, tradingDaysMissed });
    await runDailyScan();
  }
}

export function getScannerStatus() {
  return { isRunning, lastRun, nextRun: 'Scheduled via SCAN_CRON config (default: 4pm weekdays)' };
}

export async function runDailyScan(force = false): Promise<ScanResult> {
  const date = todayStr();
  const result: ScanResult = {
    date,
    tradingDay: false,
    symbolsScanned: 0,
    entriesOpened: 0,
    unitsAdded: 0,
    exitsExecuted: 0,
    skipped: [],
    errors: [],
  };

  if (isRunning) {
    result.errors.push('Scanner already running');
    return result;
  }

  isRunning = true;
  shouldStop = false;
  Object.assign(scanProgress, { phase: 'idle', currentSymbol: null, symbolsDone: 0, symbolsTotal: 0, stopped: false, stoppedReason: null });

  let accountEquityForSnapshot: number | null = null;

  try {
    if (!isTradingDay(new Date())) {
      if (!force) {
        result.tradingDay = false;
        return result;
      }
      logger.warn({ msg: 'Not a trading day but force=true, proceeding' });
    }
    result.tradingDay = true;

    const config = await getConfig();
    const cfg = parseTurtleConfig(config);
    const watchlist = (config['WATCHLIST'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const maxPositions = parseInt(config['MAX_OPEN_POSITIONS'] ?? '10', 10);
    const minEquity = parseFloat(config['MIN_EQUITY'] ?? '10000');
    const dailyLossLimitPct = parseFloat(config['DAILY_LOSS_LIMIT_PCT'] ?? '2') / 100;
    const cooldownDays = parseInt(config['COOLDOWN_DAYS'] ?? '5', 10);
    const barsNeeded = parseInt(config['BARS_NEEDED'] ?? '300', 10);
    const broker = config['BROKER'] ?? 'alpaca';

    // Account checks
    const account = await getAccount();
    accountEquityForSnapshot = account.equity;
    if (account.equity < minEquity) {
      result.errors.push(`Equity ${account.equity} below minimum ${minEquity}`);
      return result;
    }

    // === PHASE 1: Exit checks ===
    const openTrades = await getOpenTrades();
    scanProgress.phase = 'exits';
    scanProgress.symbolsTotal = openTrades.length;
    scanProgress.symbolsDone = 0;

    for (const trade of openTrades) {
      if (shouldStop) { scanProgress.stopped = true; scanProgress.stoppedReason = 'user'; return result; }
      scanProgress.currentSymbol = trade.symbol;

      try {
        const bars = await getBarsForSymbol(trade.symbol, barsNeeded);
        if (bars.length < cfg.sys2ExitPeriod + 5) {
          result.errors.push(`Insufficient bars for exit: ${trade.symbol}`);
          scanProgress.symbolsDone++;
          continue;
        }

        const exitSig = evaluateExit(
          trade.symbol, bars, cfg,
          trade.system as 1 | 2,
          trade.side as 'long' | 'short',
          trade.currentStop ?? 0
        );

        if (exitSig.shouldExit && exitSig.reason) {
          await closeFullPosition(trade.symbol);
          await closeTrade(trade.id, date, exitSig.close, exitSig.reason);
          result.exitsExecuted++;
        }

        // Always record exit evaluation for audit trail, even when no exit fires.
        await prisma.signal.create({
          data: {
            symbol: trade.symbol, scanDate: date,
            system: trade.system, direction: trade.side,
            close: exitSig.close, dcExitLower: exitSig.dcExitLower, dcExitUpper: exitSig.dcExitUpper,
            exitBreakout: exitSig.reason === 'donchian_exit',
            stopTriggered: exitSig.reason === 'stop_loss',
            actionTaken: exitSig.shouldExit ? `exited_${exitSig.reason}` : 'exit_evaluated',
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Exit error ${trade.symbol}: ${msg}`);
        logger.error({ msg: 'Exit check error', symbol: trade.symbol, err: msg });
      }
      scanProgress.symbolsDone++;
      await sleep(200);
    }

    // === PHASE 2: Unit addition checks ===
    const remainingOpen = await getOpenTrades();
    scanProgress.phase = 'units';
    scanProgress.symbolsTotal = remainingOpen.length;
    scanProgress.symbolsDone = 0;

    for (const trade of remainingOpen) {
      if (shouldStop) { scanProgress.stopped = true; scanProgress.stoppedReason = 'user'; return result; }
      scanProgress.currentSymbol = trade.symbol;

      try {
        if (trade.unitCount >= cfg.maxUnits) { scanProgress.symbolsDone++; continue; }

        const bars = await getBarsForSymbol(trade.symbol, barsNeeded);
        const unit1 = trade.units[0];
        if (!unit1) { scanProgress.symbolsDone++; continue; }

        const unitAddSig = evaluateUnitAdd(
          bars, cfg,
          trade.side as 'long' | 'short',
          unit1.entryPrice, unit1.atrAtEntry,
          trade.unitCount, account.equity
        );

        if (unitAddSig.shouldAdd && unitAddSig.unitSize >= 1) {
          const close = bars[bars.length - 1]!.c;
          const atrArr = (await import('./indicatorService')).calcATR(bars, cfg.atrPeriod);
          const atrN = atrArr[atrArr.length - 1] ?? unit1.atrAtEntry;

          const orderCost = close * unitAddSig.unitSize;
          if (account.buyingPower < orderCost) {
            result.errors.push(`Insufficient buying power for unit add: ${trade.symbol} (need $${orderCost.toFixed(2)}, have $${account.buyingPower.toFixed(2)})`);
            scanProgress.symbolsDone++;
            continue;
          }

          if (trade.side === 'long') {
            await placeBuyOrder(trade.symbol, unitAddSig.unitSize);
          } else {
            await placeSellOrder(trade.symbol, unitAddSig.unitSize);
          }

          await addUnit(trade.id, date, close, unitAddSig.unitSize, atrN, unitAddSig.newStopLoss);

          await prisma.signal.create({
            data: {
              symbol: trade.symbol, scanDate: date,
              system: trade.system, direction: trade.side,
              close, atrValue: atrN,
              unitAddSignal: true,
              actionTaken: `unit_${unitAddSig.unitNumber}_added`,
            },
          });
          result.unitsAdded++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Unit add error ${trade.symbol}: ${msg}`);
      }
      scanProgress.symbolsDone++;
      await sleep(200);
    }

    // === PHASE 3: Entry checks ===
    let remainingBuyingPower = account.buyingPower;
    const currentOpenCount = (await getOpenTrades()).length;
    if (currentOpenCount >= maxPositions) {
      result.errors.push(`Max positions reached (${currentOpenCount}/${maxPositions})`);
      scanProgress.phase = 'done';
      return result;
    }

    scanProgress.phase = 'entries';
    scanProgress.symbolsTotal = watchlist.length;
    scanProgress.symbolsDone = 0;

    for (const symbol of watchlist) {
      if (shouldStop) { scanProgress.stopped = true; scanProgress.stoppedReason = 'user'; return result; }
      scanProgress.currentSymbol = symbol;

      result.symbolsScanned++;

      try {
        // Skip if already in position
        if (await hasOpenPosition(symbol)) {
          result.skipped.push(`${symbol}:open_position`);
          scanProgress.symbolsDone++;
          continue;
        }

        // Cooldown check
        if (await isInCooldown(symbol, cooldownDays)) {
          result.skipped.push(`${symbol}:cooldown`);
          await prisma.signal.create({ data: { symbol, scanDate: date, actionTaken: 'skipped_cooldown' } });
          scanProgress.symbolsDone++;
          continue;
        }

        // Max positions check
        const liveOpen = currentOpenCount + result.entriesOpened;
        if (liveOpen >= maxPositions) {
          result.skipped.push(`${symbol}:max_positions`);
          scanProgress.symbolsDone++;
          continue;
        }

        const bars = await getBarsForSymbol(symbol, barsNeeded);
        if (bars.length < Math.max(cfg.sys2EntryPeriod, cfg.atrPeriod) + 5) {
          result.skipped.push(`${symbol}:insufficient_bars`);
          scanProgress.symbolsDone++;
          continue;
        }

        const signals = evaluateEntries(symbol, bars, cfg, account.equity, date);

        for (const sig of signals) {
          if (!sig.canEnter) continue;
          if (remainingBuyingPower < sig.close * sig.unitSize) {
            result.skipped.push(`${symbol}:no_funds`);
            await prisma.signal.create({
              data: {
                symbol, scanDate: date,
                system: sig.system, direction: sig.direction,
                close: sig.close, atrValue: sig.atrN,
                dcEntryUpper: sig.dcEntryUpper, dcEntryLower: sig.dcEntryLower,
                entryBreakout: true,
                actionTaken: 'no_funds',
              },
            });
            continue;
          }

          // Place order
          if (sig.direction === 'long') {
            await placeBuyOrder(symbol, sig.unitSize);
          } else {
            await placeSellOrder(symbol, sig.unitSize);
          }

          // Save trade
          await openTrade({
            symbol,
            side: sig.direction,
            system: sig.system,
            broker,
            entryDate: date,
            entryPrice: sig.close,
            shares: sig.unitSize,
            atrAtEntry: sig.atrN,
            stopLoss: sig.stopLoss,
          });

          await prisma.signal.create({
            data: {
              symbol, scanDate: date,
              system: sig.system, direction: sig.direction,
              close: sig.close, atrValue: sig.atrN,
              dcEntryUpper: sig.dcEntryUpper, dcEntryLower: sig.dcEntryLower,
              entryBreakout: true,
              actionTaken: 'entered',
            },
          });

          result.entriesOpened++;
          remainingBuyingPower -= sig.close * sig.unitSize;
          break; // Only one entry per symbol per scan
        }

        if (signals.length === 0 || signals.every((s) => !s.canEnter)) {
          const closes = bars.map((b) => b.c);
          const atrArr = calcATR(bars, cfg.atrPeriod);
          const atrN = atrArr[atrArr.length - 1] ?? undefined;
          const close = closes[closes.length - 1] ?? undefined;

          if (signals.length > 0 && signals.every((s) => !s.canEnter)) {
            // Save one record per system that had a size-too-small signal
            for (const sig of signals) {
              await prisma.signal.create({
                data: {
                  symbol, scanDate: date,
                  system: sig.system, direction: sig.direction,
                  close: sig.close, atrValue: sig.atrN,
                  dcEntryUpper: sig.dcEntryUpper, dcEntryLower: sig.dcEntryLower,
                  entryBreakout: true,
                  actionTaken: 'no_signal_size',
                },
              });
            }
          } else {
            // No signal from any system — save one record per enabled system
            for (const sys of cfg.enabledSystems) {
              const entryPeriod = sys === 1 ? cfg.sys1EntryPeriod : cfg.sys2EntryPeriod;
              const dcUpperArr = calcDonchianUpperClose(closes, entryPeriod);
              const dcLowerArr = calcDonchianLowerClose(closes, entryPeriod);
              const dcEntryUpper = dcUpperArr[dcUpperArr.length - 1] ?? undefined;
              const dcEntryLower = dcLowerArr[dcLowerArr.length - 1] ?? undefined;
              await prisma.signal.create({
                data: { symbol, scanDate: date, system: sys, close, atrValue: atrN, dcEntryUpper, dcEntryLower, actionTaken: 'no_signal' },
              });
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Entry error ${symbol}: ${msg}`);
        logger.error({ msg: 'Entry check error', symbol, err: msg });
      }
      scanProgress.symbolsDone++;
      await sleep(200);
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'Fatal scan error', err: msg });
    result.errors.push(`Fatal: ${msg}`);
  } finally {
    // Record daily P&L snapshot — always runs, even on early returns
    if (accountEquityForSnapshot !== null) {
      try {
        await recordDailySnapshot(accountEquityForSnapshot);
      } catch {
        // non-fatal
      }
    }
    scanProgress.phase = 'done';
    scanProgress.currentSymbol = null;
    isRunning = false;
    lastRun = new Date().toISOString();
    setConfig('LAST_SCAN_RUN', lastRun).catch(() => {});
  }

  logger.info({ msg: 'Daily scan complete', result });
  return result;
}
