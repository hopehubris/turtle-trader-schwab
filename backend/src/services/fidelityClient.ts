/**
 * Fidelity integration — manual/CSV-based.
 * Fidelity does not provide a public trading API.
 * This module provides helpers for CSV import and manual order guidance.
 */
import logger from '../utils/logger';

export interface FidelityPosition {
  symbol: string;
  shares: number;
  avgCost: number;
  currentValue: number;
  unrealizedPnl: number;
  side: 'long' | 'short';
}

export interface PendingManualOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  type: 'market';
  createdAt: string;
  instructions: string;
}

const pendingOrders: PendingManualOrder[] = [];

/**
 * Parse Fidelity positions CSV export.
 * Expected columns: Symbol, Quantity, Last Price, Cost Basis Per Share, Unrealized Gain/Loss
 */
export function parseFidelityCSV(csvText: string): FidelityPosition[] {
  const lines = csvText.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0]!.split(',').map((h) => h.trim().replace(/"/g, ''));
  const positions: FidelityPosition[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',').map((c) => c.trim().replace(/"/g, ''));
    if (cols.length < 5) continue;

    const symbol = header.indexOf('Symbol') >= 0 ? cols[header.indexOf('Symbol')] ?? '' : cols[0] ?? '';
    const qty = parseFloat(cols[header.indexOf('Quantity')] ?? cols[1] ?? '0');
    const lastPrice = parseFloat((cols[header.indexOf('Last Price')] ?? cols[2] ?? '0').replace('$', ''));
    const costBasis = parseFloat((cols[header.indexOf('Cost Basis Per Share')] ?? cols[3] ?? '0').replace('$', ''));
    const unrealized = parseFloat((cols[header.indexOf('Unrealized Gain/Loss')] ?? cols[4] ?? '0').replace('$', ''));

    if (!symbol || isNaN(qty) || qty === 0) continue;

    positions.push({
      symbol: symbol.toUpperCase(),
      shares: Math.abs(qty),
      avgCost: costBasis,
      currentValue: lastPrice * Math.abs(qty),
      unrealizedPnl: unrealized,
      side: qty >= 0 ? 'long' : 'short',
    });
  }

  return positions;
}

/**
 * Queue a pending manual order (for Fidelity or dry-run mode).
 * Returns instructions for the user to execute manually.
 */
export function queueManualOrder(
  symbol: string,
  side: 'buy' | 'sell',
  qty: number
): PendingManualOrder {
  const order: PendingManualOrder = {
    id: `manual-${Date.now()}-${symbol}`,
    symbol,
    side,
    qty,
    type: 'market',
    createdAt: new Date().toISOString(),
    instructions: `Place a ${side.toUpperCase()} market order for ${qty} shares of ${symbol} in your Fidelity account.`,
  };

  pendingOrders.push(order);
  logger.info({ msg: 'Manual order queued', symbol, side, qty, instructions: order.instructions });
  return order;
}

export function getPendingOrders(): PendingManualOrder[] {
  return [...pendingOrders];
}

export function clearPendingOrder(id: string): void {
  const idx = pendingOrders.findIndex((o) => o.id === id);
  if (idx >= 0) pendingOrders.splice(idx, 1);
}
