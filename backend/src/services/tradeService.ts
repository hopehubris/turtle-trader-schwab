import prisma from '../db/prisma';
import logger from '../utils/logger';

export interface OpenTradeData {
  symbol: string;
  side: 'long' | 'short';
  system: 1 | 2;
  broker: string;
  entryDate: string;
  entryPrice: number;
  shares: number;
  atrAtEntry: number;
  stopLoss: number;
}

export async function openTrade(data: OpenTradeData) {
  const dollarAmount = data.entryPrice * data.shares;

  const trade = await prisma.trade.create({
    data: {
      symbol: data.symbol,
      side: data.side,
      system: data.system,
      status: 'open',
      broker: data.broker,
      entryDate: data.entryDate,
      unitCount: 1,
      currentStop: data.stopLoss,
      totalShares: data.shares,
      avgEntryPrice: data.entryPrice,
      dollarAmount,
    },
  });

  await prisma.tradeUnit.create({
    data: {
      tradeId: trade.id,
      unitNumber: 1,
      entryDate: data.entryDate,
      entryPrice: data.entryPrice,
      shares: data.shares,
      atrAtEntry: data.atrAtEntry,
      stopLoss: data.stopLoss,
      status: 'open',
    },
  });

  logger.info({ msg: 'Trade opened', tradeId: trade.id, symbol: data.symbol, side: data.side, system: data.system });
  return trade;
}

export async function addUnit(
  tradeId: number,
  entryDate: string,
  entryPrice: number,
  shares: number,
  atrAtEntry: number,
  newStopLoss: number
) {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId }, include: { units: true } });
  if (!trade) throw new Error(`Trade ${tradeId} not found`);
  if (trade.status !== 'open') throw new Error(`Trade ${tradeId} is not open`);

  const nextUnit = trade.unitCount + 1;
  const totalShares = trade.totalShares + shares;
  const totalCost = trade.avgEntryPrice * trade.totalShares + entryPrice * shares;
  const avgEntryPrice = totalCost / totalShares;

  const [updatedTrade] = await prisma.$transaction([
    prisma.trade.update({
      where: { id: tradeId },
      data: {
        unitCount: nextUnit,
        currentStop: newStopLoss,
        totalShares,
        avgEntryPrice,
        dollarAmount: totalCost,
      },
    }),
    prisma.tradeUnit.create({
      data: {
        tradeId,
        unitNumber: nextUnit,
        entryDate,
        entryPrice,
        shares,
        atrAtEntry,
        stopLoss: newStopLoss,
        status: 'open',
      },
    }),
    // Update all existing open units' stop to the new stop
    prisma.tradeUnit.updateMany({
      where: { tradeId, status: 'open', unitNumber: { lt: nextUnit } },
      data: { stopLoss: newStopLoss },
    }),
  ]);

  logger.info({ msg: 'Unit added to trade', tradeId, unitNumber: nextUnit, newStopLoss });
  return updatedTrade;
}

export async function closeTrade(
  tradeId: number,
  exitDate: string,
  exitPrice: number,
  exitReason: string
) {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error(`Trade ${tradeId} not found`);

  const pnl = trade.side === 'long'
    ? (exitPrice - trade.avgEntryPrice) * trade.totalShares
    : (trade.avgEntryPrice - exitPrice) * trade.totalShares;
  const pnlPct = (pnl / trade.dollarAmount) * 100;

  await prisma.$transaction([
    prisma.trade.update({
      where: { id: tradeId },
      data: { status: 'closed', exitDate, exitPrice, exitReason, pnl, pnlPct },
    }),
    prisma.tradeUnit.updateMany({
      where: { tradeId, status: 'open' },
      data: { status: 'closed' },
    }),
  ]);

  logger.info({ msg: 'Trade closed', tradeId, symbol: trade.symbol, pnl, exitReason });
}

export async function getOpenTrades() {
  return prisma.trade.findMany({
    where: { status: 'open' },
    include: { units: { orderBy: { unitNumber: 'asc' } } },
    orderBy: { entryDate: 'desc' },
  });
}

export async function getAllTrades(limit = 200) {
  return prisma.trade.findMany({
    include: { units: { orderBy: { unitNumber: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getTradeById(id: number) {
  return prisma.trade.findUnique({
    where: { id },
    include: { units: { orderBy: { unitNumber: 'asc' } } },
  });
}

export async function isInCooldown(symbol: string, cooldownDays: number): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cooldownDays);
  const cutoffStr = cutoff.toISOString().split('T')[0]!;

  const recent = await prisma.trade.findFirst({
    where: {
      symbol,
      status: { in: ['closed', 'reconciled_closed'] },
      exitDate: { gte: cutoffStr },
    },
  });

  return recent !== null;
}

export async function hasOpenPosition(symbol: string): Promise<boolean> {
  const trade = await prisma.trade.findFirst({ where: { symbol, status: 'open' } });
  return trade !== null;
}
