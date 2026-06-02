import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './api/index';
import { startScheduler } from './jobs/dailyScan';
import { initLastRun, catchUpIfNeeded } from './services/turtleScannerService';
import logger from './utils/logger';

const PORT = parseInt(process.env['PORT'] ?? '3010', 10);

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', apiRouter);

async function bootstrap() {
  try {
    await initLastRun();
    await startScheduler();
    await catchUpIfNeeded();
    logger.info({ msg: 'Turtle Trader (Schwab) initialized' });
  } catch (err) {
    logger.error({ msg: 'Bootstrap error', err });
  }
}

app.listen(PORT, '0.0.0.0', () => {
  logger.info({ msg: `Turtle Trader (Schwab) backend running on port ${PORT} (all interfaces)` });
  bootstrap().catch((err) => logger.error({ msg: 'Bootstrap failed', err }));
});

export default app;
