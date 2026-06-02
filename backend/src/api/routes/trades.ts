import { Router, Request, Response } from 'express';
import prisma from '../../db/prisma';
import schwabClient from '../../services/schwabClient';
import { closeFullPosition } from '../../services/brokerService';
import { getOpenTrades, getAllTrades, getTradeById, closeTrade } from '../../services/tradeService';
import { parseFidelityCSV } from '../../services/fidelityClient';
import { getBarsForSymbol } from '../../services/marketDataService';
import { getConfig } from '../../services/configService';
import { calcATR, calcDonchianLowerClose, calcDonchianUpperClose } from '../../services/indicatorService';
import logger from '../../utils/logger';

const router = Router();

// GET /api/trades — all trades with stats
router.get('/', async (_req: Request, res: Response) => {
  try {
    const trades = await getAllTrades(500);
    res.json(trades);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'GET /trades error', err: msg });
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// GET /api/trades/open — open trades enriched with live prices and stops
router.get('/open', async (_req: Request, res: Response) => {
  try {
    const trades = await getOpenTrades();
    const config = await getConfig();
    const atrPeriod = parseInt(config['ATR_PERIOD'] ?? '14', 10);

    const enriched = await Promise.all(
      trades.map(async (trade) => {
        let currentPrice: number | null = null;
        let unrealizedPnl: number | null = null;

        try {
          const positions = await schwabClient.getPositions();
          const pos = positions.find((p) => p.symbol === trade.symbol);
          if (pos) {
            currentPrice = parseFloat(String(pos.current_price));
            unrealizedPnl = parseFloat(String(pos.unrealized_pl));
          }
        } catch {
          // non-fatal
        }

        let currentN: number | null = null;
        try {
          const bars = await getBarsForSymbol(trade.symbol, 50);
          const atrArr = calcATR(bars, atrPeriod);
          currentN = atrArr[atrArr.length - 1] ?? null;
        } catch {
          // non-fatal
        }

        return { ...trade, currentPrice, unrealizedPnl, currentN };
      })
    );

    res.json(enriched);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'GET /trades/open error', err: msg });
    res.status(500).json({ error: 'Failed to fetch open trades' });
  }
});

// GET /api/trades/:id — single trade with units
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] ?? '', 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const trade = await getTradeById(id);
    if (!trade) { res.status(404).json({ error: 'Trade not found' }); return; }
    res.json(trade);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/trades/:id — close trade manually
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] ?? '', 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  try {
    const trade = await getTradeById(id);
    if (!trade) { res.status(404).json({ error: 'Trade not found' }); return; }
    if (trade.status !== 'open') { res.status(409).json({ error: 'Trade is not open' }); return; }

    await closeFullPosition(trade.symbol);
    const date = new Date().toISOString().split('T')[0]!;
    let exitPrice = trade.avgEntryPrice;
    try {
      const positions = await schwabClient.getPositions();
      const pos = positions.find((p) => p.symbol === trade.symbol);
      if (pos) exitPrice = parseFloat(String(pos.current_price));
    } catch { /* use avgEntry as fallback */ }

    await closeTrade(id, date, exitPrice, 'manual');
    res.json({ success: true, tradeId: id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'DELETE /trades/:id error', id, err: msg });
    res.status(500).json({ error: msg });
  }
});

// POST /api/trades/:id/mark-closed — mark a trade closed in DB without touching broker
router.post('/:id/mark-closed', async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] ?? '', 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  try {
    const trade = await getTradeById(id);
    if (!trade) { res.status(404).json({ error: 'Trade not found' }); return; }
    if (trade.status !== 'open') { res.status(409).json({ error: 'Trade is not open' }); return; }

    const date = new Date().toISOString().split('T')[0]!;
    let exitPrice: number = (req.body as { exitPrice?: number }).exitPrice ?? trade.avgEntryPrice;

    if (!(req.body as { exitPrice?: number }).exitPrice) {
      try {
        const positions = await schwabClient.getPositions();
        const pos = positions.find((p) => p.symbol === trade.symbol);
        if (pos) exitPrice = parseFloat(String(pos.current_price));
      } catch { /* use avgEntry as fallback */ }
    }

    await closeTrade(id, date, exitPrice, 'manual');
    res.json({ success: true, tradeId: id, exitPrice });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'POST /trades/:id/mark-closed error', id, err: msg });
    res.status(500).json({ error: msg });
  }
});

// POST /api/trades/sync-prices — sync entry prices from Schwab
router.post('/sync-prices', async (_req: Request, res: Response) => {
  try {
    const [schwabPositions, openTrades] = await Promise.all([
      schwabClient.getPositions().catch(() => []),
      getOpenTrades(),
    ]);
    const schwabMap = new Map(schwabPositions.map((p) => [p.symbol, p]));
    const synced: { symbol: string; oldPrice: number; newPrice: number }[] = [];

    for (const trade of openTrades) {
      const sp = schwabMap.get(trade.symbol);
      if (!sp) continue;
      const newPrice = parseFloat(sp.avg_entry_price);
      if (Math.abs(newPrice - trade.avgEntryPrice) > 0.01) {
        await prisma.trade.update({ where: { id: trade.id }, data: { avgEntryPrice: newPrice } });
        synced.push({ symbol: trade.symbol, oldPrice: trade.avgEntryPrice, newPrice });
      }
    }

    res.json({ synced, count: synced.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/trades/sync — full Schwab sync: entry prices + exit reconciliation
router.post('/sync', async (_req: Request, res: Response) => {
  try {
    const [schwabPositions, openTrades] = await Promise.all([
      schwabClient.getPositions(),
      getOpenTrades(),
    ]);
    const schwabMap = new Map(schwabPositions.map((p) => [p.symbol, p]));
    const date = new Date().toISOString().split('T')[0]!;

    const entriesSynced: { symbol: string; oldPrice: number; newPrice: number }[] = [];
    const exitsReconciled: { symbol: string; exitPrice: number }[] = [];

    for (const trade of openTrades) {
      const sp = schwabMap.get(trade.symbol);

      if (!sp) {
        // No longer on Schwab — close in DB using entry price as fallback
        await closeTrade(trade.id, date, trade.avgEntryPrice, 'reconciled');
        exitsReconciled.push({ symbol: trade.symbol, exitPrice: trade.avgEntryPrice });
        logger.info({ msg: 'Reconciled exit: no Schwab position found', symbol: trade.symbol, tradeId: trade.id });
      } else {
        // Still open — sync entry price if drifted
        const newPrice = parseFloat(sp.avg_entry_price);
        if (Math.abs(newPrice - trade.avgEntryPrice) > 0.01) {
          await prisma.trade.update({ where: { id: trade.id }, data: { avgEntryPrice: newPrice } });
          entriesSynced.push({ symbol: trade.symbol, oldPrice: trade.avgEntryPrice, newPrice });
        }
      }
    }

    res.json({
      entriesSynced,
      entriesCount: entriesSynced.length,
      exitsReconciled,
      exitsCount: exitsReconciled.length,
      schwabPositions: schwabPositions.length,
      dbOpenTrades: openTrades.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'POST /trades/sync error', err: msg });
    res.status(500).json({ error: msg });
  }
});

// POST /api/trades/import-csv — import Fidelity CSV positions
router.post('/import-csv', async (req: Request, res: Response) => {
  try {
    const { csv } = req.body as { csv?: string };
    if (!csv) { res.status(400).json({ error: 'csv body field required' }); return; }
    const positions = parseFidelityCSV(csv);
    res.json({ parsed: positions, count: positions.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
