/**
 * Broker abstraction layer.
 * Selects the active broker based on BROKER config value.
 * Currently supports: schwab (full), fidelity (manual/queue).
 */
import schwabClient, { AccountInfo, Bar } from './schwabClient';
import { queueManualOrder, PendingManualOrder } from './fidelityClient';
import { getConfigValue } from './configService';
import logger from '../utils/logger';

export interface BrokerOrder {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  status: string;
  filledAvgPrice: number | null;
  manual?: boolean;
  instructions?: string;
}

export async function getBroker(): Promise<string> {
  return (await getConfigValue('BROKER')) || 'schwab';
}

export async function isDryRun(): Promise<boolean> {
  return (await getConfigValue('DRY_RUN')) === 'true';
}

export async function getAccount(): Promise<AccountInfo> {
  const broker = await getBroker();
  if (broker === 'schwab') {
    return schwabClient.getAccount();
  }
  logger.warn({ msg: 'Fidelity broker selected — account data unavailable via API' });
  return { equity: 0, buyingPower: 0, cash: 0, daytradeCount: 0 };
}

export async function getBars(symbol: string, limit = 300): Promise<Bar[]> {
  return schwabClient.getBars(symbol, limit);
}

export async function placeBuyOrder(
  symbol: string,
  qty: number,
  dryRunOverride?: boolean
): Promise<BrokerOrder> {
  const dry = dryRunOverride ?? (await isDryRun());
  const broker = await getBroker();

  if (dry) {
    logger.info({ msg: 'DRY RUN — buy order skipped', symbol, qty });
    return { id: `dry-buy-${Date.now()}`, symbol, side: 'buy', qty, status: 'dry_run', filledAvgPrice: null };
  }

  if (broker === 'schwab') {
    const order = await schwabClient.placeOrderQty(symbol, qty, 'buy');
    return {
      id: order.id,
      symbol,
      side: 'buy',
      qty,
      status: order.status,
      filledAvgPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
    };
  }

  const manual = queueManualOrder(symbol, 'buy', qty);
  return { id: manual.id, symbol, side: 'buy', qty, status: 'pending_manual', filledAvgPrice: null, manual: true, instructions: manual.instructions };
}

export async function placeSellOrder(
  symbol: string,
  qty: number,
  dryRunOverride?: boolean
): Promise<BrokerOrder> {
  const dry = dryRunOverride ?? (await isDryRun());
  const broker = await getBroker();

  if (dry) {
    logger.info({ msg: 'DRY RUN — sell order skipped', symbol, qty });
    return { id: `dry-sell-${Date.now()}`, symbol, side: 'sell', qty, status: 'dry_run', filledAvgPrice: null };
  }

  if (broker === 'schwab') {
    const order = await schwabClient.placeOrderQty(symbol, qty, 'sell');
    return {
      id: order.id,
      symbol,
      side: 'sell',
      qty,
      status: order.status,
      filledAvgPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
    };
  }

  const manual = queueManualOrder(symbol, 'sell', qty);
  return { id: manual.id, symbol, side: 'sell', qty, status: 'pending_manual', filledAvgPrice: null, manual: true, instructions: manual.instructions };
}

export async function closeFullPosition(
  symbol: string,
  dryRunOverride?: boolean
): Promise<BrokerOrder> {
  const dry = dryRunOverride ?? (await isDryRun());
  const broker = await getBroker();

  if (dry) {
    logger.info({ msg: 'DRY RUN — close position skipped', symbol });
    return { id: `dry-close-${Date.now()}`, symbol, side: 'sell', qty: 0, status: 'dry_run', filledAvgPrice: null };
  }

  if (broker === 'schwab') {
    const order = await schwabClient.closePosition(symbol);
    return {
      id: order.id,
      symbol,
      side: 'sell',
      qty: order.qty ? parseFloat(order.qty) : 0,
      status: order.status,
      filledAvgPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
    };
  }

  const manual = queueManualOrder(symbol, 'sell', 0);
  return { id: manual.id, symbol, side: 'sell', qty: 0, status: 'pending_manual', filledAvgPrice: null, manual: true, instructions: `Close your full ${symbol} position in Fidelity.` };
}

export async function getPendingManualOrders(): Promise<PendingManualOrder[]> {
  const { getPendingOrders } = await import('./fidelityClient');
  return getPendingOrders();
}
