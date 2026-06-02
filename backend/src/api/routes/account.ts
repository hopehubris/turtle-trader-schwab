import { Router, Request, Response } from 'express';
import { getAccount } from '../../services/brokerService';
import { getPendingManualOrders } from '../../services/brokerService';
import logger from '../../utils/logger';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const account = await getAccount();
    const pendingOrders = await getPendingManualOrders();
    res.json({ ...account, pendingManualOrders: pendingOrders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'GET /account error', err: msg });
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

export default router;
