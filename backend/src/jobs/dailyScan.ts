import cron from 'node-cron';
import { getConfigValue } from '../services/configService';
import { runDailyScan } from '../services/turtleScannerService';
import logger from '../utils/logger';

let cronJob: cron.ScheduledTask | null = null;

export async function startScheduler(): Promise<void> {
  const cronExpr = (await getConfigValue('SCAN_CRON')) || '5 21 * * 1-5';

  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  cronJob = cron.schedule(cronExpr, async () => {
    logger.info({ msg: 'Scheduled scan triggered', cronExpr });
    try {
      const result = await runDailyScan();
      logger.info({ msg: 'Scheduled scan complete', result });
    } catch (err) {
      logger.error({ msg: 'Scheduled scan failed', err });
    }
  });

  logger.info({ msg: 'Scan scheduler started', cronExpr });
}

export function stopScheduler(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info({ msg: 'Scan scheduler stopped' });
  }
}
