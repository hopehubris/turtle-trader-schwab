import { Router } from 'express';
import accountRouter from './routes/account';
import tradesRouter from './routes/trades';
import signalsRouter from './routes/signals';
import chartsRouter from './routes/charts';
import configRouter from './routes/config';
import statsRouter from './routes/stats';

const router = Router();

router.use('/account', accountRouter);
router.use('/trades', tradesRouter);
router.use('/signals', signalsRouter);
router.use('/charts', chartsRouter);
router.use('/config', configRouter);
router.use('/stats', statsRouter);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
