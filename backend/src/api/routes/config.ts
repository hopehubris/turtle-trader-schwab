import { Router, Request, Response } from 'express';
import { getConfig, setConfigBulk } from '../../services/configService';
import logger from '../../utils/logger';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const config = await getConfig();
    res.json(config);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'GET /config error', err: msg });
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    const data = req.body as Record<string, string>;
    if (!data || typeof data !== 'object') {
      res.status(400).json({ error: 'Body must be an object' });
      return;
    }
    await setConfigBulk(data);
    const updated = await getConfig();
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'PUT /config error', err: msg });
    res.status(500).json({ error: 'Failed to update config' });
  }
});

export default router;
