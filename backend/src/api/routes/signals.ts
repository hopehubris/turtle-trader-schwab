import { Router, Request, Response } from 'express';
import prisma from '../../db/prisma';
import {
  runDailyScan,
  getScannerStatus,
  getScanProgress,
  stopScan,
} from '../../services/turtleScannerService';
import logger from '../../utils/logger';

const router = Router();

// GET /api/signals
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query['limit'] ?? '100'), 10);
    const date = req.query['date'] as string | undefined;
    const system = req.query['system'] ? parseInt(String(req.query['system']), 10) : undefined;
    const direction = req.query['direction'] as string | undefined;

    const signals = await prisma.signal.findMany({
      where: {
        ...(date ? { scanDate: date } : {}),
        ...(system ? { system } : {}),
        ...(direction ? { direction } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(signals);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'GET /signals error', err: msg });
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// POST /api/signals/scan — trigger scan
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const force = Boolean((req.body as Record<string, unknown>)?.['force']);
    const result = await runDailyScan(force);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'POST /signals/scan error', err: msg });
    res.status(500).json({ error: msg });
  }
});

// GET /api/signals/scan/status
router.get('/scan/status', (_req: Request, res: Response) => {
  res.json(getScannerStatus());
});

// GET /api/signals/scan/progress
router.get('/scan/progress', (_req: Request, res: Response) => {
  res.json(getScanProgress());
});

// POST /api/signals/scan/stop
router.post('/scan/stop', (_req: Request, res: Response) => {
  stopScan();
  res.json({ stopped: true });
});

export default router;
