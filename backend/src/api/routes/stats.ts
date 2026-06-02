import { Router, Request, Response } from 'express';
import { getTradeStats, getDailyPnlHistory } from '../../services/statsService';
import logger from '../../utils/logger';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const stats = await getTradeStats();
    res.json(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'GET /stats error', err: msg });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/daily-pnl', async (req: Request, res: Response) => {
  try {
    const days = parseInt(String(req.query['days'] ?? '30'), 10);
    const data = await getDailyPnlHistory(days);
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'GET /stats/daily-pnl error', err: msg });
    res.status(500).json({ error: 'Failed to fetch daily P&L' });
  }
});

export default router;
