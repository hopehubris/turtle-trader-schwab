import prisma from '../db/prisma';

export interface TradeStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgHoldDays: number;
  profitFactor: number;
}

export async function getTradeStats(): Promise<TradeStats> {
  const trades = await prisma.trade.findMany({ where: { status: 'closed' } });
  const openCount = await prisma.trade.count({ where: { status: 'open' } });

  if (trades.length === 0) {
    return {
      totalTrades: 0,
      openTrades: openCount,
      closedTrades: 0,
      winRate: 0,
      totalPnl: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      avgHoldDays: 0,
      profitFactor: 0,
    };
  }

  const wins = trades.filter((t) => (t.pnl ?? 0) > 0);
  const losses = trades.filter((t) => (t.pnl ?? 0) <= 0);
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length : 0;
  const largestWin = wins.length > 0 ? Math.max(...wins.map((t) => t.pnl ?? 0)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.pnl ?? 0)) : 0;

  const grossWin = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  // Average hold days
  let totalHoldDays = 0;
  let holdCount = 0;
  for (const t of trades) {
    if (t.entryDate && t.exitDate) {
      const entry = new Date(t.entryDate).getTime();
      const exit = new Date(t.exitDate).getTime();
      const days = (exit - entry) / (1000 * 60 * 60 * 24);
      if (!isNaN(days) && days >= 0) {
        totalHoldDays += days;
        holdCount++;
      }
    }
  }
  const avgHoldDays = holdCount > 0 ? totalHoldDays / holdCount : 0;

  return {
    totalTrades: trades.length,
    openTrades: openCount,
    closedTrades: trades.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    totalPnl,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    avgHoldDays,
    profitFactor,
  };
}

export async function getDailyPnlHistory(days = 30): Promise<Array<{ date: string; dailyPnl: number; cumulativePnl: number; equity: number }>> {
  const rows = await prisma.dailyPnL.findMany({
    orderBy: { date: 'asc' },
    take: days,
  });
  return rows.map((r) => ({
    date: r.date,
    dailyPnl: r.dailyPnl,
    cumulativePnl: r.cumulativePnl,
    equity: r.equity,
  }));
}

export async function recordDailySnapshot(equity: number): Promise<void> {
  const date = new Date().toISOString().split('T')[0]!;
  const openCount = await prisma.trade.count({ where: { status: 'open' } });

  // Get yesterday's cumulative
  const yesterday = await prisma.dailyPnL.findFirst({ orderBy: { date: 'desc' } });
  const prevCumulative = yesterday?.cumulativePnl ?? 0;
  const prevEquity = yesterday?.equity ?? equity;
  const dailyPnl = equity - prevEquity;
  const cumulativePnl = prevCumulative + dailyPnl;

  await prisma.dailyPnL.upsert({
    where: { date },
    update: { equity, dailyPnl, cumulativePnl, openPositionsCount: openCount },
    create: { date, equity, dailyPnl, cumulativePnl, openPositionsCount: openCount },
  });
}
