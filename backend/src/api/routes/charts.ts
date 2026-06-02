import { Router, Request, Response } from 'express';
import { getBarsForSymbol } from '../../services/marketDataService';
import { getConfig } from '../../services/configService';
import { calcATR, calcDonchianUpperClose, calcDonchianLowerClose } from '../../services/indicatorService';
import logger from '../../utils/logger';

const router = Router();

router.get('/:symbol', async (req: Request, res: Response) => {
  const symbol = req.params['symbol']?.toUpperCase();
  if (!symbol) { res.status(400).json({ error: 'Symbol required' }); return; }

  try {
    const config = await getConfig();
    const sys1Entry = parseInt(config['SYS1_ENTRY_PERIOD'] ?? '20', 10);
    const sys1Exit = parseInt(config['SYS1_EXIT_PERIOD'] ?? '10', 10);
    const sys2Entry = parseInt(config['SYS2_ENTRY_PERIOD'] ?? '55', 10);
    const sys2Exit = parseInt(config['SYS2_EXIT_PERIOD'] ?? '20', 10);
    const atrPeriod = parseInt(config['ATR_PERIOD'] ?? '14', 10);
    const limit = parseInt(String(req.query['limit'] ?? '200'), 10);

    const bars = await getBarsForSymbol(symbol, Math.max(limit, sys2Entry + 10));

    // Slice to requested limit for display
    const displayBars = bars.slice(-limit);

    const closes = displayBars.map((b) => b.c);
    const atrArr = calcATR(displayBars, atrPeriod);
    const sys1UpperArr = calcDonchianUpperClose(closes, sys1Entry);
    const sys1LowerArr = calcDonchianLowerClose(closes, sys1Entry);
    const sys1ExitLowerArr = calcDonchianLowerClose(closes, sys1Exit);
    const sys2UpperArr = calcDonchianUpperClose(closes, sys2Entry);
    const sys2LowerArr = calcDonchianLowerClose(closes, sys2Entry);
    const sys2ExitLowerArr = calcDonchianLowerClose(closes, sys2Exit);

    res.json({
      symbol,
      bars: displayBars,
      indicators: {
        atr: atrArr,
        sys1Upper: sys1UpperArr,
        sys1Lower: sys1LowerArr,
        sys1ExitLower: sys1ExitLowerArr,
        sys2Upper: sys2UpperArr,
        sys2Lower: sys2LowerArr,
        sys2ExitLower: sys2ExitLowerArr,
      },
      config: { sys1Entry, sys1Exit, sys2Entry, sys2Exit, atrPeriod },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'GET /charts/:symbol error', symbol, err: msg });
    res.status(500).json({ error: `Failed to fetch chart data for ${symbol}` });
  }
});

export default router;
